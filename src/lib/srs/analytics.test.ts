import { describe, expect, it } from "vitest";
import {
  computeReturnAfterMiss,
  computeWeeklyActivity,
  detectWeaknesses,
} from "./analytics";
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

describe("computeReturnAfterMiss (W7)", () => {
  const now = Date.parse("2026-06-28T12:00:00Z");
  const dayMs = 86_400_000;
  const daysAgo = (n: number) => now - n * dayMs;

  it("reports a clean state with no review history", () => {
    const r = computeReturnAfterMiss([], now);
    expect(r.activeDays).toBe(0);
    expect(r.missGaps).toBe(0);
    expect(r.returnRate).toBe(1);
    expect(r.currentlyMissing).toBe(true);
  });

  it("counts no miss gaps for consecutive daily reviews", () => {
    const reviews = [0, 1, 2, 3].map((d) =>
      review({ grade: Rating.Good, reviewedAt: daysAgo(d) }),
    );
    const r = computeReturnAfterMiss(reviews, now);
    expect(r.activeDays).toBe(4);
    expect(r.missGaps).toBe(0);
    expect(r.longestGapDays).toBe(1);
    expect(r.returnRate).toBe(1);
    expect(r.daysSinceLastReview).toBe(0);
    expect(r.currentlyMissing).toBe(false);
  });

  it("classifies a prompt return and a long-gap return", () => {
    // active days (ago): 12, 9 (gap 3 → prompt), 8, 0 (gap 8 → long).
    const reviews = [12, 9, 8, 0].map((d) =>
      review({ grade: Rating.Good, reviewedAt: daysAgo(d) }),
    );
    const r = computeReturnAfterMiss(reviews, now);
    expect(r.activeDays).toBe(4);
    expect(r.missGaps).toBe(2);
    expect(r.promptReturns).toBe(1);
    expect(r.returnRate).toBeCloseTo(1 / 2);
    expect(r.longestGapDays).toBe(8);
    expect(r.daysSinceLastReview).toBe(0);
  });

  it("flags an active drop-off when the last review was days ago", () => {
    const reviews = [review({ grade: Rating.Good, reviewedAt: daysAgo(4) })];
    const r = computeReturnAfterMiss(reviews, now);
    expect(r.daysSinceLastReview).toBe(4);
    expect(r.currentlyMissing).toBe(true);
    // a single active day has no consecutive gaps yet
    expect(r.missGaps).toBe(0);
  });
});
