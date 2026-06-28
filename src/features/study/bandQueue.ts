/**
 * Phase 3 #7 wiring — connect the (already-built, already-tested) difficulty band to the live
 * study queue, **gated by the honest offline check**.
 *
 * `src/lib/srs/band.ts` owns the pure policy (`orderByBand`) and the gate (`simulateBandGate`).
 * This module is the thin glue between that policy and the queue StudyTab renders: it runs the
 * gate over the real review log and only re-orders the due queue toward the ~0.72 band when the
 * gate returns "adopt". FSRS still decides *which* cards are due; the band only re-orders them.
 *
 * Kept pure (no IndexedDB / React) so the gating decision stays testable.
 */

import type { Skill } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import { orderByBand, simulateBandGate, type BandGateResult } from "@/lib/srs/band";
import { skillOfCard, type SkillState } from "@/lib/srs/skillState";
import type { ReviewRecord } from "@/lib/store/repository";
import type { DueCard } from "./components/StudyCard";

export interface BandQueueResult {
  /** The queue to study — band-ordered when adopted, otherwise plain FSRS due order. */
  queue: DueCard[];
  /** The offline gate's metrics, verdict, and plain-language note (for surfacing honestly). */
  gate: BandGateResult;
  /** True only when the gate said "adopt" and the queue was actually re-ordered. */
  applied: boolean;
}

/**
 * Resolve each due card's current skill fatigue (from `deriveSkillStates`) so the band can pull
 * its target recall down when the relevant skill is drained. Mirrors `skillState`'s own card
 * classification, including the spoken→speaking override, so ordering and the planner agree.
 */
export function fatigueByCard(
  states: Record<Skill, SkillState>,
  pronAttempts: PronunciationAttempt[],
): (c: DueCard) => number {
  const spoken = new Set(
    pronAttempts.map((a) => a.cardId).filter((id): id is string => !!id),
  );
  return (c) => states[skillOfCard(c.card, { hasSpeechAttempt: spoken.has(c.card.id) })].fatigue;
}

/**
 * Build the standard study queue. Runs the offline gate over the full review log; only on an
 * "adopt" verdict is the already-due queue re-ordered toward the band (urgency still protects
 * badly-overdue cards). On "skip" / "insufficient-data" the queue is returned untouched, so a
 * thin or already-on-band log changes nothing the learner sees.
 */
export function orderDueQueue(
  due: DueCard[],
  reviews: ReviewRecord[],
  opts: { fatigueOf?: (c: DueCard) => number; at?: Date } = {},
): BandQueueResult {
  const gate = simulateBandGate(reviews);
  if (gate.verdict !== "adopt") return { queue: due, gate, applied: false };
  return { queue: orderByBand(due, opts), gate, applied: true };
}
