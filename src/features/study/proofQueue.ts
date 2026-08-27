import type { Card } from "@/lib/cards/schema";
import { isMixedInstrument, judgeMix, type JudgeMix } from "@/lib/evaluation/judge";
import type { ProofAttempt } from "@/lib/performance/types";

/**
 * Queue C — measurement, deliberately not study.
 *
 * The D7/D30/D60 numbers on the progress panel were measured opportunistically: they looked
 * for pairs of consecutive reviews whose gap happened to land near 7, 30 or 60 days. But
 * FSRS chooses those gaps, and FSRS only schedules a month out for cards the learner keeps
 * getting right. Hard cards never enter the window; easy cards jump over it. The app's
 * strictest metric was therefore computed over a sample selected by its own success — the
 * easiest subset of the material, reported as retention of the whole.
 *
 * The fix is not a better filter over review history. It is a second queue that:
 *
 *   - samples items **independently of stability**, so a card the learner keeps failing is
 *     just as likely to be proved as one they find easy;
 *   - dates the window from **acquisition** (the first review of the item), not from
 *     whatever the previous review happened to be;
 *   - asks for **unaided production** — no hint, no partial reveal, no audio;
 *   - and, the part that makes it a measurement at all, **does not feed the scheduler**.
 *     Nothing here writes SRS state or a ReviewRecord. A proof that reschedules the card is
 *     just another review, and the measurement contaminates the thing it measures.
 */

export type ProofTarget = 7 | 30 | 60;

export const PROOF_TARGETS: ProofTarget[] = [7, 30, 60];

/**
 * Tolerance around each target. Wide enough that a learner who studies four days a week
 * still hits it, narrow enough that "D30" means something.
 */
export const PROOF_WINDOWS: Record<ProofTarget, { min: number; max: number }> = {
  7: { min: 5, max: 12 },
  30: { min: 24, max: 45 },
  60: { min: 50, max: 90 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProofCandidate {
  cardId: string;
  targetDays: ProofTarget;
  /** Days since the learner first studied this item. */
  ageDays: number;
  acquiredAt: number;
}

export interface ProofSelectionInput {
  cards: Card[];
  /** First review per card — when the item entered the learner's memory. */
  acquiredAt: Map<string, number>;
  attempts: ProofAttempt[];
  now?: number;
  /** How many items to prove per session. Small: this is not the study session. */
  limit?: number;
}

/**
 * Items due for proof, sampled without reference to how well the learner knows them.
 *
 * Deliberately absent from this function: SRS state, stability, difficulty, due date, and
 * the learner's grade history. Reading any of them here would rebuild the survivorship bias
 * this queue exists to remove.
 */
export function selectProofItems({
  cards,
  acquiredAt,
  attempts,
  now = Date.now(),
  limit = 3,
}: ProofSelectionInput): ProofCandidate[] {
  const done = new Set(attempts.map((attempt) => `${attempt.cardId}:${attempt.targetDays}`));
  const candidates: ProofCandidate[] = [];

  for (const card of cards) {
    // Production only. A recognition card can clear from acoustic familiarity, so proving it
    // would measure the one thing this queue is meant to exclude.
    if (card.direction !== "production") continue;
    const acquired = acquiredAt.get(card.id);
    if (acquired === undefined) continue;
    const ageDays = (now - acquired) / DAY_MS;

    for (const targetDays of PROOF_TARGETS) {
      const window = PROOF_WINDOWS[targetDays];
      if (ageDays < window.min || ageDays > window.max) continue;
      if (done.has(`${card.id}:${targetDays}`)) continue;
      candidates.push({ cardId: card.id, targetDays, ageDays, acquiredAt: acquired });
    }
  }

  // Oldest window first, so a D60 chance that is about to expire is not lost to a D7 that
  // will still be available tomorrow. Within a window, the item closest to its target.
  candidates.sort((left, right) =>
    right.targetDays - left.targetDays ||
    Math.abs(left.ageDays - left.targetDays) - Math.abs(right.ageDays - right.targetDays));

  // One proof per card per session: proving three windows of the same item in one sitting
  // measures one memory three times.
  const chosen: ProofCandidate[] = [];
  const usedCards = new Set<string>();
  for (const candidate of candidates) {
    if (chosen.length >= limit) break;
    if (usedCards.has(candidate.cardId)) continue;
    usedCards.add(candidate.cardId);
    chosen.push(candidate);
  }
  return chosen;
}

export interface ProofWindowStats {
  targetDays: ProofTarget;
  attempts: number;
  correct: number;
  /** Null, never zero, when nothing has been proved at this horizon yet. */
  rate: number | null;
  cards: number;
  /** Attempts the local check could not judge, excluded from the rate above. */
  unjudged: number;
  /**
   * Who judged the attempts behind `rate`. A window that straddles two instruments — a
   * rewritten offline checker, or a model that replaced one — is not a like-for-like
   * comparison, and `mixed` is how the UI knows to say so instead of showing a trend.
   */
  judges: JudgeMix;
  mixed: boolean;
}

export type ProofRetention = Record<ProofTarget, ProofWindowStats>;

/**
 * Retention at each horizon, over the proof queue only.
 *
 * An attempt whose correctness is `undefined` — the evaluator could not tell a valid
 * paraphrase from a wrong answer — is counted in `unjudged` and excluded from the rate,
 * rather than being folded in as a failure. Same rule as everywhere else here: an
 * unmeasured outcome is null, not a zero.
 */
export function computeProofRetention(attempts: ProofAttempt[]): ProofRetention {
  const result = {} as ProofRetention;
  for (const targetDays of PROOF_TARGETS) {
    const forWindow = attempts.filter((attempt) => attempt.targetDays === targetDays);
    const judged = forWindow.filter((attempt) => attempt.correct !== undefined);
    const correct = judged.filter((attempt) => attempt.correct === true).length;
    const mix = judgeMix(judged.map((attempt) => attempt.judge));
    result[targetDays] = {
      targetDays,
      attempts: judged.length,
      correct,
      rate: judged.length === 0 ? null : correct / judged.length,
      cards: new Set(judged.map((attempt) => attempt.cardId)).size,
      unjudged: forWindow.length - judged.length,
      judges: mix,
      mixed: isMixedInstrument(mix),
    };
  }
  return result;
}
