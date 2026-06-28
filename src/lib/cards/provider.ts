/**
 * Generation provider abstraction.
 *
 * The pipeline past generate() is provider-agnostic — it never branches on which provider
 * is running. The user picks "run locally" vs "use Claude/GPT" at runtime; everything else
 * (persistence, dedup, export) stays the same.
 */

import type {
  AdvancedReview,
  Card,
  CardSource,
  Critique,
  DiscoveryRequest,
  ErrorEvent,
  PhraseCandidate,
  TranscriptSegment,
} from "./schema";
import { dedupeCards, type Embedder } from "./dedupe";
import { logger } from "@/lib/logger";

export interface GenerationRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  debug?: (event: string, details?: Record<string, unknown>) => void;
}

/** What `correct()` needs to tag the resulting ErrorEvents with the right language pair. */
export interface CorrectOptions {
  /** Learner's first language, for the rationale. Default from the provider. */
  sourceLang?: string;
  /** Language being learned / corrected. Default "en". */
  targetLang?: string;
  /** CEFR level, used to decide how much explanation can stay in the target language. */
  level?: string;
  /** Situational context to stamp on every ErrorEvent found (already normalized). */
  context?: string;
}

/** One exchanged message in a practice conversation. */
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

/** What `converse()` needs to role-play a scenario at the learner's level. */
export interface ConverseOptions {
  /** The scenario being role-played (also the situational context tag downstream). */
  scenario: string;
  /** Language being practiced, e.g. "en". */
  targetLang: string;
  /** Learner's first language, for gentle scaffolding. Default from the provider. */
  sourceLang?: string;
  /** CEFR level to pitch difficulty at, e.g. "B1". */
  level?: string;
  /** For advanced practice: press the learner with follow-ups and counterpoints. */
  challenge?: boolean;
}

export type ProviderKind = "openrouter" | "ollama" | "claude" | "openai";

export interface CardGenerationProvider {
  readonly kind: ProviderKind;
  /** Human-readable label for the UI selector. */
  readonly label: string;
  /** True when generation happens on-device and no data leaves the machine. */
  readonly isLocal: boolean;
  /**
   * Skip the per-card critique() pass during vetting. Set for slow local LLMs (Ollama),
   * where the extra round-trip per card multiplies wall time and the model's structured
   * output isn't reliable enough to justify the cost — grounding + the per-source card cap
   * are the only gates that remain. Cloud providers leave this unset and keep full vetting.
   */
  readonly skipCritique?: boolean;

  /**
   * Discovery path, step 2. Whisper already extracted the full transcript; pick the subset
   * worth learning, biased by request.focus. Output is "suggested" — the user reviews next.
   */
  mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
    options?: GenerationRunOptions,
  ): Promise<PhraseCandidate[]>;

  /** Turn one source (a mistake or an accepted phrase) into candidate cards (usually 1–3). */
  generate(source: CardSource, options?: GenerationRunOptions): Promise<Card[]>;

  /**
   * The quality gate. Decide whether a card tests understanding (keep), needs fixing
   * (rewrite), or is redundant/ungrounded/trivially answerable (drop).
   * This second pass is the core differentiator over "dump text, ask for 20 cards" tools.
   */
  critique(
    card: Card,
    source: CardSource,
    options?: GenerationRunOptions,
  ): Promise<Critique>;

  /**
   * E2 — correction ingestion. Evaluate free text the learner wrote or said and return
   * one ErrorEvent per mistake (empty if it was already native-correct). Optional: only
   * model-backed providers implement it, so callers must check for its presence before use.
   */
  correct?(
    text: string,
    opts?: CorrectOptions,
    options?: GenerationRunOptions,
  ): Promise<ErrorEvent[]>;

  /**
   * Advanced production review. Returns real mistakes plus optional native-sounding
   * refinements for text that may already be correct. Kept separate from correct() so
   * refinements don't pollute weakness detection or automatic card generation.
   */
  review?(
    text: string,
    opts?: CorrectOptions,
    options?: GenerationRunOptions,
  ): Promise<AdvancedReview>;

  /**
   * Conversation path — produce the assistant's next turn in a role-played scenario, in the
   * target language at the learner's level. Optional and gated like correct(): only
   * model-backed providers implement it, so callers must check for its presence before use.
   */
  converse?(
    history: ConversationTurn[],
    opts: ConverseOptions,
    options?: GenerationRunOptions,
  ): Promise<string>;

  /**
   * Single-turn free-text generation. The prompt is sent as-is with no system-level
   * role-play framing — use this for structured tasks like plan generation where the
   * prompt already encodes all instructions. Optional: only model-backed providers
   * implement it.
   */
  complete?(
    prompt: string,
    options?: GenerationRunOptions,
  ): Promise<string>;

  /**
   * Optional embedder for semantic dedup (A5). Providers with an embeddings backend
   * (OpenAI) implement it for true paraphrase-aware dedup; others omit it and the
   * pipeline falls back to a lexical comparison.
   */
  embed?: Embedder;
  /** Stable provider/model namespace for the in-memory embeddings cache. */
  readonly embeddingCacheKey?: string;
}

