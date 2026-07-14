import { describe, expect, it } from "vitest";
import type { LearningProfile, MethodObjective } from "@/features/settings/learningProfile";
import type { ActivityEvent, MethodStagePayload } from "@/lib/store/activityLog";
import type { MethodSnapshot } from "./learningLoop";
import { deriveMethodPlan } from "./learningLoop";

const now = Date.UTC(2026, 6, 13);

function profileFor(objective: MethodObjective): Pick<LearningProfile, "objective"> {
  return { objective };
}

const profile = profileFor("conversation");

function snapshot(overrides: Partial<MethodSnapshot> = {}): MethodSnapshot {
  return { cards: 5, due: 0, errorEvents: [], ...overrides };
}

function event(
  type: ActivityEvent["type"],
  payload: ActivityEvent["payload"],
  ts = now,
): ActivityEvent {
  return { id: `${type}-${ts}-${Math.random()}`, type, payload, ts } as ActivityEvent;
}

function stage(
  stageName: MethodStagePayload["stage"],
  area: MethodStagePayload["area"],
  minutes: number,
  ts = now,
): ActivityEvent {
  return event("method_stage", { stage: stageName, area, source: "study", minutes }, ts);
}

function errorEvent(createdAt: number) {
  return {
    id: `e-${createdAt}`,
    original: "I have 25 years",
    corrected: "I am 25 years old",
    errorTypes: ["vocabulary" as const],
    sourceLang: "pt",
    targetLang: "en",
    createdAt,
  };
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
      activity: [stage("review", "structured", 20)],
      snapshot: snapshot(),
      now,
    });

    expect(plan.action.stage).toBe("listen");
    expect(plan.action.area).toBe("listening");
  });

  it("recommends speaking when listening is healthy but speaking is missing", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [stage("review", "structured", 12), stage("listen", "listening", 14)],
      snapshot: snapshot(),
      now,
    });

    expect(plan.action.stage).toBe("speak");
    expect(plan.action.area).toBe("speaking");
    // Speaking has its own surface now; it used to be folded into Correct.
    expect(plan.action.route).toBe("speak");
  });

  it("asks for retry after recent correction evidence", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [stage("review", "structured", 12), stage("listen", "listening", 10)],
      snapshot: snapshot({ errorEvents: [errorEvent(now - 1_000)] }),
      now,
    });

    expect(plan.action.stage).toBe("retry");
    expect(plan.action.route).toBe("correct");
  });

  it("clears the retry nudge once a retry stage follows the correction", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [
        stage("review", "structured", 12),
        stage("listen", "listening", 10),
        // What Correct now emits when a second attempt comes back clean.
        event(
          "method_stage",
          { stage: "retry", area: "readingWriting", source: "correct", minutes: 2 },
          now - 500,
        ),
      ],
      snapshot: snapshot({ errorEvents: [errorEvent(now - 1_000)] }),
      now,
    });

    expect(plan.action.stage).not.toBe("retry");
  });

  it("does not treat the percentages as daily hard requirements", () => {
    const plan = deriveMethodPlan({
      profile,
      activity: [stage("listen", "listening", 9)],
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

  // Notice follows Listen; Repeat follows Notice and precedes Speak. Before this, both
  // stages were write-only: they were logged but could never be recommended.
  describe("stage ordering", () => {
    it("recommends notice when the learner listened but kept nothing", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [stage("listen", "listening", 30)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.stage).toBe("notice");
      expect(plan.action.route).toBe("discover");
    });

    it("stops asking to notice once phrases were kept", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [
          stage("listen", "listening", 12, now - 2_000),
          stage("notice", "structured", 5, now - 1_000),
          stage("speak", "speaking", 10),
          stage("feedback", "readingWriting", 5),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.stage).toBe("review");
    });

    it("recommends repeat when a phrase was noticed but never said out loud", () => {
      const plan = deriveMethodPlan({
        profile: profileFor("travel"),
        activity: [
          stage("review", "structured", 10),
          stage("listen", "listening", 10),
          stage("notice", "structured", 3),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.stage).toBe("repeat");
      expect(plan.action.route).toBe("speak");
    });

    it("moves from repeat to speak once the phrase was repeated", () => {
      const plan = deriveMethodPlan({
        profile: profileFor("travel"),
        activity: [
          stage("review", "structured", 10),
          stage("listen", "listening", 10),
          stage("notice", "structured", 3, now - 2_000),
          stage("repeat", "speaking", 3, now - 1_000),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.stage).toBe("speak");
    });

    it("does not let a notice older than the week hold speaking back on repeat", () => {
      const plan = deriveMethodPlan({
        profile: profileFor("travel"),
        activity: [
          stage("review", "structured", 10),
          stage("listen", "listening", 10),
          stage("notice", "structured", 3, now - 8 * 86_400_000),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.stage).toBe("speak");
    });
  });

  describe("minute ledger", () => {
    it("clamps an implausible measured value to the stage ceiling", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [stage("review", "structured", 600)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(5);
    });

    it("still counts a legacy event logged before minutes were measured", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [
          event("method_stage", { stage: "listen", area: "listening", source: "discover" }),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(2);
    });

    it("accepts fractional minutes from a measured window", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [stage("listen", "listening", 0.5), stage("repeat", "speaking", 1.5)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(2);
    });

    it("counts a review once, not once per event and once per record", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [
          event("cards_reviewed", { count: 1, cardIds: ["c1"] }),
          stage("review", "structured", 1),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(1);
    });

    it("counts a conversation turn once, not once per event and once per turn", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [
          event("conversation_turn", { conversationId: "c1", scenarioId: "work", turnIndex: 1 }),
          event(
            "method_stage",
            { stage: "speak", area: "speaking", source: "converse", minutes: 2 },
            now,
          ),
        ],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(2);
    });

    it("still counts assessments, which sit outside the eight-stage loop", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [event("level_test_completed", {
          attemptId: "a1",
          fromLevel: "A2",
          targetLevel: "B1",
          passed: true,
          score: 0.8,
        })],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(10);
    });

    it("ignores activity older than the week", () => {
      const plan = deriveMethodPlan({
        profile,
        activity: [stage("listen", "listening", 30, now - 8 * 86_400_000)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.weeklyMinutes).toBe(0);
    });
  });

  describe("objective targets", () => {
    it.each([
      ["conversation", { structured: 0.3, listening: 0.35, speaking: 0.25, readingWriting: 0.1 }],
      ["professional", { structured: 0.35, listening: 0.25, speaking: 0.2, readingWriting: 0.2 }],
      ["academic", { structured: 0.3, listening: 0.2, speaking: 0.15, readingWriting: 0.35 }],
      ["travel", { structured: 0.25, listening: 0.3, speaking: 0.35, readingWriting: 0.1 }],
      ["media", { structured: 0.25, listening: 0.4, speaking: 0.25, readingWriting: 0.1 }],
    ] as const)("applies the %s distribution", (objective, expected) => {
      const plan = deriveMethodPlan({
        profile: profileFor(objective),
        activity: [],
        snapshot: snapshot(),
        now,
      });

      expect(plan.target).toEqual(expected);
    });

    it("routes an academic learner to reading and writing before speaking", () => {
      const plan = deriveMethodPlan({
        profile: profileFor("academic"),
        activity: [stage("review", "structured", 10), stage("listen", "listening", 10)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.area).toBe("readingWriting");
    });

    it("routes a media learner to listening first", () => {
      const plan = deriveMethodPlan({
        profile: profileFor("media"),
        activity: [stage("review", "structured", 10)],
        snapshot: snapshot(),
        now,
      });

      expect(plan.action.area).toBe("listening");
    });
  });
});
