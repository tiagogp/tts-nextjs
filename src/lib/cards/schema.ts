/**
 * The contract between ingestion, card generation, and the .apkg export engine.
 *
 * Two ingestion paths feed the same Card output:
 *   1. CORRECTION  — your own mistakes (ErrorEvent), captured by the native-correction tool.
 *   2. DISCOVERY   — phrases worth learning (PhraseCandidate), mined from native content
 *                    such as YouTube. This is the priority path.
 *
 * ErrorEvent and PhraseCandidate are the source of truth; Card is derived data.
 * Persisting the sources — not just Cards — is what makes weakness detection possible later.
 */

/* ──────────────────────────── Path 1: correction ──────────────────────────── */

/** Category of mistake, emitted by the native-correction tool. Extend as the tool learns more. */
export type ErrorType =
  | "collocation"
  | "preposition"
  | "tense"
  | "article"
  | "word-order"
  | "idiom"
  | "vocabulary"
  | "register"
  | "missing-information"
  | "pronunciation"
  | "other";

/** One captured mistake: what the learner said vs. how a native would say it. */
export interface ErrorEvent {
  id: string;
  /** What the learner originally wrote/said. */
  original: string;
  /** The native-correct version. */
  corrected: string;
  /** Categories this mistake falls under (a single correction can span several). */
  errorTypes: ErrorType[];
  /** Source language / target language, e.g. "pt" -> "en". */
  sourceLang: string;
  targetLang: string;
  /** Free-form note from the correction tool (why it was wrong). Optional. */
  rationale?: string;
  /**
   * Situational context the mistake happened in, normalized (e.g. "work",
   * "restaurant", "job-interview"). Orthogonal to `errorType` (the grammatical
   * category): it's *where* you got stuck, not *what* was wrong. Drives
   * context-grouped weakness detection and context-targeted generation. A
   * conversation stamps every error it produces with its scenario.
   */
  context?: string;
  createdAt: number;
}

/* ──────────────────────────── Advanced refinement ──────────────────────────── */

export type RefinementDimension =
  | "naturalness"
  | "register"
  | "idiom"
  | "precision"
  | "conciseness"
  | "discourse"
  | "collocation";

/**
 * A high-signal upgrade for text that may already be correct. Unlike ErrorEvent, this is
 * not a weakness/drill source by default; it is coaching for advanced naturalness.
 */
export interface RefinementEvent {
  id: string;
  original: string;
  suggested: string;
  dimension: RefinementDimension;
  rationale?: string;
  impact?: string;
  sourceLang: string;
  targetLang: string;
  context?: string;
  createdAt: number;
}

export interface AdvancedReviewSummary {
  strengths: string[];
  nextFocus?: string;
}

export interface AdvancedReview {
  errors: ErrorEvent[];
  refinements: RefinementEvent[];
  overall?: AdvancedReviewSummary;
}

/* ──────────────────────────── Path 2: discovery ──────────────────────────── */

/**
 * A piece of native content ingested to mine phrases from.
 * Audio-only by design — the video is never downloaded; only the audio carries learning value.
 */
export interface ContentSource {
  id: string;
  kind: "youtube" | "podcast" | "audio" | "article" | "pdf";
  title: string;
  url?: string;
  /** Path to the extracted audio (mp3/m4a). yt-dlp downloads audio only, never the mp4. */
  audioPath?: string;
  /** Language of the content (the target language being learned). */
  lang: string;
  createdAt: number;
}

/** One timestamped chunk of a transcript, from YouTube captions or Whisper. */
export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * A discovery run: mine phrases from one source, optionally steered by what the user
 * specifically wants. The LLM uses `focus` to bias selection.
 */
export interface DiscoveryRequest {
  source: ContentSource;
  /** What the learner specifically wants to extract. Empty = let the LLM decide what's useful. */
  focus?: string;
  /** Learner level the selection should target, e.g. A2/B1/B2/C1. */
  targetLevel?: string;
  targetLang: string;
}

/** Human-in-the-loop review state. The LLM emits "suggested"; the user decides the rest. */
export type PhraseStatus = "suggested" | "accepted" | "rejected";

/** A phrase/expression worth learning, mined from a ContentSource. */
export interface PhraseCandidate {
  id: string;
  sourceId: string; // ContentSource.id
  /** The phrase in the target language. */
  text: string;
  /** Optional gloss in the learner's language. */
  translation?: string;
  /** Why the LLM picked it (idiom, useful collocation, matches the user's focus, …). */
  note?: string;
  /** Review state — drives the accept/reject/edit UI. Only "accepted" candidates become cards. */
  status: PhraseStatus;
  /** Index of the transcript segment that produced this candidate, when known. */
  segmentIndex?: number;
  /**
   * Exact slice of the source audio. With Whisper timestamps we cut the real native clip
   * for this phrase and embed it in the card — authentic audio, not TTS.
   */
  startMs?: number;
  endMs?: number;
  audioClipPath?: string;
  createdAt: number;
}

/* ──────────────────────────── Convergence: cards ──────────────────────────── */

/**
 * Coarse skill a card mostly trains (Phase 2 #6). Deliberately small: it's a derived,
 * weakly-held tag used to surface per-skill state, not a taxonomy. See `skillOfCard`.
 */
export type Skill = "vocabulary" | "grammar" | "listening" | "speaking";

/** Where a card came from — grounding / anti-hallucination, regardless of ingestion path. */
export interface CardSourceRef {
  kind: "error" | "phrase";
  /** id of the ErrorEvent or PhraseCandidate that produced the card. */
  id: string;
}

/** Either ingestion path, passed to a provider to generate cards from. */
export type CardSource =
  | { kind: "error"; event: ErrorEvent }
  | { kind: "phrase"; candidate: PhraseCandidate };

/** A generated flashcard, ready to be serialized to CSV/JSON for apkg_from_csv.py. */
export interface Card {
  id: string;
  /** Prompt that tests understanding, not literal recall. */
  front: string;
  /** The native-correct answer. Audio (TTS, or a native clip for discovery) is added downstream. */
  back: string;
  /** The single concept this card isolates, e.g. "preposition after a motion verb". */
  concept: string;
  /** Set for correction-path cards; undefined for discovery-path cards. */
  errorType?: ErrorType;
  /**
   * Coarse skill this card mostly exercises (Phase 2 #6). Optional and derive-on-read:
   * when absent, `skillOfCard` infers it from audio/errorType. Tagging at generation time
   * is just a cache.
   */
  skill?: Skill;
  /** Situational context inherited from the source (see `ErrorEvent.context`). */
  context?: string;
  /** Pointer back to the source — grounding / anti-hallucination. */
  source: CardSourceRef;
  /** When a native audio clip is available (discovery path), the path to embed. */
  audioClipPath?: string;
  createdAt: number;
}

/* ──────────────────────────── Quality gate ──────────────────────────── */

/** Verdict from the automatic quality gate. */
export type CritiqueVerdict = "keep" | "rewrite" | "drop";

export interface Critique {
  verdict: CritiqueVerdict;
  /** Why — e.g. "answerable without understanding", "redundant", "not grounded in source". */
  reason: string;
  /** Present when verdict === "rewrite": the improved card. */
  rewritten?: Card;
}
