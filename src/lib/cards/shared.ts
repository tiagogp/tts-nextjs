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
  AdvancedReview,
  Card,
  CardSource,
  Critique,
  CritiqueVerdict,
  DiscoveryRequest,
  ErrorEvent,
  ErrorType,
  PhraseCandidate,
  RefinementDimension,
  RefinementEvent,
  TranscriptSegment,
} from "./schema";
import type { ConversationTurn, ConverseOptions } from "./provider";

/** Default learner (L1) language for translation glosses when none is supplied. */
export const DEFAULT_LEARNER_LANG = "pt";

/** Default language being learned (the front of cards) when none is supplied. */
export const DEFAULT_TARGET_LANG = "en";

const ERROR_TYPES: ErrorType[] = [
  "collocation",
  "preposition",
  "tense",
  "article",
  "word-order",
  "idiom",
  "vocabulary",
  "register",
  "missing-information",
  "pronunciation",
  "other",
];

const REFINEMENT_DIMENSIONS: RefinementDimension[] = [
  "naturalness",
  "register",
  "idiom",
  "precision",
  "conciseness",
  "discourse",
  "collocation",
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
    ? `Target learner level — ${cefrLanguageLine(request.targetLevel)} Prefer phrases that are useful and appropriately challenging for this band; avoid items far below it unless they teach a high-value natural pattern.`
    : `No target level was given; assume an intermediate (B1) learner and prefer broadly useful natural phrases.`;

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
  targetLang: string,
  level?: string,
): JsonRequest<GenerateResult> {
  // B2+ learners get a monolingual card (target-language example sentence on the back);
  // below that, keep the bilingual native translation so the card stays understandable.
  const monolingual = isMonolingualLevel(level);
  const backSpec = monolingual
    ? `a natural ${targetLang} example sentence that uses it in context`
    : `its natural ${learnerLang} translation`;

  const system = monolingual
    ? [
        `You write monolingual ${targetLang} flashcards for a learner of ${targetLang} whose first language is ${learnerLang}.`,
        `Each card has the ${targetLang} expression on the front and a natural ${targetLang} example sentence that uses it on the back.`,
        `The back must be a complete, natural sentence written entirely in ${targetLang} that actually uses the front expression in context — never a translation into ${learnerLang}, and never a definition.`,
        `The front expression must be grounded strictly in the provided source — never introduce expressions or claims it doesn't support; the example sentence may be your own, but it must stay true to the expression's real meaning.`,
      ].join(" ")
    : [
        `You write bilingual flashcards for a learner of ${targetLang} whose first language is ${learnerLang}.`,
        `Each card has the ${targetLang} expression on the front and its natural ${learnerLang} translation on the back.`,
        `Translate the *meaning*, not word-for-word: the back must read like something a native ${learnerLang} speaker would actually say.`,
        `Every card must be grounded strictly in the provided source — never introduce words, expressions, or claims that aren't supported by it.`,
      ].join(" ");

  const guidance =
    source.kind === "phrase"
      ? [
          `Source phrase (in ${targetLang}, correct): "${source.candidate.text}"`,
          source.candidate.translation
            ? monolingual
              ? `Its meaning (${learnerLang} gloss, for your understanding only — do NOT put this on the card): "${source.candidate.translation}"`
              : `Existing ${learnerLang} gloss (improve if needed): "${source.candidate.translation}"`
            : ``,
          source.candidate.note ? `Why it was picked: ${source.candidate.note}` : ``,
          ``,
          `Produce 1–2 cards. front = the ${targetLang} expression (or the key chunk worth learning); back = ${backSpec}.`,
          `Leave errorType null (this is the discovery path, not a correction).`,
        ]
      : [
          `The learner made a mistake. Original: "${source.event.original}". Native-correct (${targetLang}): "${source.event.corrected}".`,
          source.event.rationale ? `Why it was wrong: ${source.event.rationale}` : ``,
          `Known error categories: ${source.event.errorTypes.join(", ") || "unspecified"}.`,
          ``,
          `Produce 1–2 cards focused on the corrected ${targetLang} expression. front = the native-correct ${targetLang} fragment; back = ${backSpec}.`,
          `Set errorType to the single category each card targets, from: ${ERROR_TYPES.join(", ")}.`,
        ];

  const user = [
    ...guidance.filter(Boolean),
    ``,
    `For each card return: front (the ${targetLang} expression), back (${backSpec}), concept (the single thing it isolates, e.g. "preposition after a motion verb"), errorType (category or null).`,
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
  level?: string,
): JsonRequest<CritiqueResult> {
  const monolingual = isMonolingualLevel(level);
  const system = monolingual
    ? [
        `You are the quality gate for monolingual flashcards: a target-language expression on the front, and a natural target-language example sentence that uses that expression on the back. You decide: keep, rewrite, or drop.`,
        `Keep a card whose front is a useful target-language expression and whose back is a correct, natural example sentence — in the same language as the front — that actually uses that expression. An example sentence is exactly what these cards are for — do NOT drop it for "not being a translation" or "not testing understanding".`,
        `Rewrite a card whose back is in the wrong language (e.g. translated into the learner's language), is a bare definition, doesn't actually use the front expression, is unnatural or awkward, or whose front carries needless filler.`,
        `Drop a card only if it is empty, the back is wrong or nonsensical, or — critically — the front is NOT grounded in the source (any expression the source doesn't support is a hallucination).`,
      ].join(" ")
    : [
        `You are the quality gate for bilingual flashcards (target-language front, native-language translation on the back). You decide: keep, rewrite, or drop.`,
        `Keep a card whose front is a useful target-language expression and whose back is a correct, natural translation. A faithful translation is exactly what these cards are for — do NOT drop it for "being a translation" or "not testing understanding".`,
        `Rewrite a card whose translation is wrong, awkward, or word-for-word, or whose front carries needless filler.`,
        `Drop a card only if it is empty, the translation is incorrect, or — critically — it is NOT grounded in the source (any expression the source doesn't support is a hallucination).`,
      ].join(" ");

  const user = [
    `Source material (the card must be grounded in this):`,
    sourceText(source),
    ``,
    `Card under review:`,
    monolingual
      ? `front (target-language expression): ${card.front}`
      : `front (target language): ${card.front}`,
    monolingual
      ? `back (target-language example sentence): ${card.back}`
      : `back (native translation): ${card.back}`,
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

export interface CorrectedError {
  original: string;
  corrected: string;
  errorTypes: string[];
  rationale: string;
}

interface CorrectResult {
  /** Empty when the learner's text was already native-correct. */
  errors: CorrectedError[];
}

export interface RawRefinement {
  original: string;
  suggested: string;
  dimension: string;
  rationale: string;
  impact: string | null;
}

export interface RawReviewSummary {
  strengths: string[];
  nextFocus: string | null;
}

export interface AdvancedReviewResult {
  errors: CorrectedError[];
  refinements: RawRefinement[];
  overall: RawReviewSummary | null;
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
    `The learner gives you something they wrote or said in ${targetLang}. Find the highest-signal mistakes first: communication-blocking meaning, missing information, recurring grammar, word order, or vocabulary problems. Return at most 3 corrections; do not enumerate minor polish that does not affect understanding.`,
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

/**
 * Advanced production review: keep the exact error contract from correction, but add
 * optional native-sounding upgrades for B2-C2 learners whose text may already be correct.
 */
export function buildAdvancedReviewRequest(
  text: string,
  learnerLang: string,
  targetLang: string,
  level?: string,
): JsonRequest<AdvancedReviewResult> {
  const rationaleLang = rationaleLanguage(learnerLang, targetLang, level);
  const levelLine = level?.trim()
    ? `Learner level: CEFR ${level.trim()}. For B2-C2, prioritize subtle naturalness, register, idiomaticity, discourse flow, and precision.`
    : `Assume an upper-intermediate to advanced learner.`;

  const system = [
    `You are a senior ${targetLang} language coach for a learner whose first language is ${learnerLang}.`,
    `Review what the learner wrote or said in ${targetLang}. Separate real errors from optional refinements.`,
    `Errors are objectively wrong or misleading fragments. Refinements are correct-but-less-native fragments where a native speaker would likely choose a stronger option.`,
    `Do not rewrite the whole passage. Return only the highest-signal items a motivated advanced learner can act on: at most 3 real errors and at most 3 optional refinements. Minor polish must never crowd out communication problems.`,
    `The corrected and suggested fields must be written only in ${targetLang}; never translate them into ${learnerLang}.`,
    `Never invent a topic, claim, or intent the learner did not express.`,
  ].join(" ");

  const user = [
    levelLine,
    ``,
    `Learner's ${targetLang}:`,
    `"""`,
    text,
    `"""`,
    ``,
    `Return:`,
    `- errors: up to 3 real mistakes, prioritized by communication impact. Use the same rules as correction: smallest exact original fragment, native-correct replacement, one or more errorTypes from ${ERROR_TYPES.join(", ")}, and a short rationale in ${rationaleLang}. Empty array if there are no real mistakes.`,
    `- refinements: 0 to 3 optional upgrades. Each original must be an exact fragment from the learner. suggested must preserve the learner's meaning while sounding more native, better registered, more precise, more idiomatic, or better connected. Do not include trivial preferences.`,
    `- overall: short strengths and the single nextFocus, or null if the text is too short to summarize.`,
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
      refinements: {
        type: "array",
        items: objectSchema(
          {
            original: { type: "string" },
            suggested: { type: "string" },
            dimension: { type: "string", enum: REFINEMENT_DIMENSIONS },
            rationale: { type: "string" },
            impact: nullableString,
          },
          ["original", "suggested", "dimension", "rationale", "impact"],
        ),
      },
      overall: {
        anyOf: [
          objectSchema(
            {
              strengths: {
                type: "array",
                items: { type: "string" },
              },
              nextFocus: nullableString,
            },
            ["strengths", "nextFocus"],
          ),
          { type: "null" },
        ],
      },
    },
    ["errors", "refinements", "overall"],
  );

  return { system, user, schema };
}

function rationaleLanguage(learnerLang: string, targetLang: string, level?: string): string {
  return isMonolingualLevel(level) ? targetLang : learnerLang;
}

/**
 * Whether cards for this CEFR level should be monolingual (target-language example
 * sentence on the back) rather than bilingual (native translation). B2 and above can
 * learn from target-language context; below that, a native translation keeps the card
 * understandable. Mirrors the rationale-language threshold in the correction path.
 */
export function isMonolingualLevel(level?: string): boolean {
  const cefr = level?.trim().toUpperCase();
  return cefr === "B2" || cefr === "C1" || cefr === "C2";
}

/**
 * Concrete, per-level descriptors of what language to use at each CEFR band. A bare
 * `"pitch at CEFR B1"` instruction makes models collapse everything below B2 into the
 * same simple register, so B1 ends up sounding like A1-A2. These spell out the gap:
 * sentence length, tense range, clause complexity, and vocabulary reach for each band.
 */
export const CEFR_LANGUAGE_PROFILE: Record<string, string> = {
  A1: `CEFR A1 (beginner): very short, simple sentences. Present simple, basic "can"/"want to". High-frequency everyday words only. One idea per sentence; no subordinate clauses.`,
  A2: `CEFR A2 (elementary): short, clear sentences. Present and past simple, "going to" future, basic connectors (and, but, because). Common everyday vocabulary; avoid idioms and abstract words.`,
  B1: `CEFR B1 (intermediate): noticeably richer than A2 — vary sentence length and use subordinate clauses (when, if, although, that). Mix present, past, present perfect, future, and conditionals. Express opinions, give reasons, and use common phrasal verbs and everyday collocations. Do NOT keep it to short beginner sentences.`,
  B2: `CEFR B2 (upper-intermediate): natural, fluent register with complex sentences, a full range of tenses, passive voice, and connected discourse. Use idiomatic expressions, nuance, and precise vocabulary; argue and qualify points naturally.`,
  C1: `CEFR C1 (advanced): sophisticated, idiomatic, near-native language. Flexible structure, subtle register shifts, and precise, less common vocabulary.`,
  C2: `CEFR C2 (mastery): fully native-like — idiomatic, nuanced, stylistically varied. No simplification of any kind.`,
};

/**
 * A concrete instruction telling a model how to pitch its language for a CEFR level.
 * Falls back to an intermediate default when no (or an unknown) level is given.
 */
export function cefrLanguageLine(level?: string): string {
  const cefr = level?.trim().toUpperCase();
  const profile = cefr ? CEFR_LANGUAGE_PROFILE[cefr] : undefined;
  return profile
    ? `Pitch your language precisely at this level — ${profile} Match this band; do not drift simpler or harder.`
    : `Assume an intermediate (B1) learner; keep your language natural but accessible, varying sentence length and using common connectors and tenses.`;
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
  const levelLine = cefrLanguageLine(opts.level);
  const depthLine = opts.followUpDepth === "counterpoint" || opts.challenge
    ? `Use an advanced, open conversation style: ask layered follow-up questions, request examples, introduce a mild counterpoint, and push the learner to clarify tradeoffs or defend a view. Keep it supportive, but do not let the exchange become a script.`
    : opts.followUpDepth === "layered"
      ? `Ask one clear follow-up after each answer. Invite one extra detail or reason, but do not introduce debate yet.`
      : `Keep every one of your turns short — 1 to 3 sentences — and end with one concrete question or prompt that invites them to respond, so they do most of the talking.`;
  const supportLine = opts.promptStyle
    ? `The learner's current speaking support is ${opts.conversationStage ?? "guided"}: ${opts.promptStyle}`
    : "Use a concrete, familiar prompt before increasing abstraction.";
  const speakerLine = opts.speakerFamiliarity === "unfamiliar"
    ? "Use natural but clearly articulated speech and occasional connected phrasing, as an unfamiliar real-world speaker would."
    : opts.speakerFamiliarity === "mixed"
      ? "Vary sentence length and use a few natural connectors while remaining easy to follow."
      : "Use familiar vocabulary and clearly signposted questions.";
  return [
    `You are a warm, encouraging conversation partner helping someone practice ${opts.targetLang} by speaking.`,
    `Role-play this scenario with them: "${opts.scenario}". Stay in character and speak only ${opts.targetLang}.`,
    levelLine,
    depthLine,
    supportLine,
    speakerLine,
    opts.maxTurns ? `This practice is limited to about ${opts.maxTurns} learner turns; make each follow-up purposeful.` : "",
    opts.challenge
      ? `Your turns may be 2 to 4 sentences when needed, but always end with a concrete prompt that makes the learner produce a longer answer.`
      : `Avoid turning this into an interview; vary your prompts naturally.`,
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
  for (const e of (raw.errors ?? []).slice(0, 3)) {
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

export function normalizeAdvancedReview(
  raw: AdvancedReviewResult,
  sourceLang: string,
  targetLang: string,
  context?: string,
): AdvancedReview {
  const now = Date.now();
  const errors = normalizeCorrected({ errors: raw.errors ?? [] }, sourceLang, targetLang, context);
  const refinements: RefinementEvent[] = [];
  const seen = new Set<string>();

  for (const r of (raw.refinements ?? []).slice(0, 3)) {
    const original = (r.original ?? "").trim();
    const suggested = (r.suggested ?? "").trim();
    if (!original || !suggested || original === suggested) continue;
    const dimension = REFINEMENT_DIMENSIONS.includes(r.dimension as RefinementDimension)
      ? (r.dimension as RefinementDimension)
      : "naturalness";
    const key = `${original}\n${suggested}\n${dimension}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refinements.push({
      id: crypto.randomUUID(),
      original,
      suggested,
      dimension,
      rationale: (r.rationale ?? "").trim() || undefined,
      impact: (r.impact ?? "").trim() || undefined,
      sourceLang,
      targetLang,
      context,
      createdAt: now,
    });
  }

  const strengths = (raw.overall?.strengths ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  const nextFocus = (raw.overall?.nextFocus ?? "").trim();

  return {
    errors,
    refinements,
    overall:
      strengths.length > 0 || nextFocus
        ? { strengths, nextFocus: nextFocus || undefined }
        : undefined,
  };
}