/** Registry so the UI can list available providers and resolve the user's choice. */
export type ProviderRegistry = Record<ProviderKind, () => CardGenerationProvider>;

/**
 * Grounding (A6) — structural integrity check. A card must point back to the exact
 * source it was generated from; anything else is a fabricated provenance and is dropped
 * before it can reach the learner. (Semantic grounding — "does the answer follow from the
 * source" — is enforced by the provider's critique pass.)
 */
function isSourceGrounded(card: Card, source: CardSource): boolean {
  if (source.kind === "phrase") {
    return card.source.kind === "phrase" && card.source.id === source.candidate.id;
  }
  return card.source.kind === "error" && card.source.id === source.event.id;
}

/**
 * Run the full generate -> ground -> critique gate for one source (mistake or mined phrase).
 * Provider-agnostic and ingestion-agnostic: identical for local or cloud, error or discovery.
 *
 * `generate()` failing throws (the caller decides whether to drop the whole source); a single
 * card's `critique()` failing only drops *that* card, so one bad round-trip can't waste the
 * other cards we already paid to generate from this source.
 */
/**
 * Cap cards kept per source. Bounds both the critique round-trips and the per-card TTS
 * synthesis in the .apkg step, so one verbose source can't blow the request timeout.
 */
const MAX_CARDS_PER_SOURCE = 2;

function sourceDebugInfo(source: CardSource): Record<string, unknown> {
  if (source.kind === "phrase") {
    return {
      sourceKind: "phrase",
      sourceId: source.candidate.id,
      textChars: source.candidate.text.length,
      hasTimestamps: source.candidate.startMs != null && source.candidate.endMs != null,
    };
  }
  return {
    sourceKind: "error",
    sourceId: source.event.id,
    originalChars: source.event.original.length,
    correctedChars: source.event.corrected.length,
    errorTypes: source.event.errorTypes,
  };
}

function debug(
  options: GenerationRunOptions,
  event: string,
  details: Record<string, unknown> = {},
): void {
  options.debug?.(event, details);
}

async function withPendingDebug<T>(
  options: GenerationRunOptions,
  eventBase: string,
  details: Record<string, unknown>,
  task: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    debug(options, `${eventBase}-still-running`, {
      ...details,
      elapsedMs: Date.now() - startedAt,
      ticks,
    });
  }, 10_000);
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

function abortError(): Error {
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export async function generateVettedCards(
  provider: CardGenerationProvider,
  source: CardSource,
  options: GenerationRunOptions = {},
): Promise<Card[]> {
  throwIfAborted(options.signal);
  const sourceInfo = sourceDebugInfo(source);
  const startedAt = Date.now();
  debug(options, "cards-source-generate-started", {
    provider: provider.kind,
    ...sourceInfo,
  });
  const candidates = await withPendingDebug(options, "cards-source-generate", {
    provider: provider.kind,
    ...sourceInfo,
  }, () => provider.generate(source, options));
  debug(options, "cards-source-generate-finished", {
    provider: provider.kind,
    candidates: candidates.length,
    durationMs: Date.now() - startedAt,
    ...sourceInfo,
  });
  const kept: Card[] = [];
  let candidateIndex = 0;
  for (const card of candidates) {
    candidateIndex += 1;
    throwIfAborted(options.signal);
    if (kept.length >= MAX_CARDS_PER_SOURCE) break;
    // A6: drop anything not traceable to this exact source.
    if (!isSourceGrounded(card, source)) {
      debug(options, "cards-candidate-dropped-ungrounded", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        cardSourceKind: card.source.kind,
        cardSourceId: card.source.id,
        ...sourceInfo,
      });
      continue;
    }
    // Slow local LLMs opt out of the critique round-trip — grounding + the card cap are
    // the only gates that remain (see CardGenerationProvider.skipCritique).
    if (provider.skipCritique) {
      kept.push(card);
      debug(options, "cards-candidate-kept-skip-critique", {
        provider: provider.kind,
        candidateIndex,
        kept: kept.length,
        cardId: card.id,
        ...sourceInfo,
      });
      continue;
    }
    let critique: Critique;
    const critiqueStartedAt = Date.now();
    try {
      debug(options, "cards-candidate-critique-started", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        ...sourceInfo,
      });
      critique = await withPendingDebug(options, "cards-candidate-critique", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        ...sourceInfo,
      }, () => provider.critique(card, source, options));
    } catch (err) {
      if (isAbortError(err)) throw err;
      // A transient critique failure (rate limit, refusal, malformed JSON) drops just
      // this card rather than failing the source — the quality gate erring toward "drop".
      logger.error({ err }, "Critique failed; dropping card");
      debug(options, "cards-candidate-critique-failed", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        error: err instanceof Error ? err.message : "unknown",
        durationMs: Date.now() - critiqueStartedAt,
        ...sourceInfo,
      });
      continue;
    }
    debug(options, "cards-candidate-critique-finished", {
      provider: provider.kind,
      candidateIndex,
      cardId: card.id,
      verdict: critique.verdict,
      durationMs: Date.now() - critiqueStartedAt,
      ...sourceInfo,
    });
    if (critique.verdict === "keep") {
      kept.push(card);
    } else if (critique.verdict === "rewrite" && critique.rewritten) {
      kept.push(critique.rewritten);
      debug(options, "cards-candidate-rewritten", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        rewrittenId: critique.rewritten.id,
        durationMs: Date.now() - critiqueStartedAt,
        ...sourceInfo,
      });
    } else {
      debug(options, "cards-candidate-dropped-verdict", {
        provider: provider.kind,
        candidateIndex,
        cardId: card.id,
        verdict: critique.verdict,
        reason: (critique as { reason?: string }).reason ?? null,
        durationMs: Date.now() - critiqueStartedAt,
        ...sourceInfo,
      });
    }
  }
  debug(options, "cards-source-vetting-finished", {
    provider: provider.kind,
    candidates: candidates.length,
    kept: kept.length,
    durationMs: Date.now() - startedAt,
    ...sourceInfo,
  });
  return kept;
}

