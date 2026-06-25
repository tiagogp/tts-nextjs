/**
 * Provider-agnostic brain: the prompts, JSON schemas, and normalizers that turn
 * raw LLM output into the typed `PhraseCandidate` / `Card` / `Critique` shapes.
 *
 * Each provider (Claude, OpenAI, local) is responsible only for *calling its own
 * SDK* with a `{ system, user, schema }` request and handing the parsed JSON back
 * here. Selection bias, card shape, grounding (A6), and the quality contract all
 * live in one place so the three providers stay genuinely interchangeable.
 */

import type {
  Card,
  CardSource,
  Critique,
  CritiqueVerdict,
  DiscoveryRequest,
  ErrorEvent,
  ErrorType,
  PhraseCandidate,
  TranscriptSegment,
} from "./schema";
import type { ConversationTurn, ConverseOptions } from "./provider";

/** Default learner (L1) language for translation glosses when none is supplied. */
export const DEFAULT_LEARNER_LANG = "pt";

const ERROR_TYPES: ErrorType[] = [
  "collocation",
  "preposition",
  "tense",
  "article",
  "word-order",
  "idiom",
  "vocabulary",
  "register",
  "other",
];

/** A single structured request a provider sends to its model. */
export interface JsonRequest<T> {
  system: string;
  user: string;
  /** JSON Schema for structured output. `_t` is a phantom for the parsed shape. */
  schema: Record<string, unknown>;
  _t?: T;
}

/** Every provider implements exactly this to talk to its backend. */
export type JsonCaller = <T>(req: JsonRequest<T>) => Promise<T>;

/* ──────────────────────────── JSON Schema helpers ──────────────────────────── */

/** A nullable string field — present in output (possibly null), per structured-output rules. */
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

