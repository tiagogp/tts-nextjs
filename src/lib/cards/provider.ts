/**
 * Generation provider abstraction.
 *
 * The pipeline past generate() is provider-agnostic — it never branches on which provider
 * is running. The user picks "run locally" vs "use Claude/GPT" at runtime; everything else
 * (persistence, dedup, export) stays the same.
 */

import type {
  Card,
  CardSource,
  Critique,
  DiscoveryRequest,
  ErrorEvent,
  PhraseCandidate,
  TranscriptSegment,
} from "./schema";
import { dedupeCards, type Embedder } from "./dedupe";

export interface GenerationRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** What `correct()` needs to tag the resulting ErrorEvents with the right language pair. */
export interface CorrectOptions {
  /** Learner's first language, for the rationale. Default from the provider. */
  sourceLang?: string;
  /** Language being learned / corrected. Default "en". */
  targetLang?: string;
  /** Situational context to stamp on every ErrorEvent found (already normalized). */
  context?: string;
}

export type ProviderKind = "local" | "ollama" | "claude" | "openai";

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
   * model-backed providers implement it — the local provider can't judge open text, so
   * callers must check for its presence and surface a "pick Claude/GPT" message.
   */
  correct?(
    text: string,
    opts?: CorrectOptions,
    options?: GenerationRunOptions,
  ): Promise<ErrorEvent[]>;

  /**
   * Optional embedder for semantic dedup (A5). Providers with an embeddings backend
   * (OpenAI) implement it for true paraphrase-aware dedup; others omit it and the
   * pipeline falls back to a lexical comparison.
   */
  embed?: Embedder;
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
  const candidates = await provider.generate(source, options);
  const kept: Card[] = [];
  for (const card of candidates) {
    throwIfAborted(options.signal);
    if (kept.length >= MAX_CARDS_PER_SOURCE) break;
    // A6: drop anything not traceable to this exact source.
    if (!isSourceGrounded(card, source)) continue;
    // Slow local LLMs opt out of the critique round-trip — grounding + the card cap are
    // the only gates that remain (see CardGenerationProvider.skipCritique).
    if (provider.skipCritique) {
      kept.push(card);
      continue;
    }
    let critique: Critique;
    try {
      critique = await provider.critique(card, source, options);
    } catch (err) {
      if (isAbortError(err)) throw err;
      // A transient critique failure (rate limit, refusal, malformed JSON) drops just
      // this card rather than failing the source — the quality gate erring toward "drop".
      console.error("Critique failed; dropping card:", err);
      continue;
    }
    if (critique.verdict === "keep") kept.push(card);
    else if (critique.verdict === "rewrite" && critique.rewritten) kept.push(critique.rewritten);
    // "drop" -> discard
  }
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
  const perSource = await mapWithConcurrency(sources, GENERATE_CONCURRENCY, async (source) => {
    try {
      return await generateVettedCards(provider, source, options);
    } catch (err) {
      if (isAbortError(err)) throw err;
      failures++;
      console.error("Card generation failed for one source:", err);
      return [] as Card[];
    }
  }, options.signal);
  throwIfAborted(options.signal);
  const cards = await dedupeCards(perSource.flat(), provider.embed?.bind(provider), options);
  return { cards, failures };
}