/** Result of a full deck build: the vetted cards plus how many sources failed outright. */
export interface DeckResult {
  cards: Card[];
  /** Sources whose generation threw and produced no cards (surfaced as a partial result). */
  failures: number;
}

/** Sources vetted in parallel, capped so a cloud provider's rate limits aren't blown. */
const GENERATE_CONCURRENCY = 5;

/**
 * Run `fn` over `items` with at most `limit` in flight at once. Preserves input order and
 * never rejects partway — each call's success/failure is the caller's to handle inside `fn`.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      throwIfAborted(signal);
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Full deck build across many sources: vet each source independently (in parallel, bounded),
 * then run semantic dedup (A5) across the combined set to kill near-duplicate cards. This is
 * the entry point the "Generate cards →" wiring (B1) calls once it has the accepted phrases /
 * error events.
 *
 * Sources are vetted concurrently so a cloud provider's per-card round-trips don't run
 * end-to-end-serial and blow the request timeout. A source that fails outright is counted,
 * not fatal: the rest still produce a deck (a partial result beats all-or-nothing).
 */
export async function generateDeck(
  provider: CardGenerationProvider,
  sources: CardSource[],
  options: GenerationRunOptions = {},
): Promise<DeckResult> {
  let failures = 0;
  const startedAt = Date.now();
  debug(options, "cards-deck-generate-started", {
    provider: provider.kind,
    sources: sources.length,
    concurrency: GENERATE_CONCURRENCY,
    timeoutMs: options.timeoutMs,
    skipCritique: provider.skipCritique === true,
  });
  const perSource = await mapWithConcurrency(sources, GENERATE_CONCURRENCY, async (source) => {
    const sourceInfo = sourceDebugInfo(source);
    try {
      debug(options, "cards-source-worker-started", {
        provider: provider.kind,
        ...sourceInfo,
      });
      return await generateVettedCards(provider, source, options);
    } catch (err) {
      if (isAbortError(err)) throw err;
      failures++;
      logger.error({ err }, "Card generation failed for one source");
      debug(options, "cards-source-worker-failed", {
        provider: provider.kind,
        error: err instanceof Error ? err.message : "unknown",
        failures,
        ...sourceInfo,
      });
      return [] as Card[];
    }
  }, options.signal);
  throwIfAborted(options.signal);
  const beforeDedupe = perSource.flat();
  debug(options, "cards-dedupe-started", {
    provider: provider.kind,
    cards: beforeDedupe.length,
    hasEmbedder: provider.embed != null,
  });
  const cards = await dedupeCards(
    beforeDedupe,
    provider.embed?.bind(provider),
    options,
    provider.embeddingCacheKey ?? provider.kind,
  );
  debug(options, "cards-dedupe-finished", {
    provider: provider.kind,
    before: beforeDedupe.length,
    after: cards.length,
    failures,
    durationMs: Date.now() - startedAt,
  });
  return { cards, failures };
}
