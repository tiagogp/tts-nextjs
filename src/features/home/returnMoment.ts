import type { Card } from "@/lib/cards/schema";

/**
 * The calm habit loop's two anchor moments, as pure logic:
 *
 *   • the return moment on "Hoje" — "N cards para hoje — 1 veio do seu erro de ontem"
 *   • the tomorrow preview at the end of a study session — the reason to come back
 *
 * Two honesty rules keep this habit copy grounded in real review data:
 *
 *   1. A "came from your mistake" claim must be backed by a due card whose
 *      provenance (`card.source.kind === "error"`) points at a real ErrorEvent —
 *      never by the mere existence of yesterday's errors.
 *   2. The moment fires on every return day (D+1, D+2, …, D+7), with the same calm
 *      framing regardless of the gap. No guilt copy, no urgency invention.
 */

/** The card fields provenance counting needs — full `Card`s satisfy this. */
export type DueCardLike = Pick<Card, "source" | "errorType">;

export interface ReturnMoment {
  /** Cards due right now (the due queue length, not the raw SRS count). */
  due: number;
  /** How many of those due cards were derived from the learner's own errors. */
  mistakeCards: number;
  /** True when at least one mistake card's source error was made yesterday. */
  fromYesterday: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-calendar day index, so "yesterday" follows the user's wall clock, not UTC. */
export function localDayIndex(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return Math.round(d.getTime() / DAY_MS);
}

/** Epoch ms of the local end of tomorrow — the horizon for "what tomorrow holds". */
export function endOfTomorrowLocal(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 2 * DAY_MS - 1;
}

/**
 * Count due cards that came from the learner's own errors, and whether any of
 * their source errors were made on `matchDay` (yesterday for Hoje, today for the
 * end-of-session preview).
 */
export function mistakeCardStats(
  dueCards: DueCardLike[],
  errors: { id: string; createdAt: number }[],
  matchDay?: number,
): { mistakeCards: number; fromMatchDay: boolean } {
  const errorDay = new Map(errors.map((e) => [e.id, localDayIndex(e.createdAt)]));
  let mistakeCards = 0;
  let fromMatchDay = false;
  for (const card of dueCards) {
    const isErrorDerived = card.source?.kind === "error" || card.errorType != null;
    if (!isErrorDerived) continue;
    mistakeCards += 1;
    if (matchDay !== undefined && card.source?.kind === "error") {
      if (errorDay.get(card.source.id) === matchDay) fromMatchDay = true;
    }
  }
  return { mistakeCards, fromMatchDay };
}

/**
 * The "Hoje" return moment. Null on the learner's first active day (nothing to
 * return to) and when nothing is due; otherwise it fires on every return day so
 * D+2…D+7 opens get the same designed moment as D+1.
 */
export function returnMomentFor(input: {
  dueCards: DueCardLike[];
  activity: { ts: number }[];
  errors: { id: string; createdAt: number }[];
  now?: number;
}): ReturnMoment | null {
  if (input.dueCards.length === 0 || input.activity.length === 0) return null;
  const now = input.now ?? Date.now();
  const today = localDayIndex(now);
  const firstDay = Math.min(...input.activity.map((event) => localDayIndex(event.ts)));
  if (today <= firstDay) return null;
  const { mistakeCards, fromMatchDay } = mistakeCardStats(
    input.dueCards,
    input.errors,
    today - 1,
  );
  return { due: input.dueCards.length, mistakeCards, fromYesterday: fromMatchDay };
}
