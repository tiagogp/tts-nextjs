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
  | "level_test_completed";

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
  source: "home" | "lesson" | "discover" | "study" | "correct" | "pronunciation";
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
