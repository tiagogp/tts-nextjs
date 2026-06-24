import { describe, expect, it } from "vitest";
import { computeWeeklyActivity, detectWeaknesses } from "./analytics";
import { Rating, State, type Grade } from "./fsrs";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";

function review(partial: Partial<ReviewRecord> & { grade: Grade }): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    cardId: crypto.randomUUID(),
    reviewedAt: Date.now(),
    previousState: State.Review,
    scheduledDays: 1,
    concept: "unspecified",
    ...partial,
  };
}

describe("detectWeaknesses — context grouping", () => {
  it("surfaces a situational context you keep struggling with", () => {
    // Distinct concepts so only the shared context reaches MIN_REVIEWS (3).
    const reviews = [
      review({ grade: Rating.Again, context: "work", concept: "a" }),
      review({ grade: Rating.Hard, context: "work", concept: "b" }),
      review({ grade: Rating.Good, context: "work", concept: "c" }),
    ];

    const work = detectWeaknesses(reviews).find(
      (w) => w.kind === "context" && w.label === "work",
    );

    expect(work).toBeDefined();
    expect(work!.reviews).toBe(3);
    // struggle = Again or Hard → 2 of 3; lapse = Again only → 1.
    expect(work!.struggleRate).toBeCloseTo(2 / 3);
    expect(work!.lapses).toBe(1);
    // Contexts carry no production trend (like concepts).
    expect(work!.trend).toBe("stable");
  });

  it("ignores a context with no struggles", () => {
    const clean = [
      review({ grade: Rating.Good, context: "travel", concept: "x" }),
      review({ grade: Rating.Good, context: "travel", concept: "y" }),
      review({ grade: Rating.Good, context: "travel", concept: "z" }),
    ];

    expect(detectWeaknesses(clean).some((w) => w.label === "travel")).toBe(false);
  });
});

describe("computeWeeklyActivity", () => {
  const now = Date.parse("2026-06-23T12:00:00Z");
  const dayMs = 86_400_000;

  function convo(startedAt: number, userTurns: number): Conversation {
    return {
      id: crypto.randomUUID(),
      scenario: "x",
      context: "work",
      targetLang: "en",
      sourceLang: "pt",
      turns: [
        { role: "assistant", text: "hi" },
        ...Array.from({ length: userTurns }, () => ({ role: "user" as const, text: "ok" })),
      ],
      startedAt,
    };
  }

  it("counts conversations, learner turns, and reviews from the last 7 days only", () => {
    const conversations = [
      convo(now - 2 * dayMs, 3), // this week
      convo(now - 6 * dayMs, 2), // this week
      convo(now - 9 * dayMs, 5), // older — excluded
    ];
    const reviews: ReviewRecord[] = [
      { id: "a", cardId: "c", grade: Rating.Good, reviewedAt: now - dayMs, previousState: State.Review, scheduledDays: 1, concept: "x" },
      { id: "b", cardId: "c", grade: Rating.Again, reviewedAt: now - 10 * dayMs, previousState: State.Review, scheduledDays: 1, concept: "x" },
    ];

    const activity = computeWeeklyActivity(conversations, reviews, now);
    expect(activity.conversations).toBe(2);
    expect(activity.turns).toBe(5); // 3 + 2 learner turns; assistant turns ignored
    expect(activity.reviews).toBe(1);
  });
});
