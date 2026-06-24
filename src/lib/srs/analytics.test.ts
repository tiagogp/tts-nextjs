import { describe, expect, it } from "vitest";
import { detectWeaknesses } from "./analytics";
import { Rating, State, type Grade } from "./fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

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
