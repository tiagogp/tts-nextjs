import type { DailyTask, TaskItem } from "./schema";
import type { ActivityEvent } from "@/lib/store/activityLog";

type EvidencePayload = { count?: number; cardsCreated?: number; durationMs?: number; spoken?: boolean; source?: string; transferKind?: string; evaluated?: boolean; resolution?: string };

function payload(event: ActivityEvent): EvidencePayload {
  return event.payload as EvidencePayload;
}

/**
 * Convert activity evidence into the unit requested by a plan task. This keeps
 * completion honest: five minutes of spoken production is not five conversation
 * turns, and one card-created event is not one card.
 */
export function countTaskEvidence(task: TaskItem, events: ActivityEvent[]): number {
  const action = task.targetMetric?.action;
  const relevant = events.filter((event) => {
    const value = payload(event);
    if (action === "cards_reviewed") return event.type === "cards_reviewed";
    if (action === "cards_created") return event.type === "cards_created" || event.type === "own_source_completed";
    if (action === "video_processed") return event.type === "video_processed";
    if (action === "minutes_spoken") {
      return event.type === "production_attempt" && value.spoken === true && value.source === "conversation";
    }
    if (action === "production_attempt") {
      return event.type === "production_attempt" && (task.type !== "correct" || value.source === "correct");
    }
    if (action === "retry_resolution") {
      return event.type === "retry_outcome" && value.resolution !== "dismissed";
    }
    if (action === "reading_writing_attempt") {
      return event.type === "production_attempt" && value.spoken === false && Boolean(value.transferKind) && value.evaluated !== false;
    }
    if (action === "reading_comprehension") {
      return event.type === "production_attempt" && value.spoken === false && value.transferKind === "reading_to_meaning" && value.evaluated !== false;
    }
    if (action === "writing_production") {
      return event.type === "production_attempt" && value.spoken === false && Boolean(value.transferKind) && value.transferKind !== "reading_to_meaning" && value.evaluated !== false;
    }
    if (action === "progress_checkin") return event.type === "progress_checkin";
    if (task.type === "study") return event.type === "cards_reviewed";
    if (task.type === "discover") return event.type === "video_processed";
    if (task.type === "converse") return event.type === "production_attempt" && value.source === "conversation";
    if (task.type === "correct") return event.type === "retry_outcome" || (event.type === "production_attempt" && value.source === "correct");
    if (task.type === "readWrite") return event.type === "production_attempt" && value.spoken === false && Boolean(value.transferKind);
    return event.type === "cards_created" && value.source === "learn";
  });

  if (action === "cards_reviewed") return relevant.reduce((sum, event) => sum + (payload(event).count ?? 0), 0);
  if (action === "cards_created") return relevant.reduce((sum, event) => sum + (payload(event).count ?? payload(event).cardsCreated ?? 0), 0);
  if (action === "minutes_spoken") return relevant.reduce((sum, event) => sum + (payload(event).durationMs ?? 0) / 60_000, 0);
  return relevant.length;
}

/** A stable helper for callers that want to compare evidence with a task target. */
export function taskEvidenceMeetsTarget(task: TaskItem, events: ActivityEvent[]): boolean {
  return countTaskEvidence(task, events) >= (task.targetMetric?.quantity ?? 1);
}

/** Keep the public import surface narrow for plan consumers. */
export type PlanEvidenceTask = DailyTask["tasks"][number];
