import type { LessonComprehensionKind } from "@/features/learn/lessonDeck";

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
  /** True when the learner carried the language into a genuinely new situation. */
  newContext?: boolean;
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
  createdAt: number;
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
