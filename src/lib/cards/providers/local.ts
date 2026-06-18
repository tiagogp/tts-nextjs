/**
 * A1 — LocalProvider. The private, free, no-network path.
 *
 * No model calls: mining is heuristic selection, generation is mechanical cloze
 * construction, and the critique is a lightweight structural gate. Lower quality
 * than the LLM providers by design — its job is to keep "run it all locally" a
 * coherent end-to-end path where nothing leaves the machine. Pairs with the
 * lexical fallback in dedup (A5), since it exposes no embedder.
 */

import type { CardGenerationProvider, ProviderKind } from "../provider";
import type {
  Card,
  CardSource,
  Critique,
  DiscoveryRequest,
  PhraseCandidate,
  TranscriptSegment,
} from "../schema";
import { DEFAULT_LEARNER_LANG } from "../shared";

export interface LocalProviderOptions {
  learnerLang?: string;
  /** How many phrases to surface per discovery run. Default 20. */
  maxPhrases?: number;
}

// Function words make poor cloze blanks and poor "worth learning" signals.
const STOPWORDS = new Set(
  "the a an and or but of to in on at for with as is are was were be been being i you he she it we they this that these those my your his her its our their do does did not no so if then than".split(
    " ",
  ),
);

const LEVEL_LENGTH_TARGETS: Record<string, { min: number; max: number }> = {
  a1: { min: 2, max: 7 },
  a2: { min: 3, max: 9 },
  b1: { min: 4, max: 12 },
  b2: { min: 5, max: 16 },
  c1: { min: 6, max: 22 },
  c2: { min: 7, max: 28 },
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export class LocalProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "local";
  readonly label = "Local (private, on-device)";
  readonly isLocal = true;

  private readonly learnerLang: string;
  private readonly maxPhrases: number;

  constructor(opts: LocalProviderOptions = {}) {
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
    this.maxPhrases = opts.maxPhrases ?? 20;
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
  ): Promise<PhraseCandidate[]> {
    const focusTokens = new Set(words(request.focus ?? ""));
    const now = Date.now();
    const target = LEVEL_LENGTH_TARGETS[(request.targetLevel ?? "b1").toLowerCase()] ?? LEVEL_LENGTH_TARGETS.b1;

    const scored = transcript.map((seg, index) => {
      const toks = words(seg.text);
      const content = toks.filter((w) => !STOPWORDS.has(w));
      // Favour learnable-length chunks; reward focus-keyword overlap heavily.
      const lengthScore =
        content.length >= target.min && content.length <= target.max ? content.length : 0;
      const focusScore =
        focusTokens.size > 0
          ? content.filter((w) => focusTokens.has(w)).length * 5
          : 0;
      return { seg, index, score: lengthScore + focusScore };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxPhrases)
      .map(({ seg, index }) => ({
        id: crypto.randomUUID(),
        sourceId: request.source.id,
        text: seg.text.trim(),
        note: request.focus?.trim()
          ? `Matches focus "${request.focus.trim()}"`
          : "Useful-length expression",
        status: "suggested" as const,
        segmentIndex: index,
        startMs: seg.startMs,
        endMs: seg.endMs,
        createdAt: now,
      }));
  }

  async generate(source: CardSource): Promise<Card[]> {
    const now = Date.now();

    if (source.kind === "phrase") {
      const text = source.candidate.text.trim();
      const toks = text.split(/\s+/);
      // Blank the longest content word so the card hinges on a real lexical choice.
      let blankIdx = -1;
      let blankLen = 0;
      toks.forEach((w, i) => {
        const bare = w.replace(/[^\p{L}\p{N}']/gu, "");
        if (!STOPWORDS.has(bare.toLowerCase()) && bare.length > blankLen) {
          blankLen = bare.length;
          blankIdx = i;
        }
      });
      if (blankIdx === -1) return [];
      const answer = toks[blankIdx];
      const front = toks.map((w, i) => (i === blankIdx ? "____" : w)).join(" ");
      return [
        {
          id: crypto.randomUUID(),
          front: `Fill the blank: ${front}`,
          back: `${answer}${source.candidate.translation ? ` — ${source.candidate.translation}` : ""}`,
          concept: "word choice in context",
          source: { kind: "phrase", id: source.candidate.id },
          audioClipPath: source.candidate.audioClipPath,
          createdAt: now,
        },
      ];
    }

    // Correction path: drill the contrast between what they said and what's natural.
    const ev = source.event;
    return [
      {
        id: crypto.randomUUID(),
        front: `Say this naturally in ${ev.targetLang}: "${ev.original}"`,
        back: ev.corrected,
        concept: ev.errorTypes[0] ?? "phrasing",
        errorType: ev.errorTypes[0],
        source: { kind: "error", id: ev.id },
        createdAt: now,
      },
    ];
  }

  async critique(card: Card, source: CardSource): Promise<Critique> {
    const front = card.front.trim();
    const back = card.back.trim();

    // Trivial: the prompt already contains the answer, or nothing is being tested.
    if (!front || !back || front === back) {
      return { verdict: "drop", reason: "empty or self-answering card" };
    }
    if (!front.includes("____") && !front.includes("?") && !front.includes(":")) {
      return { verdict: "drop", reason: "front does not pose a task" };
    }
    // Structural grounding (A6): the answer must echo something from the source.
    const sourceWords = new Set(
      words(source.kind === "phrase" ? source.candidate.text : source.event.corrected),
    );
    const grounded = words(back).some((w) => sourceWords.has(w));
    if (!grounded) {
      return { verdict: "drop", reason: "answer not grounded in source" };
    }
    return { verdict: "keep", reason: "poses a task and is grounded in source" };
  }
}
