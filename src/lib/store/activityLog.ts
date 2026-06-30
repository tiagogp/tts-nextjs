import { nanoid } from "nanoid";
import type { ActivationTiming } from "@/features/activation/firstRun";
import { STORES, get, getAll, getAllFromIndex, put } from "./db";

export type ActivityEventType =
  | "cards_reviewed"
  | "video_processed"
  | "conversation_turn"
  | "correction_generated"
  | "cards_created"
  | "progress_checkin";

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

export interface CorrectionGeneratedPayload {
  cardsCreated: number;
  source: "manual" | "json" | "ai";
}

export interface CardsCreatedPayload {
  count: number;
  source: "discover" | "correct" | "converse" | "learn";
  activation?: ActivationTiming;
}

export interface ProgressCheckinPayload {
  assessmentId: string;
  levelEstimate: string;
  errorsFound: number;
}

type PayloadMap = {
  cards_reviewed: CardsReviewedPayload;
  video_processed: VideoProcessedPayload;
  conversation_turn: ConversationTurnPayload;
  correction_generated: CorrectionGeneratedPayload;
  cards_created: CardsCreatedPayload;
  progress_checkin: ProgressCheckinPayload;
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
