import { describe, expect, it } from "vitest";
import { Rating, State, applyGrade, initialSrs, type Grade } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";
import {
  buildHint,
  isStable,
  recentFailureCount,
  shouldOfferModalityFallback,
} from "./scaffold";

function review(cardId: string, grade: Grade, reviewedAt: number): ReviewRecord {
  return {
    id: `${cardId}-${reviewedAt}`,
    cardId,
    grade,
    reviewedAt,
    previousState: State.Review,
    scheduledDays: 1,
    concept: "x",
  };
}

describe("recentFailureCount", () => {
  it("counts the trailing run of Again grades, most-recent first", () => {
    const reviews = [
      review("c1", Rating.Good, 1),
      review("c1", Rating.Again, 2),
      review("c1", Rating.Again, 3),
    ];
    expect(recentFailureCount("c1", reviews)).toBe(2);
  });

  it("stops the streak at the first non-Again grade", () => {
    const reviews = [
      review("c1", Rating.Again, 1),
      review("c1", Rating.Good, 2),
      review("c1", Rating.Again, 3),
    ];
    expect(recentFailureCount("c1", reviews)).toBe(1);
  });

  it("only considers the given card", () => {
    const reviews = [review("c1", Rating.Again, 1), review("c2", Rating.Again, 2)];
    expect(recentFailureCount("c1", reviews)).toBe(1);
  });

  it("is zero with no history", () => {
    expect(recentFailureCount("c1", [])).toBe(0);
  });
});

describe("isStable", () => {
  it("is false for a brand-new card", () => {
    expect(isStable(initialSrs("c1"))).toBe(false);
  });

  it("is false right after one Good (still Learning, not yet proven)", () => {
    const next = applyGrade(initialSrs("c1"), Rating.Good).next;
    expect(isStable(next)).toBe(false);
  });

  it("is true for a long-stabilized Review card", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let rec = initialSrs("c1", now);
    let reviewedAt = now;
    // Several spaced Easy passes push it into Review with high recall.
    for (let i = 0; i < 4; i++) {
      reviewedAt = new Date(rec.due);
      rec = applyGrade(rec, Rating.Easy, reviewedAt).next;
    }
    expect(rec.state).toBe(State.Review);
    // Shortly after the last pass, predicted recall is still well above the bar.
    expect(isStable(rec, new Date(reviewedAt.getTime() + 3600_000))).toBe(true);
  });
});

describe("shouldOfferModalityFallback", () => {
  it("offers only after 3 consecutive failures", () => {
    expect(shouldOfferModalityFallback(2)).toBe(false);
    expect(shouldOfferModalityFallback(3)).toBe(true);
    expect(shouldOfferModalityFallback(5)).toBe(true);
  });
});

describe("buildHint", () => {
  it("keeps the first letter of each word and masks the rest", () => {
    expect(buildHint("see you around")).toBe("s•• y•• a•••••");
  });

  it("preserves punctuation and a single-letter word", () => {
    expect(buildHint("I do.")).toBe("I d•.");
  });
});
