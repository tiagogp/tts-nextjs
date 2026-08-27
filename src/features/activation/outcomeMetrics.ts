import { Rating } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

/**
 * Legacy rolling activity metric. New learning claims use `computeDelayedProduction`,
 * which tests explicit D7/D30/D60 intervals and observed pre-reveal responses.
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
  /** Cards whose latest qualifying attempt was correct, newest evidence first. */
  heldCardIds: string[];
}

export type DelayedProductionTarget = 7 | 30 | 60;

export interface DelayedProductionWindow extends UnaidedProductionStats {
  targetDays: DelayedProductionTarget;
  minGapDays: number;
  maxGapDays: number;
}

export interface DelayedProductionStats {
  d7: DelayedProductionWindow;
  d30: DelayedProductionWindow;
  d60: DelayedProductionWindow;
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
  const latestQualifying = new Map<string, ReviewRecord>();

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
      latestQualifying.set(review.cardId, review);
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
    heldCardIds: [...latestQualifying.values()]
      .filter((review) => review.grade === Rating.Good || review.grade === Rating.Easy)
      .sort((a, b) => b.reviewedAt - a.reviewedAt)
      .map((review) => review.cardId),
  };
}

const DELAYED_WINDOWS: Record<DelayedProductionTarget, { min: number; max: number }> = {
  7: { min: 5, max: 10 },
  30: { min: 24, max: 38 },
  60: { min: 50, max: 75 },
};

function delayedWindow(
  reviews: ReviewRecord[],
  targetDays: DelayedProductionTarget,
  now: number,
): DelayedProductionWindow {
  const { min, max } = DELAYED_WINDOWS[targetDays];
  const byCard = new Map<string, ReviewRecord[]>();
  for (const review of [...reviews].sort((a, b) => a.reviewedAt - b.reviewedAt)) {
    const history = byCard.get(review.cardId) ?? [];
    history.push(review);
    byCard.set(review.cardId, history);
  }

  const qualifying: ReviewRecord[] = [];
  for (const history of byCard.values()) {
    for (let index = 1; index < history.length; index += 1) {
      const current = history[index];
      const previous = history[index - 1];
      const gap = (current.reviewedAt - previous.reviewedAt) / DAY_MS;
      if (current.reviewedAt > now || current.direction !== "production") continue;
      if (!isUnaided(current) || current.responseCorrect === undefined) continue;
      if (gap < min || gap > max) continue;
      qualifying.push(current);
    }
  }
  const latest = new Map<string, ReviewRecord>();
  for (const review of qualifying) latest.set(review.cardId, review);
  const correct = qualifying.filter((review) => review.responseCorrect === true).length;
  return {
    targetDays,
    minGapDays: min,
    maxGapDays: max,
    windowDays: targetDays,
    minRestDays: min,
    attempts: qualifying.length,
    correct,
    rate: qualifying.length ? correct / qualifying.length : null,
    cards: new Set(qualifying.map((review) => review.cardId)).size,
    heldCardIds: [...latest.values()]
      .filter((review) => review.responseCorrect === true)
      .sort((left, right) => right.reviewedAt - left.reviewedAt)
      .map((review) => review.cardId),
  };
}

/** Strict observed production checks at the three delayed-learning horizons. */
export function computeDelayedProduction(
  reviews: ReviewRecord[],
  now: number = Date.now(),
): DelayedProductionStats {
  return {
    d7: delayedWindow(reviews, 7, now),
    d30: delayedWindow(reviews, 30, now),
    d60: delayedWindow(reviews, 60, now),
  };
}
