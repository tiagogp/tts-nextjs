/**
 * Data layer for the study session: fetch the store snapshot and derive the
 * band-gated due queue. No React here — these run against the repository
 * directly, so the load/order pipeline is testable with fake-indexeddb.
 */

import {
  getCards,
  getCardsWithSrs,
  getConversations,
  getCounts,
  getDueCards,
  getErrorEvents,
  getPronunciationAttempts,
  getReviews,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { SrsRecord } from "@/lib/srs/fsrs";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { BandGateResult } from "@/lib/srs/band";
import { deriveSkillStates } from "@/lib/srs/skillState";
import { fatigueByCard, orderDueQueue } from "./bandQueue";
import type { DueCard } from "./components/StudyCard";

/** P3 #7 — a due queue plus the band-gate verdict that decided its order. */
export interface OrderedDueQueue {
  queue: DueCard[];
  gate: BandGateResult;
}

export interface StudySnapshot extends OrderedDueQueue {
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  counts: { cards: number; reviews: number; due: number };
  /** All saved cards, newest first. */
  cards: Card[];
  /** P2 #5 — current cards with SRS + speech logs, the inputs the cycle planner reads. */
  cardsWithSrs: { card: Card; srs: SrsRecord }[];
  pronAttempts: PronunciationAttempt[];
}

/** Everything the study tab reads, fetched in one parallel round trip. */
export async function loadStudySnapshot(): Promise<StudySnapshot> {
  const [due, reviews, errorEvents, conversations, counts, allCards, cardsWithSrs, pronAttempts] =
    await Promise.all([
      getDueCards(),
      getReviews(),
      getErrorEvents(),
      getConversations(),
      getCounts(),
      getCards(),
      getCardsWithSrs(),
      getPronunciationAttempts(),
    ]);
  const { queue, gate } = orderDue(due, reviews, cardsWithSrs, pronAttempts, errorEvents);
  return {
    queue,
    gate,
    reviews,
    errorEvents,
    conversations,
    counts,
    cards: allCards.sort((a, b) => b.createdAt - a.createdAt),
    cardsWithSrs,
    pronAttempts,
  };
}

/**
 * P3 #7 — rebuild the standard (band-gated) due queue after a grade or when returning from a
 * drill/light round. Refetches the inputs the gate + fatigue weighting need so the ordering
 * reflects the review just recorded. Light and reinforcement queues bypass this by design.
 */
export async function loadOrderedDueQueue(): Promise<OrderedDueQueue> {
  const [due, reviews, cardsWithSrs, pronAttempts, errorEvents] = await Promise.all([
    getDueCards(),
    getReviews(),
    getCardsWithSrs(),
    getPronunciationAttempts(),
    getErrorEvents(),
  ]);
  return orderDue(due, reviews, cardsWithSrs, pronAttempts, errorEvents);
}

/** Gate the band over the real log; only re-order the due queue if it says "adopt". */
function orderDue(
  due: DueCard[],
  reviews: ReviewRecord[],
  cardsWithSrs: { card: Card; srs: SrsRecord }[],
  pronAttempts: PronunciationAttempt[],
  errorEvents: ErrorEvent[],
): OrderedDueQueue {
  const states = deriveSkillStates(reviews, cardsWithSrs, pronAttempts, errorEvents);
  return orderDueQueue(due, reviews, { fatigueOf: fatigueByCard(states, pronAttempts) });
}
