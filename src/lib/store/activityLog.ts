import { nanoid } from "nanoid";
import type { ActivationTiming, FirstRunActivationSource } from "@/features/activation/firstRun";
import { STORES, get, getAll, getAllFromIndex, put } from "./db";

export type ActivityEventType =
  | "first_run_started"
  | "method_stage"
  | "cards_reviewed"
  | "video_processed"
  | "conversation_turn"
  | "mistake_submitted"
  | "correction_generated"
  | "cards_created"
  | "own_source_started"
  | "own_source_completed"
  | "progress_checkin"
  | "c1_diagnosis_completed"
  | "level_test_completed"
  | "listening_attempt"
  | "production_attempt"
  | "retry_outcome";

export interface FirstRunStartedPayload {
  source: FirstRunActivationSource;
  sourceId?: string;
}

export interface MethodStagePayload {
  stage:
    | "learn"
    | "listen"
    | "notice"
    | "repeat"
    | "speak"
    | "feedback"
    | "retry"
    | "review";
  area: "structured" | "listening" | "speaking" | "readingWriting";
  source: "home" | "lesson" | "discover" | "study" | "correct" | "pronunciation" | "converse";
  /**
   * The canonical minute ledger for the method balance. Every stage that costs the
   * learner time emits one of these; `learningLoop` counts nothing else twice.
   *
   * Measured, not assumed — `useStageTimer` reports the focused, non-idle time the stage
   * actually took, clamped by `MAX_STAGE_MINUTES`. Optional because events logged before
   * measurement existed carry no value; those fall back to `DEFAULT_STAGE_MINUTES`.
   */
  minutes?: number;
  subjectId?: string;
}

export interface CardsReviewedPayload {
  count: number;
  cardIds: string[];
  activation?: ActivationTiming;
}

export interface VideoProcessedPayload {
  sourceUrl: string;
  cardsCreated: number;
}

export interface ConversationTurnPayload {
  conversationId: string;
  scenarioId: string;
  turnIndex: number;
}

/** The learner submitted a sentence to be corrected during the first learning loop. */
export interface MistakeSubmittedPayload {
  source: "lesson" | "correct";
  lessonId?: string;
}

export interface CorrectionGeneratedPayload {
  cardsCreated: number;
  source: "manual" | "json" | "ai" | "lesson";
}

export interface CardsCreatedPayload {
  count: number;
  source: "discover" | "correct" | "converse" | "learn";
  activation?: ActivationTiming;
}

/** The learner kicked off an own-source import (any run, not just the first). */
export interface OwnSourceStartedPayload {
  sourceKind: "youtube" | "article" | "pdf";
  sourceId?: string;
}

/** Own-source cards were saved, completing the own-material import funnel. */
export interface OwnSourceCompletedPayload {
  cardsCreated: number;
}

export interface ProgressCheckinPayload {
  assessmentId: string;
  levelEstimate: string;
  errorsFound: number;
}

/** A C1 writing sample was reviewed for register/naturalness/collocation gaps (experimental). */
export interface C1DiagnosisCompletedPayload {
  domain: string;
  errorsFound: number;
  dimensionsFlagged: number;
}

/** A level-up test finished — passed or not. On a pass the profile level was advanced. */
export interface LevelTestCompletedPayload {
  attemptId: string;
  fromLevel: string;
  targetLevel: string;
  passed: boolean;
  score: number;
}

export interface ListeningAttemptPayload {
  attemptId: string;
  lessonId: string;
  sourceId: string;
  questions: { kind: "mainIdea" | "detail" | "sequence"; prompt: string }[];
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
  startedAt?: number;
  completedAt: number;
}

export interface ProductionAttemptPayload {
  attemptId: string;
  lessonId?: string;
  source: "lesson" | "correct" | "conversation" | "study";
  context?: string;
  prompt?: string;
  durationMs?: number;
  text: string;
  spoken: boolean;
  recordingId?: string;
  wordCount: number;
  finished: boolean;
  issueCount: number;
  evaluated?: boolean;
  stage?: "repeat" | "production" | "retry";
  retryOf?: string;
  noticedPhraseId?: string;
  feedbackIds?: string[];
  transferKind?: "phrase_to_situation" | "open_cloze" | "correction_recall" | "topic_retell" | "reading_to_meaning" | "listening_recognition" | "error_reconstruction";
  transferSourceId?: string;
  transferOutcome?: "clear" | "needs_support";
  newContext?: boolean;
  retold?: boolean;
  listeningRecognition?: boolean;
  avoidedErrorIds?: string[];
  comprehensionScore?: number;
  writingScore?: number;
  scaffoldUsed?: boolean;
  preparationMs?: number;
  skipped?: boolean;
  fluency?: {
    wordsPerMinute: number;
    pauseCount?: number;
    longestPauseMs?: number;
  };
  createdAt: number;
}

export interface RetryOutcomePayload {
  attemptId: string;
  retryOf: string;
  feedbackIds?: string[];
  source: "lesson" | "correct" | "conversation";
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
type PayloadMap = {
  first_run_started: FirstRunStartedPayload;
  method_stage: MethodStagePayload;
  cards_reviewed: CardsReviewedPayload;
  video_processed: VideoProcessedPayload;
  conversation_turn: ConversationTurnPayload;
  mistake_submitted: MistakeSubmittedPayload;
  correction_generated: CorrectionGeneratedPayload;
  cards_created: CardsCreatedPayload;
  own_source_started: OwnSourceStartedPayload;
  own_source_completed: OwnSourceCompletedPayload;
  progress_checkin: ProgressCheckinPayload;
  c1_diagnosis_completed: C1DiagnosisCompletedPayload;
  level_test_completed: LevelTestCompletedPayload;
  listening_attempt: ListeningAttemptPayload;
  production_attempt: ProductionAttemptPayload;
  retry_outcome: RetryOutcomePayload;
};

export interface ActivityEvent<T extends ActivityEventType = ActivityEventType> {
  id: string;
  ts: number;
  type: T;
  payload: PayloadMap[T];
}

export async function emitActivity<T extends ActivityEventType>(
  type: T,
  payload: PayloadMap[T],
): Promise<void> {
  const event: ActivityEvent<T> = { id: nanoid(), ts: Date.now(), type, payload };
  await put(STORES.activityLog, event);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("phraseloop:activity"));
  }
}

export function getActivityLog(): Promise<ActivityEvent[]> {
  return getAll<ActivityEvent>(STORES.activityLog);
}

export function getActivityByType<T extends ActivityEventType>(
  type: T,
): Promise<ActivityEvent<T>[]> {
  return getAllFromIndex<ActivityEvent<T>>(STORES.activityLog, "type", type);
}

/** Typed performance evidence queries used by progress and coaching surfaces. */
export function getListeningAttempts(): Promise<ActivityEvent<"listening_attempt">[]> {
  return getActivityByType("listening_attempt");
}

export function getProductionAttempts(): Promise<ActivityEvent<"production_attempt">[]> {
  return getActivityByType("production_attempt");
}

export function getRetryOutcomes(): Promise<ActivityEvent<"retry_outcome">[]> {
  return getActivityByType("retry_outcome");
}

export function getActivitySince(sinceTs: number): Promise<ActivityEvent[]> {
  return getAllFromIndex<ActivityEvent>(
    STORES.activityLog,
    "ts",
    IDBKeyRange.lowerBound(sinceTs),
  );
}

export async function getActivityEvent(id: string): Promise<ActivityEvent | undefined> {
  return get<ActivityEvent>(STORES.activityLog, id);
}
