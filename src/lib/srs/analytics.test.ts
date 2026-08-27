import { describe, expect, it } from "vitest";
import {
  computeDueReviewRhythm,
  computeReturnAfterMiss,
  computeWeeklyActivity,
  detectWeaknesses,
} from "./analytics";
import { Rating, State, type Grade, type SrsRecord } from "./fsrs";
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

describe("computeDueReviewRhythm", () => {
  const now = new Date(2026, 6, 15, 12).getTime();
  const localAt = (day: number, hour = 9) => new Date(2026, 6, day, hour).getTime();
  const scheduledReview = (id: string, dueDay: number, reviewedDay: number): ReviewRecord =>
    review({
      cardId: id,
      grade: Rating.Good,
      dueAt: localAt(dueDay),
      wasDue: true,
      reviewedAt: localAt(reviewedDay, 18),
      previousState: State.Review,
    });
  const srs = (cardId: string, dueDay: number, state: State = State.Review): SrsRecord => ({
    cardId,
    due: localAt(dueDay),
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state,
  });

  it("counts scheduled due days while treating days with nothing due as rest", () => {
    const rhythm = computeDueReviewRhythm(
      [scheduledReview("a", 5, 5), scheduledReview("b", 12, 12)],
      [srs("a", 20), srs("b", 21)],
      now,
    );

    expect(rhythm).toMatchObject({
      resolvedReviews: 2,
      onTimeReviews: 2,
      overdueNow: 0,
      onTimeRate: 1,
      trackedDueDays: 2,
      currentRunDueDays: 2,
    });
  });

  it("includes late completions and currently overdue cards instead of flattering the rate", () => {
    const rhythm = computeDueReviewRhythm(
      [scheduledReview("a", 5, 5), scheduledReview("b", 8, 10)],
      [srs("a", 20), srs("b", 20), srs("c", 13)],
      now,
    );

    expect(rhythm.resolvedReviews).toBe(2);
    expect(rhythm.onTimeReviews).toBe(1);
    expect(rhythm.overdueNow).toBe(1);
    expect(rhythm.onTimeRate).toBeCloseTo(1 / 3);
    expect(rhythm.currentRunDueDays).toBe(0);
  });

  it("ignores first exposure, early optional practice, and legacy records", () => {
    const first = scheduledReview("new", 10, 10);
    first.previousState = State.New;
    const early = scheduledReview("early", 10, 10);
    early.wasDue = false;
    const legacy = scheduledReview("legacy", 10, 10);
    legacy.dueAt = undefined;

    expect(computeDueReviewRhythm([first, early, legacy], [srs("new", 20, State.New)], now))
      .toMatchObject({ resolvedReviews: 0, onTimeRate: null, trackedDueDays: 0 });
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
