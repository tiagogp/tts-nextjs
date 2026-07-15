import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/store/activityLog";
import type { TaskItem } from "./schema";
import { countTaskEvidence, taskEvidenceMeetsTarget } from "./evidence";

const event = (type: ActivityEvent["type"], payload: Record<string, unknown>): ActivityEvent => ({
  id: crypto.randomUUID(),
  ts: 1,
  type,
  payload: payload as never,
});

describe("plan evidence", () => {
  it("counts the units requested by a task instead of event rows", () => {
    const task: TaskItem = { id: "study", type: "study", instruction: "Review", targetMetric: { action: "cards_reviewed", quantity: 10 } };
    const events = [event("cards_reviewed", { count: 6, cardIds: [] }), event("cards_reviewed", { count: 5, cardIds: [] })];
    expect(countTaskEvidence(task, events)).toBe(11);
    expect(taskEvidenceMeetsTarget(task, events)).toBe(true);
  });

  it("measures spoken minutes separately from conversation event count", () => {
    const task: TaskItem = { id: "speak", type: "converse", instruction: "Speak", targetMetric: { action: "minutes_spoken", quantity: 2 } };
    const events = [
      event("production_attempt", { source: "conversation", spoken: true, durationMs: 90_000 }),
      event("production_attempt", { source: "conversation", spoken: false, durationMs: 120_000 }),
    ];
    expect(countTaskEvidence(task, events)).toBe(1.5);
    expect(taskEvidenceMeetsTarget(task, events)).toBe(false);
  });

  it("keeps reading comprehension and writing production evidence distinct", () => {
    const reading: TaskItem = { id: "read", type: "readWrite", instruction: "Read", targetMetric: { action: "reading_comprehension", quantity: 1 } };
    const writing: TaskItem = { id: "write", type: "readWrite", instruction: "Write", targetMetric: { action: "writing_production", quantity: 1 } };
    const events = [
      event("production_attempt", { spoken: false, transferKind: "reading_to_meaning" }),
      event("production_attempt", { spoken: false, transferKind: "phrase_to_situation" }),
    ];
    expect(countTaskEvidence(reading, events)).toBe(1);
    expect(countTaskEvidence(writing, events)).toBe(1);
  });

  it("does not complete writing from an unevaluated self-check", () => {
    const writing: TaskItem = { id: "write", type: "readWrite", instruction: "Write", targetMetric: { action: "writing_production", quantity: 1 } };
    const events = [event("production_attempt", { spoken: false, transferKind: "phrase_to_situation", evaluated: false })];
    expect(countTaskEvidence(writing, events)).toBe(0);
  });

  it("uses a resolved retry as correction evidence", () => {
    const correct: TaskItem = { id: "correct", type: "correct", instruction: "Retry", targetMetric: { action: "retry_resolution", quantity: 1 } };
    expect(countTaskEvidence(correct, [event("retry_outcome", { resolution: "completed" })])).toBe(1);
    expect(countTaskEvidence(correct, [event("retry_outcome", { resolution: "dismissed" })])).toBe(0);
  });
});
