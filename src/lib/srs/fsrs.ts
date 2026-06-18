/**
 * D2 — SRS engine. Thin wrapper over `ts-fsrs` so the rest of the app never touches
 * the FSRS card shape directly (it uses Date objects; we persist epoch-ms numbers).
 */

import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
} from "ts-fsrs";

export { Rating, State };

/** The four grades a learner can give, in display order. */
export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
export type Grade = (typeof GRADES)[number];

/**
 * FSRS scheduling state for one card, serialized for IndexedDB.
 * Dates become epoch-ms so the `due` index supports range queries.
 */
export interface SrsRecord {
  cardId: string;
  /** Epoch ms when this card is next due. Indexed. */
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** ts-fsrs State enum: New / Learning / Review / Relearning. */
  state: State;
  /** Epoch ms of the last review, if any. */
  last_review?: number;
}

const scheduler = fsrs();

function serialize(cardId: string, c: FsrsCard): SrsRecord {
  return {
    cardId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : undefined,
  };
}

function deserialize(rec: SrsRecord): FsrsCard {
  return {
    due: new Date(rec.due),
    stability: rec.stability,
    difficulty: rec.difficulty,
    elapsed_days: rec.elapsed_days,
    scheduled_days: rec.scheduled_days,
    learning_steps: rec.learning_steps,
    reps: rec.reps,
    lapses: rec.lapses,
    state: rec.state,
    last_review: rec.last_review ? new Date(rec.last_review) : undefined,
  };
}

/** Fresh scheduling state for a newly created card (due immediately). */
export function initialSrs(cardId: string, now: Date = new Date()): SrsRecord {
  return serialize(cardId, createEmptyCard(now));
}

/** Apply a grade, returning the updated state plus the review-log entry FSRS produced. */
export function applyGrade(
  rec: SrsRecord,
  grade: Grade,
  now: Date = new Date(),
): { next: SrsRecord; scheduledDays: number; previousState: State } {
  const { card, log } = scheduler.next(deserialize(rec), now, grade);
  return {
    next: serialize(rec.cardId, card),
    scheduledDays: log.scheduled_days,
    previousState: log.state,
  };
}

/** Human-readable "next review" hint for a grade button, e.g. "10m" / "3d". */
export function previewInterval(rec: SrsRecord, grade: Grade, now: Date = new Date()): string {
  const { card } = scheduler.next(deserialize(rec), now, grade);
  const ms = card.due.getTime() - now.getTime();
  return formatInterval(ms);
}

function formatInterval(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: "Again",
  [Rating.Hard]: "Hard",
  [Rating.Good]: "Good",
  [Rating.Easy]: "Easy",
};
