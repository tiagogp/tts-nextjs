import { describe, expect, it } from "vitest";
import { Rating, State, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";
import {
  TARGET_RECALL,
  bandGateMetrics,
  gateVerdict,
  orderByBand,
  scoreCard,
  simulateBandGate,
  targetRecall,
  type BandGateMetrics,
} from "./band";

const NOW = new Date(Date.UTC(2026, 5, 28)); // 2026-06-28
const NOW_MS = NOW.getTime();
const DAY = 86_400_000;
/** Mirrors the MIN_SAMPLES floor in band.ts. */
const MIN_OK = 20;

function srs(cardId: string, over: Partial<SrsRecord> = {}): SrsRecord {
  return {
    cardId,
    due: NOW_MS,
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: State.Review,
    last_review: NOW_MS - DAY,
    ...over,
  };
}

function due(id: string, over: Partial<SrsRecord> = {}) {
  return { card: { id }, srs: srs(id, over) };
}

function review(cardId: string, grade: Grade, reviewedAt: number): ReviewRecord {
  return {
    id: `${cardId}-${reviewedAt}`,
    cardId,
    grade,
    reviewedAt,
    previousState: State.Review,
    scheduledDays: 1,
    concept: "c",
  };
}

describe("targetRecall", () => {
  it("centers on the sweet spot with no fatigue", () => {
    expect(targetRecall(0)).toBeCloseTo(TARGET_RECALL, 5);
  });

  it("lowers the target as fatigue rises (favor easier cards when drained)", () => {
    expect(targetRecall(1)).toBeLessThan(targetRecall(0));
    expect(targetRecall(1)).toBeGreaterThan(0);
  });
});

describe("scoreCard", () => {
  it("scores a card at the target recall higher than an over-stable one", () => {
    // A card whose elapsed time has decayed recall toward ~0.72 vs. a freshly-reviewed,
    // still-near-1.0 card. The on-target card should win on band-fit.
    const onTarget = srs("a", { stability: 3, scheduled_days: 3, elapsed_days: 3, last_review: NOW_MS - 3 * DAY });
    const tooEasy = srs("b", { stability: 200, scheduled_days: 1, elapsed_days: 0, last_review: NOW_MS });
    expect(scoreCard(onTarget, 0, NOW)).toBeGreaterThan(scoreCard(tooEasy, 0, NOW));
  });

  it("raises the score of a badly-overdue card via memory urgency", () => {
    const fresh = srs("a");
    const overdue = srs("b", { due: NOW_MS - 10 * DAY });
    expect(scoreCard(overdue, 0, NOW)).toBeGreaterThan(scoreCard(fresh, 0, NOW));
  });
});

describe("orderByBand", () => {
  it("surfaces an overdue card ahead of a just-scheduled one", () => {
    const cards = [
      due("fresh"),
      due("overdue", { due: NOW_MS - 9 * DAY }),
    ];
    const ordered = orderByBand(cards, { at: NOW });
    expect(ordered[0].card.id).toBe("overdue");
  });

  it("breaks ties toward the earlier-due card", () => {
    const cards = [
      due("later", { due: NOW_MS - DAY }),
      due("earlier", { due: NOW_MS - 2 * DAY }),
    ];
    // identical srs apart from due → same band-fit shape; urgency favors earlier, and the
    // tiebreak reinforces it.
    const ordered = orderByBand(cards, { at: NOW });
    expect(ordered[0].card.id).toBe("earlier");
  });

  it("shifts ordering when fatigue lowers the target", () => {
    const cards = [due("x"), due("y")];
    const high = orderByBand(cards, { at: NOW, fatigueOf: (c) => (c.card.id === "x" ? 1 : 0) });
    // pure smoke check: a fatigue resolver runs without throwing and returns the full queue.
    expect(high).toHaveLength(2);
  });
});

describe("bandGateMetrics", () => {
  it("excludes the New-state first sighting of each card", () => {
    // Two reviews of one card: the first introduces it (New) and is not a retrieval.
    const reviews = [review("a", Rating.Good, NOW_MS - DAY), review("a", Rating.Good, NOW_MS)];
    expect(bandGateMetrics(reviews).samples).toBe(1);
  });

  it("reads rapid re-reviews as a too-easy distribution", () => {
    // Grade Good then review again moments later, repeatedly: recall stays near 1.0.
    const reviews: ReviewRecord[] = [];
    for (let i = 0; i < 30; i++) {
      reviews.push(review("a", Rating.Good, NOW_MS - 30 * 1000 + i * 1000));
    }
    const m = bandGateMetrics(reviews);
    expect(m.samples).toBeGreaterThanOrEqual(MIN_OK);
    expect(m.meanRecall).toBeGreaterThan(TARGET_RECALL);
    expect(m.shareTooEasy).toBeGreaterThan(0.5);
  });

  it("returns zeros for an empty log", () => {
    expect(bandGateMetrics([])).toEqual({
      samples: 0,
      meanRecall: 0,
      meanDistance: 0,
      shareInBand: 0,
      shareTooEasy: 0,
      shareTooHard: 0,
    });
  });
});

function metrics(over: Partial<BandGateMetrics>): BandGateMetrics {
  return {
    samples: 50,
    meanRecall: 0.72,
    meanDistance: 0.1,
    shareInBand: 0.8,
    shareTooEasy: 0.1,
    shareTooHard: 0.1,
    ...over,
  };
}

describe("gateVerdict", () => {
  it("reports insufficient data below the sample floor", () => {
    expect(gateVerdict(metrics({ samples: 5 }))).toBe("insufficient-data");
  });

  it("skips when reviews already cluster in the band", () => {
    expect(gateVerdict(metrics({ shareInBand: 0.8, shareTooEasy: 0.1, shareTooHard: 0.1 }))).toBe("skip");
  });

  it("adopts when reviews land systematically off the band", () => {
    expect(gateVerdict(metrics({ shareInBand: 0.4, shareTooEasy: 0.5, shareTooHard: 0.1 }))).toBe("adopt");
  });
});

describe("simulateBandGate", () => {
  it("returns insufficient-data with a note for a thin log", () => {
    const result = simulateBandGate([review("a", Rating.Good, NOW_MS)]);
    expect(result.verdict).toBe("insufficient-data");
    expect(result.note).toContain("retrievals");
  });

  it("flags headroom on a too-easy log", () => {
    const reviews: ReviewRecord[] = [];
    for (let i = 0; i < 30; i++) {
      reviews.push(review("a", Rating.Good, NOW_MS - 30 * 1000 + i * 1000));
    }
    expect(simulateBandGate(reviews).verdict).toBe("adopt");
  });
});
