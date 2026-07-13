import { describe, expect, it } from "vitest";
import type { LearningProfile } from "@/features/settings/learningProfile";
import type { ActivityEvent } from "@/lib/store/activityLog";
import type { MethodSnapshot } from "./learningLoop";
import { deriveMethodPlan } from "./learningLoop";

const now = Date.UTC(2026, 6, 13);

const profile: Pick<LearningProfile, "focus" | "track"> = {
  focus: "",
  track: "beginner",
};

function snapshot(overrides: Partial<MethodSnapshot> = {}): MethodSnapshot {
  return {
    cards: 5,
    due: 0,
    reviews: [],
    errorEvents: [],
    conversations: [],
    pronunciationAttempts: [],
    ...overrides,
  };
}

function event(type: ActivityEvent["type"], payload: ActivityEvent["payload"], ts = now): ActivityEvent {
  return { id: `${type}-${ts}`, type, payload, ts } as ActivityEvent;
}

describe("deriveMethodPlan", () => {
  it("starts a new learner with the learn stage", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [],
      snapshot: snapshot({ cards: 0 }),
      now,
    });

    expect(plan.action.stage).toBe("learn");
    expect(plan.action.route).toBe("lesson");
  });

  it("prioritizes due review before balancing the week", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [],
      snapshot: snapshot({ due: 3 }),
      now,
    });

    expect(plan.action.stage).toBe("review");
    expect(plan.action.route).toBe("review");
  });

  it("recommends listening when the week has no listening signal", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [
        event("cards_reviewed", { count: 20, cardIds: [] }),
        event("conversation_turn", { conversationId: "c1", scenarioId: "work", turnIndex: 1 }),
      ],
      snapshot: snapshot(),
      now,
    });

    expect(plan.action.stage).toBe("listen");
    expect(plan.action.area).toBe("listening");
  });

  it("recommends speaking when listening is healthy but speaking is missing", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [
        event("cards_reviewed", { count: 12, cardIds: [] }),
        event("method_stage", {
          stage: "listen",
          area: "listening",
          source: "discover",
          minutes: 14,
        }),
      ],
      snapshot: snapshot(),
      now,
    });

    expect(plan.action.stage).toBe("speak");
    expect(plan.action.area).toBe("speaking");
  });

  it("asks for retry after recent correction evidence", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [
        event("cards_reviewed", { count: 12, cardIds: [] }),
        event("method_stage", {
          stage: "listen",
          area: "listening",
          source: "discover",
          minutes: 10,
        }),
      ],
      snapshot: snapshot({
        errorEvents: [
          {
            id: "e1",
            original: "I have 25 years",
            corrected: "I am 25 years old",
            errorTypes: ["vocabulary"],
            sourceLang: "pt",
            targetLang: "en",
            createdAt: now - 1_000,
          },
        ],
      }),
      now,
    });

    expect(plan.action.stage).toBe("retry");
    expect(plan.action.route).toBe("correct");
  });

  it("does not treat the percentages as daily hard requirements", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [
        event("method_stage", {
          stage: "listen",
          area: "listening",
          source: "lesson",
          minutes: 9,
        }),
      ],
      snapshot: snapshot(),
      now,
    });

    expect(plan.weeklyMinutes).toBeGreaterThan(0);
    expect(plan.balance.map((entry) => entry.area)).toEqual([
      "structured",
      "listening",
      "speaking",
      "readingWriting",
    ]);
  });
});
