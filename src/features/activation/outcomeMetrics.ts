import { Rating } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

/**
 * The learning-outcome metric: **D+30 unaided production rate**.
 *
 * Everything else the app measures is activity or model output. Cards created, lessons
 * completed and weekly minutes say a learner showed up; FSRS predicted retention is the
 * scheduler grading its own homework. This is the only number here that distinguishes
 * learning from familiarity, so it is defined narrowly and deliberately hard to flatter:
 *
 *   - the review must be of a **production** card (PT prompt → EN answer). A recognition
 *     review can be cleared from acoustic familiarity and says nothing about production;
 *   - it must be **unaided** — no hint, no partial reveal, no slow replay, no
 *     listen-and-repeat fallback (`scaffoldLevel` 0 and `hintUsed` false);
 *   - the item must have been **unseen for at least 7 days**, measured from the learner's
 *     previous review of that same card. A card answered yesterday tests nothing durable;
 *   - "correct" is a `Good` or `Easy` grade. `Hard` counts as an attempt, not a success.
 *
 * The rate is `null` rather than 0 when no attempt qualifies: "not measured yet" and
 * "measured and bad" are different facts, and collapsing them is how a metric starts lying.
 */

/** The audit's window: production held for a month, not a week. */
export const UNAIDED_PRODUCTION_WINDOW_DAYS = 30;
/** Minimum gap since the learner last saw the card, so recency cannot carry the answer. */
export const UNAIDED_PRODUCTION_MIN_REST_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UnaidedProductionStats {
  windowDays: number;
  minRestDays: number;
  /** Qualifying reviews: production, unaided, after at least `minRestDays` of rest. */
  attempts: number;
  /** Of those, graded Good or Easy. */
  correct: number;
  /** `correct / attempts`, or null when nothing qualifies yet. */
  rate: number | null;
  /** Distinct cards behind `attempts` — a rate over two cards is not a rate. */
  cards: number;
}

function isUnaided(review: ReviewRecord): boolean {
  return !review.hintUsed && (review.scaffoldLevel ?? 0) === 0;
}

export function computeUnaidedProduction(
  reviews: ReviewRecord[],
  now: number = Date.now(),
  options: { windowDays?: number; minRestDays?: number } = {},
): UnaidedProductionStats {
  const windowDays = options.windowDays ?? UNAIDED_PRODUCTION_WINDOW_DAYS;
  const minRestDays = options.minRestDays ?? UNAIDED_PRODUCTION_MIN_REST_DAYS;
  const windowStart = now - windowDays * DAY_MS;

  // Per-card history in chronological order, so "rest since last seen" is the real gap
  // rather than the interval FSRS intended.
  const byCard = new Map<string, ReviewRecord[]>();
  for (const review of [...reviews].sort((a, b) => a.reviewedAt - b.reviewedAt)) {
    const history = byCard.get(review.cardId);
    if (history) history.push(review);
    else byCard.set(review.cardId, [review]);
  }

  let attempts = 0;
  let correct = 0;
  const cards = new Set<string>();

  for (const history of byCard.values()) {
    for (const [index, review] of history.entries()) {
      if (review.direction !== "production") continue;
      if (review.reviewedAt < windowStart || review.reviewedAt > now) continue;
      if (!isUnaided(review)) continue;

      const previous = history[index - 1];
      // A card's first-ever review has no gap to measure. It happens minutes after the
      // lesson taught the phrase, which is exactly the short-term recall this metric exists
      // to exclude, so it never qualifies.
      if (!previous) continue;
      if (review.reviewedAt - previous.reviewedAt < minRestDays * DAY_MS) continue;

      attempts += 1;
      cards.add(review.cardId);
      if (review.grade === Rating.Good || review.grade === Rating.Easy) correct += 1;
    }
  }

  return {
    windowDays,
    minRestDays,
    attempts,
    correct,
    rate: attempts === 0 ? null : correct / attempts,
    cards: cards.size,
  };
}
