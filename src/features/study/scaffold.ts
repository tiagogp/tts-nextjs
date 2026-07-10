/**
 * Phase 1 #3 — review-time scaffolding logic, kept pure so the policy (when to offer
 * support, when to withdraw it) is testable independent of the React surface.
 *
 * The whole point is ZDP support *on the way down*: hints/slow-audio/modality help while
 * a card is fragile, then disappear once FSRS says it's genuinely stable. Scaffolds are
 * always opt-in and never auto-revealed for a healthy card — the default loop stays
 * flip → recall → grade.
 */

import { Rating, State, recallProbability, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

/** Scaffold tiers, matching `ReviewRecord.scaffoldLevel`. Telemetry records the max used. */
export const SCAFFOLD = {
  none: 0,
  /** Slow-audio replay — lightest nudge, answer still recalled cold. */
  hint: 1,
  /** Partial reveal of the answer (first letters + masked length). */
  partial: 2,
  /** Modality fallback — listen + repeat instead of producing cold. */
  modality: 3,
} as const;

/** A card is "stable" once FSRS has it in Review with high predicted recall. */
const STABLE_RECALL = 0.9;
/** Consecutive struggles before we offer the listen-and-repeat fallback. */
const MODALITY_FAILURE_STREAK = 3;

/**
 * Consecutive most-recent `Again` grades for a card. A run of these is the honest signal
 * that "produce cold" is above the learner's current reach for this item.
 */
export function recentFailureCount(cardId: string, reviews: ReviewRecord[]): number {
  const history = reviews
    .filter((r) => r.cardId === cardId)
    .sort((a, b) => b.reviewedAt - a.reviewedAt);
  let streak = 0;
  for (const r of history) {
    if (r.grade === Rating.Again) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Withdrawal rule: once a card reaches Review state with predicted recall ≥ 0.9, scaffolds
 * stop being offered by default (the learner can still ask). Keeps stable cards on the bare
 * retrieval loop instead of letting support curdle into passive recognition.
 */
export function isStable(srs: SrsRecord, at: Date = new Date()): boolean {
  return srs.state === State.Review && recallProbability(srs, at) >= STABLE_RECALL;
}

/** Offer the listen-and-repeat fallback only after a genuine run of failures. */
export function shouldOfferModalityFallback(failureCount: number): boolean {
  return failureCount >= MODALITY_FAILURE_STREAK;
}

/**
 * A partial cue for the answer: first letter of each word kept, the rest masked to dots so
 * length still reads. e.g. "see you around" → "s•• y•• a•••••". Enough to unstick recall
 * without handing over the answer.
 */
export function buildHint(back: string): string {
  return back
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token.length === 0) return token;
      const [first, ...rest] = [...token];
      return first + rest.map((c) => (/[\p{L}\p{N}]/u.test(c) ? "•" : c)).join("");
    })
    .join("");
}
