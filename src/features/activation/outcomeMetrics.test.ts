import { describe, expect, it } from "vitest";
import { Rating, State } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";
import type { CardDirection } from "@/lib/cards/schema";
import { computeUnaidedProduction } from "./outcomeMetrics";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 25);

function review(
  overrides: Partial<ReviewRecord> & { cardId: string; reviewedAt: number },
): ReviewRecord {
  return {
    id: `${overrides.cardId}-${overrides.reviewedAt}`,
    grade: Rating.Good,
    previousState: State.Review,
    scheduledDays: 10,
    concept: "useful phrase",
    direction: "production" as CardDirection,
    ...overrides,
  };
}

/** A qualifying attempt needs a prior review at least 7 days earlier. */
function pair(cardId: string, restDays: number, overrides: Partial<ReviewRecord> = {}) {
  const at = NOW - DAY;
  return [
    review({ cardId, reviewedAt: at - restDays * DAY }),
    review({ cardId, reviewedAt: at, ...overrides }),
  ];
}

describe("computeUnaidedProduction", () => {
  it("returns a null rate when nothing qualifies yet", () => {
    const stats = computeUnaidedProduction([], NOW);

    // "Not measured" must not read as 0%.
    expect(stats).toMatchObject({ attempts: 0, correct: 0, rate: null, cards: 0 });
  });

  it("counts unaided production reviews after a week of rest", () => {
    const stats = computeUnaidedProduction(
      [...pair("a", 10), ...pair("b", 8, { grade: Rating.Again })],
      NOW,
    );

    expect(stats.attempts).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.rate).toBe(0.5);
    expect(stats.cards).toBe(2);
  });

  it("ignores recognition reviews", () => {
    const stats = computeUnaidedProduction(pair("a", 10, { direction: "recognition" }), NOW);
    expect(stats.attempts).toBe(0);
  });

  it("ignores reviews with no direction recorded", () => {
    // Pre-split reviews are all receptive; counting them would inflate the rate with
    // exactly the number this metric exists to replace.
    const stats = computeUnaidedProduction(
      pair("a", 10, { direction: undefined }).map((r) => ({ ...r, direction: undefined })),
      NOW,
    );
    expect(stats.attempts).toBe(0);
  });

  it("ignores scaffolded answers", () => {
    expect(computeUnaidedProduction(pair("a", 10, { hintUsed: true }), NOW).attempts).toBe(0);
    expect(computeUnaidedProduction(pair("b", 10, { scaffoldLevel: 2 }), NOW).attempts).toBe(0);
    expect(computeUnaidedProduction(pair("c", 10, { scaffoldLevel: 0 }), NOW).attempts).toBe(1);
  });

  it("ignores an item the learner saw less than a week ago", () => {
    expect(computeUnaidedProduction(pair("a", 6), NOW).attempts).toBe(0);
    expect(computeUnaidedProduction(pair("b", 7), NOW).attempts).toBe(1);
  });

  it("never counts a card's first review", () => {
    // It happens minutes after the lesson taught the phrase.
    const stats = computeUnaidedProduction([review({ cardId: "a", reviewedAt: NOW - DAY })], NOW);
    expect(stats.attempts).toBe(0);
  });

  it("counts Hard as an attempt but not a success", () => {
    const stats = computeUnaidedProduction(pair("a", 10, { grade: Rating.Hard }), NOW);
    expect(stats).toMatchObject({ attempts: 1, correct: 0, rate: 0 });
  });

  it("only looks inside the window", () => {
    const old = [
      review({ cardId: "a", reviewedAt: NOW - 80 * DAY }),
      review({ cardId: "a", reviewedAt: NOW - 60 * DAY }),
    ];
    expect(computeUnaidedProduction(old, NOW).attempts).toBe(0);
    expect(computeUnaidedProduction(old, NOW, { windowDays: 90 }).attempts).toBe(1);
  });
});
