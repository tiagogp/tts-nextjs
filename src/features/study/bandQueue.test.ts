import { describe, expect, it } from "vitest";
import { Rating, State, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import type { Skill } from "@/lib/cards/schema";
import type { SkillState } from "@/lib/srs/skillState";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { ReviewRecord } from "@/lib/store/repository";
import type { DueCard } from "./components/StudyCard";
import { fatigueByCard, orderDueQueue } from "./bandQueue";

const NOW = new Date(Date.UTC(2026, 5, 28));
const NOW_MS = NOW.getTime();
const DAY = 86_400_000;

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

function due(id: string, over: Partial<SrsRecord> = {}): DueCard {
  return { card: { id } as DueCard["card"], srs: srs(id, over) };
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

/** A log that trips the gate to "adopt": ≥20 reconstructed retrievals, all too-easy. */
function adoptLog(): ReviewRecord[] {
  const reviews: ReviewRecord[] = [];
  for (let i = 0; i < 30; i++) {
    reviews.push(review("a", Rating.Good, NOW_MS - 30 * 1000 + i * 1000));
  }
  return reviews;
}

describe("orderDueQueue", () => {
  it("leaves the queue untouched when the gate has insufficient data", () => {
    const queue = [due("fresh"), due("overdue", { due: NOW_MS - 9 * DAY })];
    const result = orderDueQueue(queue, [review("a", Rating.Good, NOW_MS)], { at: NOW });
    expect(result.applied).toBe(false);
    expect(result.gate.verdict).toBe("insufficient-data");
    expect(result.queue.map((c) => c.card.id)).toEqual(["fresh", "overdue"]);
  });

  it("re-orders toward the band once the gate adopts", () => {
    const queue = [due("fresh"), due("overdue", { due: NOW_MS - 9 * DAY })];
    const result = orderDueQueue(queue, adoptLog(), { at: NOW });
    expect(result.gate.verdict).toBe("adopt");
    expect(result.applied).toBe(true);
    // urgency lifts the badly-overdue card to the front (mirrors orderByBand).
    expect(result.queue[0].card.id).toBe("overdue");
  });
});

describe("fatigueByCard", () => {
  const states = {
    vocabulary: { proficiency: 0, fatigue: 0.2, due: 0, reviews: 0 },
    grammar: { proficiency: 0, fatigue: 0.9, due: 0, reviews: 0 },
    listening: { proficiency: 0, fatigue: 0, due: 0, reviews: 0 },
    speaking: { proficiency: 0, fatigue: 0.5, due: 0, reviews: 0 },
  } as Record<Skill, SkillState>;

  it("resolves a card's fatigue from its inferred skill", () => {
    const card = { card: { id: "g", errorType: "tense" } as DueCard["card"], srs: srs("g") };
    expect(fatigueByCard(states, [])(card)).toBe(0.9);
  });

  it("routes spoken cards to the speaking skill", () => {
    const card = { card: { id: "s" } as DueCard["card"], srs: srs("s") };
    const pron = [{ cardId: "s" } as PronunciationAttempt];
    expect(fatigueByCard(states, pron)(card)).toBe(0.5);
  });
});