function objectSchema(
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> {
  return { type: "object", additionalProperties: false, properties, required };
}

/* ──────────────────────────── A2: mine() ──────────────────────────── */

interface MinedPhrase {
  text: string;
  translation: string | null;
  note: string;
  segmentIndex: number;
}

interface MineResult {
  phrases: MinedPhrase[];
}

/** Cap how much transcript we hand the model in one pass; long videos still fit. */
const MAX_MINE_SEGMENTS = 400;

export function buildMineRequest(
  transcript: TranscriptSegment[],
  request: DiscoveryRequest,
  learnerLang: string,
): JsonRequest<MineResult> {
  const segments = transcript.slice(0, MAX_MINE_SEGMENTS);
  const numbered = segments
    .map((s, i) => `[${i}] ${s.text}`)
    .join("\n");

  const focusLine = request.focus?.trim()
    ? `The learner specifically wants: "${request.focus.trim()}". Bias selection heavily toward this, but still drop anything not actually worth learning.`
    : `No specific focus was given — pick the expressions a motivated learner would gain the most from (idioms, collocations, phrasal verbs, natural chunks), and skip trivial or one-off vocabulary.`;
  const levelLine = request.targetLevel?.trim()
    ? `Target English level: ${request.targetLevel.trim()}. Prefer phrases that are useful and appropriately challenging for that level; avoid items far below it unless they teach a high-value natural pattern.`
    : `No target English level was given; assume an intermediate learner and prefer broadly useful natural phrases.`;

  const targetMin = Math.max(5, Math.round(segments.length * 0.08));
  const targetMax = Math.max(targetMin + 2, Math.round(segments.length * 0.20));

  const system = [
    `You curate phrases worth learning from native ${request.targetLang} content for a language learner whose first language is ${learnerLang}.`,
    `Be generous: select any segment that contains something worth a learner's attention — a useful expression, natural phrasing, collocation, or construction — even if it's not exotic.`,
    `Concrete target: from ${segments.length} segments, aim to return ${targetMin}–${targetMax} phrases. Fewer than ${targetMin} is a red flag unless the source is almost entirely filler. Skip only segments that are purely filler, repetition, or trivially simple for the target level.`,
    `Only choose phrases that actually appear in the transcript — never invent or paraphrase into something that wasn't said.`,
  ].join(" ");

  const user = [
    levelLine,
    ``,
    focusLine,
    ``,
    `For each phrase you select, return:`,
    `- text: the expression exactly as it appears (you may trim surrounding filler, but keep the learnable chunk verbatim).`,
    `- translation: a short gloss in ${learnerLang}, or null if a gloss adds nothing.`,
    `- note: one line on why it's worth learning (the pattern it teaches, or how it matches the focus).`,
    `- segmentIndex: the [n] of the transcript line it came from, so we can cut the native audio clip.`,
    ``,
    `Transcript segments:`,
    numbered,
  ].join("\n");

  const schema = objectSchema(
    {
      phrases: {
        type: "array",
        items: objectSchema(
          {
            text: { type: "string" },
            translation: nullableString,
            note: { type: "string" },
            segmentIndex: { type: "integer" },
          },
          ["text", "translation", "note", "segmentIndex"],
        ),
      },
    },
    ["phrases"],
  );

  return { system, user, schema };
}

export function normalizeMined(
  raw: MineResult,
  transcript: TranscriptSegment[],
  request: DiscoveryRequest,
): PhraseCandidate[] {
  const now = Date.now();
  const out: PhraseCandidate[] = [];
  for (const p of raw.phrases ?? []) {
    const text = (p.text ?? "").trim();
    if (!text) continue;
    const seg =
      Number.isInteger(p.segmentIndex) && transcript[p.segmentIndex]
        ? transcript[p.segmentIndex]
        : undefined;
    out.push({
      id: crypto.randomUUID(),
      sourceId: request.source.id,
      text,
      translation: p.translation?.trim() || undefined,
      note: p.note?.trim() || undefined,
      status: "suggested",
      segmentIndex: seg ? p.segmentIndex : undefined,
      startMs: seg?.startMs,
      endMs: seg?.endMs,
      createdAt: now,
    });
  }
  return out;
}

/* ──────────────────────────── A3: generate() ──────────────────────────── */

interface GeneratedCard {
  front: string;
  back: string;
  concept: string;
  errorType: string | null;
}

interface GenerateResult {
  cards: GeneratedCard[];
}

/** The text a card must be grounded in — the verbatim source material (A6). */
export function sourceText(source: CardSource): string {
  return source.kind === "phrase"
    ? source.candidate.text
    : `Learner wrote: "${source.event.original}" — native-correct: "${source.event.corrected}"`;
}

export function buildGenerateRequest(
  source: CardSource,
  learnerLang: string,
): JsonRequest<GenerateResult> {
  const system = [
    `You write active-recall flashcards that test *understanding*, not literal recall or translation.`,
    `A good card forces the learner to apply a concept: a comprehension question, a cloze that hinges on the tricky element, or a "which is natural and why" prompt.`,
    `A bad card can be answered by rote memory of the surface string, or restates the source verbatim.`,
    `Every card must be grounded strictly in the provided source — never introduce facts, words, or claims that aren't supported by it.`,
  ].join(" ");

  const guidance =
    source.kind === "phrase"
      ? [
          `Source phrase (native, correct): "${source.candidate.text}"`,
          source.candidate.translation
            ? `Learner-language gloss: "${source.candidate.translation}"`
            : ``,
          source.candidate.note ? `Why it was picked: ${source.candidate.note}` : ``,
          ``,
          `Produce 1–2 cards that drill the concept this phrase teaches. The front may prompt in ${learnerLang} or the target language, whichever tests understanding better; the back is the native-correct answer.`,
          `Leave errorType null (this is the discovery path, not a correction).`,
        ]
      : [
          `The learner made a mistake. Original: "${source.event.original}". Native-correct: "${source.event.corrected}".`,
          source.event.rationale ? `Why it was wrong: ${source.event.rationale}` : ``,
          `Known error categories: ${source.event.errorTypes.join(", ") || "unspecified"}.`,
          ``,
          `Produce 1–2 cards that drill exactly the concept the learner got wrong — not the whole sentence.`,
          `Set errorType to the single category each card targets, from: ${ERROR_TYPES.join(", ")}.`,
        ];

  const user = [
    ...guidance.filter(Boolean),
    ``,
    `For each card return: front (the prompt), back (the native-correct answer), concept (the single thing it isolates, e.g. "preposition after a motion verb"), errorType (category or null).`,
  ].join("\n");

  const schema = objectSchema(
    {
      cards: {
        type: "array",
        items: objectSchema(
          {
            front: { type: "string" },
            back: { type: "string" },
            concept: { type: "string" },
            errorType: {
              anyOf: [{ type: "string", enum: ERROR_TYPES }, { type: "null" }],
            },
          },
          ["front", "back", "concept", "errorType"],
        ),
      },
    },
    ["cards"],
  );

  return { system, user, schema };
}

function sourceRef(source: CardSource): Card["source"] {
  return source.kind === "phrase"
    ? { kind: "phrase", id: source.candidate.id }
    : { kind: "error", id: source.event.id };
}

function coerceErrorType(value: string | null): ErrorType | undefined {
  return value && ERROR_TYPES.includes(value as ErrorType)
    ? (value as ErrorType)
    : undefined;
}

export function normalizeGenerated(raw: GenerateResult, source: CardSource): Card[] {
  const now = Date.now();
  const ref = sourceRef(source);
  const clip = source.kind === "phrase" ? source.candidate.audioClipPath : undefined;
  // Cards inherit their source's situational context (correction path only for now;
  // PhraseCandidate carries none yet). Set by code, like the source pointer.
  const context = source.kind === "error" ? source.event.context : undefined;
  const out: Card[] = [];
  for (const c of raw.cards ?? []) {
    const front = (c.front ?? "").trim();
    const back = (c.back ?? "").trim();
    if (!front || !back) continue;
    out.push({
      id: crypto.randomUUID(),
      front,
      back,
      concept: (c.concept ?? "").trim() || "unspecified",
      // Grounding (A6): the source pointer is set by code, not the model, so a
      // card can never claim a source it didn't come from.
      source: ref,
      errorType: source.kind === "error" ? coerceErrorType(c.errorType) : undefined,
      context,
      audioClipPath: clip,
      createdAt: now,
    });
  }
  return out;
}

/* ──────────────────────────── A4: critique() ──────────────────────────── */

interface CritiqueResult {
  verdict: string;
  reason: string;
  rewrite: { front: string; back: string; concept: string } | null;
}

export function buildCritiqueRequest(
  card: Card,
  source: CardSource,
): JsonRequest<CritiqueResult> {
  const system = [
    `You are the quality gate for language flashcards. You decide: keep, rewrite, or drop.`,
    `Drop a card if it is trivially answerable without understanding, restates the source, tests rote recall instead of a concept, or — critically — is NOT grounded in the source (any claim the source doesn't support is a hallucination and must be dropped or rewritten).`,
    `Rewrite a card that tests the right concept but does it weakly. Keep a card that already tests understanding and is fully grounded.`,
  ].join(" ");

  const user = [
    `Source material (the card must be grounded in this):`,
    sourceText(source),
    ``,
    `Card under review:`,
    `front: ${card.front}`,
    `back: ${card.back}`,
    `concept: ${card.concept}`,
    ``,
    `Return verdict (keep | rewrite | drop), a one-line reason, and — only when verdict is "rewrite" — an improved { front, back, concept }. Otherwise rewrite is null.`,
  ].join("\n");

  const schema = objectSchema(
    {
      verdict: { type: "string", enum: ["keep", "rewrite", "drop"] },
      reason: { type: "string" },
      rewrite: {
        anyOf: [
          objectSchema(
            {
              front: { type: "string" },
              back: { type: "string" },
              concept: { type: "string" },
            },
            ["front", "back", "concept"],
          ),
          { type: "null" },
        ],
      },
    },
    ["verdict", "reason", "rewrite"],
  );

  return { system, user, schema };
}

export function normalizeCritique(raw: CritiqueResult, card: Card): Critique {
  const verdict: CritiqueVerdict =
    raw.verdict === "keep" || raw.verdict === "rewrite" || raw.verdict === "drop"
      ? raw.verdict
      : "drop";
  const reason = (raw.reason ?? "").trim() || "no reason given";

  if (verdict === "rewrite" && raw.rewrite) {
    const front = (raw.rewrite.front ?? "").trim();
    const back = (raw.rewrite.back ?? "").trim();
    if (front && back) {
      return {
        verdict,
        reason,
        // The rewrite inherits the original card's grounding — same source, same clip.
        rewritten: {
          ...card,
          id: crypto.randomUUID(),
          front,
          back,
          concept: (raw.rewrite.concept ?? "").trim() || card.concept,
          source: card.source,
          createdAt: Date.now(),
        },
      };
    }
    // Asked for a rewrite but gave us nothing usable — fail safe to drop.
    return { verdict: "drop", reason: `${reason} (rewrite was empty)` };
  }

  return { verdict, reason };
}

/* ──────────────────────────── E2: correct() ──────────────────────────── */

interface CorrectedError {
  original: string;
  corrected: string;
  errorTypes: string[];
  rationale: string;
}

interface CorrectResult {
  /** Empty when the learner's text was already native-correct. */
  errors: CorrectedError[];
}

/**
 * The in-app correction brain (E2): take what the learner actually wrote or said and
 * surface every spot a native would phrase differently — one ErrorEvent per distinct
 * mistake, not one for the whole passage. This is what feeds the production-trend signal.
 */
export function buildCorrectRequest(
  text: string,
  learnerLang: string,
  targetLang: string,
  level?: string,
): JsonRequest<CorrectResult> {
  const rationaleLang = rationaleLanguage(learnerLang, targetLang, level);
  const system = [
    `You are a meticulous ${targetLang} tutor for a learner whose first language is ${learnerLang}.`,
    `The learner gives you something they wrote or said in ${targetLang}. Find each spot where a native speaker would phrase it differently and return one correction per distinct mistake.`,
    `Isolate mistakes: if a sentence has a wrong preposition AND a wrong tense, that's two corrections, each scoped to the smallest fragment that carries the error — never the whole passage.`,
    `Only flag real errors (grammar, collocation, naturalness, register) — not style preferences. If the text is already natural and correct, return an empty list.`,
    `The corrected field must be written only in ${targetLang}; never translate it into ${learnerLang}.`,
    `Never invent text the learner didn't write.`,
  ].join(" ");

  const user = [
    `Learner's ${targetLang}:`,
    `"""`,
    text,
    `"""`,
    ``,
    `For each mistake return:`,
    `- original: the exact fragment the learner wrote, verbatim.`,
    `- corrected: the native-correct ${targetLang} version of just that fragment; do not translate it into ${learnerLang}.`,
    `- errorTypes: one or more of: ${ERROR_TYPES.join(", ")}.`,
    `- rationale: one short line, in ${rationaleLang}, on why it was wrong / how to say it.`,
  ].join("\n");

  const schema = objectSchema(
    {
      errors: {
        type: "array",
        items: objectSchema(
          {
            original: { type: "string" },
            corrected: { type: "string" },
            errorTypes: {
              type: "array",
              items: { type: "string", enum: ERROR_TYPES },
            },
            rationale: { type: "string" },
          },
          ["original", "corrected", "errorTypes", "rationale"],
        ),
      },
    },
    ["errors"],
  );

  return { system, user, schema };
}

function rationaleLanguage(learnerLang: string, targetLang: string, level?: string): string {
  const cefr = level?.trim().toUpperCase();
  return cefr === "B2" || cefr === "C1" || cefr === "C2" ? targetLang : learnerLang;
}

/* ──────────────────────────── Conversation: converse() ──────────────────────────── */

/** Kickoff prompt used when there's no prior turn — the assistant opens the scenario. */
export const CONVERSATION_KICKOFF =
  "Let's begin — greet me in character and open the scenario with a question.";

/**
 * System prompt for a practice conversation. Provider-agnostic so Claude / GPT / Ollama
 * role-play identically. Two product commitments baked in: keep turns short so the learner
 * does most of the talking, and never correct mid-conversation — mistakes are reviewed
 * afterwards (Phase 2), so corrections don't break the flow.
 */
export function buildConverseSystem(opts: ConverseOptions): string {
  const sourceLang = opts.sourceLang || DEFAULT_LEARNER_LANG;
  const levelLine = opts.level
    ? `Pitch your language at CEFR ${opts.level}: natural but understandable at that level; avoid idioms or vocabulary clearly above it.`
    : `Assume an intermediate learner; keep your language natural but accessible.`;
  return [
    `You are a warm, encouraging conversation partner helping someone practice ${opts.targetLang} by speaking.`,
    `Role-play this scenario with them: "${opts.scenario}". Stay in character and speak only ${opts.targetLang}.`,
    levelLine,
    `Keep every one of your turns short — 1 to 3 sentences — and end with a question or prompt that invites them to respond, so they do most of the talking.`,
    `Do NOT correct their grammar or wording mid-conversation; just keep it flowing naturally. Their mistakes are reviewed separately afterwards.`,
    `If they get stuck or slip into ${sourceLang}, gently nudge them back into ${opts.targetLang} with a simpler rephrasing of your question.`,
  ].join(" ");
}

/**
 * Map the stored turn history to the `{ role, content }` shape both the Anthropic and
 * OpenAI-compatible SDKs accept. When there's no history yet, inject a single kickoff
 * user turn so the assistant opens the scenario (both APIs require a leading user message).
 */
export function conversationMessages(
  history: ConversationTurn[],
): { role: "user" | "assistant"; content: string }[] {
  if (history.length === 0) return [{ role: "user", content: CONVERSATION_KICKOFF }];
  return history.map((turn) => ({ role: turn.role, content: turn.text }));
}

export function normalizeCorrected(
  raw: CorrectResult,
  sourceLang: string,
  targetLang: string,
  context?: string,
): ErrorEvent[] {
  const now = Date.now();
  const out: ErrorEvent[] = [];
  for (const e of raw.errors ?? []) {
    const original = (e.original ?? "").trim();
    const corrected = (e.corrected ?? "").trim();
    // Drop non-corrections: no change means there was nothing to learn.
    if (!original || !corrected || original === corrected) continue;
    const types = (e.errorTypes ?? []).filter((t): t is ErrorType =>
      ERROR_TYPES.includes(t as ErrorType),
    );
    out.push({
      id: crypto.randomUUID(),
      original,
      corrected,
      errorTypes: types.length > 0 ? [...new Set(types)] : ["other"],
      sourceLang,
      targetLang,
      rationale: (e.rationale ?? "").trim() || undefined,
      context,
      createdAt: now,
    });
  }
  return out;
}
