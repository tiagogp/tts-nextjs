import type { LessonComprehensionKind } from "@/features/learn/lessonDeck";
import type { ErrorType } from "@/lib/cards/schema";
import type { JudgeStamp } from "@/lib/evaluation/judge";

export type TransferAttemptKind =
  | "phrase_to_situation"
  | "open_cloze"
  | "correction_recall"
  | "topic_retell"
  | "reading_to_meaning"
  | "listening_recognition"
  | "error_reconstruction";

export type TransferOutcome = "clear" | "needs_support";

/** Objective evidence from one transcript-hidden listening check. */
export interface ListeningAttempt {
  id: string;
  lessonId: string;
  sourceId: string;
  questions: { kind: LessonComprehensionKind; prompt: string }[];
  answers: (string | null)[];
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  mainIdeaCorrect: boolean;
  detailCorrect: number;
  detailTotal: number;
  playCounts: number[];
  transcriptVisible: boolean;
  playbackRate: number;
  speakerIds: string[];
  durationMs?: number;
  finished?: boolean;
  playbackRates?: number[];
  speakerFamiliarity?: "familiar" | "mixed" | "unfamiliar";
  subtitleUsed?: boolean;
  scaffoldUsed?: boolean;
  skipped?: boolean;
  startedAt: number;
  completedAt: number;
}

/** Evidence from an original written or spoken production. */
export interface ProductionAttempt {
  id: string;
  lessonId?: string;
  source: "lesson" | "correct" | "conversation" | "study";
  stage?: "repeat" | "production" | "retry";
  noticedPhraseId?: string;
  recordingId?: string;
  retryOf?: string;
  context?: string;
  prompt?: string;
  /** The focused feedback records this production was meant to address. */
  feedbackIds?: string[];
  transferKind?: TransferAttemptKind;
  transferSourceId?: string;
  transferOutcome?: TransferOutcome;
  /** Evaluated error categories found in this response; denominator is the attempt. */
  errorTypesFound?: ErrorType[];
  /** Whether the communicative task itself was completed, separate from language form. */
  taskCompleted?: boolean;
  /** Pattern intentionally elicited, for opportunity-adjusted error reporting. */
  targetPatternId?: string;
  /**
   * True when the learner **actually** carried the language into new content, as verified
   * by `verifyTransfer` against what they wrote — not when the prompt merely asked for it.
   * `undefined` when the item had no pattern to check against, which is the honest answer
   * and must not be read as `false`.
   */
  newContext?: boolean;
  /** Whether a transfer verdict was reachable at all. The denominator for the transfer rate. */
  transferVerified?: boolean;
  /** True when the learner retold or reconstructed meaning rather than copied it. */
  retold?: boolean;
  /** True when listening recognition was tested before revealing the text. */
  listeningRecognition?: boolean;
  /** Error IDs avoided in this production, when the prompt was error-driven. */
  avoidedErrorIds?: string[];
  comprehensionScore?: number;
  writingScore?: number;
  /** Evidence about support and fluency, kept separate from method minutes. */
  scaffoldUsed?: boolean;
  preparationMs?: number;
  skipped?: boolean;
  fluency?: {
    wordsPerMinute: number;
    pauseCount?: number;
    longestPauseMs?: number;
  };
  durationMs?: number;
  text: string;
  spoken: boolean;
  wordCount: number;
  finished: boolean;
  issueCount: number;
  /** False for open-production transfer work that has not been evaluated. */
  evaluated?: boolean;
  /**
   * Who reached the verdict and with what. Absent means nothing judged this attempt —
   * never "a local check passed it". See `src/lib/evaluation/judge.ts`.
   */
  judge?: JudgeStamp;
  createdAt: number;
}

/**
 * One item from the proof queue (Queue C). Deliberately not a `ReviewRecord`: a proof must
 * never reach FSRS, or measuring the learner changes what is measured. See `proofQueue.ts`.
 */
export interface ProofAttempt {
  id: string;
  cardId: string;
  /** Which retention horizon this attempt tests. */
  targetDays: 7 | 30 | 60;
  /** Days since the learner first studied the item, at the moment of the proof. */
  ageDays: number;
  /** What the learner produced, with no hint, no reveal and no audio. */
  response: string;
  /**
   * `undefined` when the local check could not judge — a response that may be a valid
   * paraphrase the card never listed. Excluded from the rate rather than scored as a miss.
   */
  correct?: boolean;
  /** Which check produced the verdict, so a provider-scored proof is distinguishable. */
  evaluatedBy: "local" | "provider";
  /** The same fact with the detail a longitudinal window needs: model and rubric version. */
  judge?: JudgeStamp;
  patternId?: string;
  askedAt: number;
  answeredAt: number;
}

/** Evidence that the learner acted on a specific feedback result. */
export interface RetryOutcome {
  id: string;
  retryOf: string;
  /** One or two focused feedback records; retryOf remains the parent attempt. */
  feedbackIds?: string[];
  source: "lesson" | "correct" | "conversation";
  /** The audio used for this retry, when it was spoken. */
  recordingId?: string;
  text: string;
  spoken: boolean;
  wordCount: number;
  durationMs?: number;
  resolved: boolean;
  resolution?: "completed" | "deferred" | "dismissed";
  issueCount: number;
  scaffoldUsed?: boolean;
  skipped?: boolean;
  createdAt: number;
}

/** A bounded local recording that can be replayed beside a later attempt. */
export interface AudioRecording {
  id: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}
