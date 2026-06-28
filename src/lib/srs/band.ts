/**
 * Phase 3 #7 — difficulty band on top of FSRS.
 *
 * FSRS owns *scheduling* (when a card is due). The band owns only *ordering/selection*: among
 * the cards that are already due, surface the ones whose predicted success sits in the
 * desirable-difficulty sweet spot (~0.72 recall) first — neither trivially easy (no learning
 * value) nor demoralizingly hard — while still respecting memory urgency so badly-overdue
 * cards don't get starved. Mirrors the report's `choose_next_task`.
 *
 * Per the plan this ships **gated**: `simulateBandGate` runs the honest offline check first —
 * over the real review log, do reviews already cluster near the band (band adds little) or land
 * systematically off it (band has headroom)? Only adopt the ordering if the gate says "adopt".
 * Kept pure (mirrors `analytics.ts` / `skillState.ts`) so both the policy and the gate are
 * testable away from IndexedDB and React.
 */

import { applyGrade, initialSrs, recallProbability, State, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

/** Desirable-difficulty center: ~0.72 predicted recall is the productive-struggle sweet spot. */
export const TARGET_RECALL = 0.72;
/** Half-width of the band; cards within ±this of the target count as "in band". */
const BAND_HALF_WIDTH = 0.25;
/** How far full fatigue pulls the target down — tired learners get easier (higher-recall) cards. */
const FATIGUE_SHIFT = 0.12;
/** Days overdue at which memory urgency saturates. */
const URGENCY_FULL_DAYS = 7;
/** Band-fit vs. memory-urgency weighting in the final score. */
const W_BAND = 0.7;
const W_URGENCY = 0.3;

const DAY_MS = 86_400_000;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** The recall the band aims for given current fatigue (0..1): lower target when more drained. */
export function targetRecall(fatigue = 0): number {
  return clamp01(TARGET_RECALL - FATIGUE_SHIFT * clamp01(fatigue));
}

interface CardLike {
  card: { id: string };
  srs: SrsRecord;
}

/**
 * Selection score for one due card (higher = surface sooner). Band-fit measures closeness to
 * the (fatigue-shifted) target recall; urgency measures how overdue the card is, so a card that
 * has slipped far past due still rises even if its recall has drifted off the band.
 */
export function scoreCard(srs: SrsRecord, fatigue = 0, at: Date = new Date()): number {
  const recall = recallProbability(srs, at);
  const bandFit = 1 - Math.min(1, Math.abs(recall - targetRecall(fatigue)) / BAND_HALF_WIDTH);
  const overdueDays = Math.max(0, (at.getTime() - srs.due) / DAY_MS);
  const urgency = clamp01(overdueDays / URGENCY_FULL_DAYS);
  return W_BAND * bandFit + W_URGENCY * urgency;
}

/**
 * Order an already-due queue by band-fit + memory urgency. `fatigueOf` resolves each card's
 * skill fatigue (from `deriveSkillStates`); omit it for a fatigue-neutral ordering. Pure — does
 * not touch FSRS scheduling. Ties (and equal scores) keep the earlier-due card first.
 */
export function orderByBand<T extends CardLike>(
  cards: T[],
  opts: { fatigueOf?: (c: T) => number; at?: Date } = {},
): T[] {
  const at = opts.at ?? new Date();
  const scored = cards.map((c) => ({ c, score: scoreCard(c.srs, opts.fatigueOf?.(c) ?? 0, at) }));
  scored.sort((a, b) => b.score - a.score || a.c.srs.due - b.c.srs.due);
  return scored.map((s) => s.c);
}

/* ──────────────────────────── offline gate ──────────────────────────── */

/** Below this many reconstructed retrievals the log is too thin to trust the verdict. */
const MIN_SAMPLES = 20;
/** Adopt only when the band has real headroom: this share of reviews land outside the band… */
const ADOPT_OFF_BAND = 0.4;
/** …and fewer than this share already sit inside it. */
const ADOPT_IN_BAND_CEILING = 0.6;

export interface BandGateMetrics {
  /** Retrievals reconstructed from the log (New-state first sightings excluded). */
  samples: number;
  /** Mean predicted recall the learner actually faced at review time. */
  meanRecall: number;
  /** Mean |recall − target| — how far reviews land from the band center. */
  meanDistance: number;
  /** Share of reviews within ±half-width of the target. */
  shareInBand: number;
  /** Share well above the band (recognized too easily — little learning value). */
  shareTooEasy: number;
  /** Share well below the band (above reach — likely frustrating). */
  shareTooHard: number;
}

export type BandVerdict = "adopt" | "skip" | "insufficient-data";

/**
 * Replay FSRS per card over the real review log to recover the predicted recall the learner
 * *actually faced* at each retrieval (we only persist the outcome, so we rebuild the pre-review
 * state). The first sighting of a card is a New-state introduction, not a retrieval, so it's
 * excluded. This is the distribution the band would try to pull toward `TARGET_RECALL`.
 */
export function bandGateMetrics(reviews: ReviewRecord[]): BandGateMetrics {
  const byCard = new Map<string, ReviewRecord[]>();
  for (const r of reviews) {
    const list = byCard.get(r.cardId);
    if (list) list.push(r);
    else byCard.set(r.cardId, [r]);
  }

  const recalls: number[] = [];
  for (const [cardId, list] of byCard) {
    list.sort((a, b) => a.reviewedAt - b.reviewedAt);
    let srs = initialSrs(cardId, new Date(list[0].reviewedAt));
    for (const r of list) {
      const when = new Date(r.reviewedAt);
      // Only genuine retrievals carry a meaningful predicted recall; the New-state first
      // sighting is an introduction, not a retrieval.
      if (srs.state !== State.New) {
        recalls.push(recallProbability(srs, when));
      }
      srs = applyGrade(srs, r.grade, when).next;
    }
  }

  const n = recalls.length;
  if (n === 0) {
    return { samples: 0, meanRecall: 0, meanDistance: 0, shareInBand: 0, shareTooEasy: 0, shareTooHard: 0 };
  }
  const lo = TARGET_RECALL - BAND_HALF_WIDTH;
  const hi = TARGET_RECALL + BAND_HALF_WIDTH;
  let sum = 0;
  let dist = 0;
  let inBand = 0;
  let tooEasy = 0;
  let tooHard = 0;
  for (const p of recalls) {
    sum += p;
    dist += Math.abs(p - TARGET_RECALL);
    if (p > hi) tooEasy++;
    else if (p < lo) tooHard++;
    else inBand++;
  }
  return {
    samples: n,
    meanRecall: sum / n,
    meanDistance: dist / n,
    shareInBand: inBand / n,
    shareTooEasy: tooEasy / n,
    shareTooHard: tooHard / n,
  };
}

/** Threshold logic, split out so it's exhaustively testable apart from the FSRS replay. */
export function gateVerdict(m: BandGateMetrics): BandVerdict {
  if (m.samples < MIN_SAMPLES) return "insufficient-data";
  const offBand = m.shareTooEasy + m.shareTooHard;
  if (offBand >= ADOPT_OFF_BAND && m.shareInBand < ADOPT_IN_BAND_CEILING) return "adopt";
  return "skip";
}

export interface BandGateResult {
  metrics: BandGateMetrics;
  verdict: BandVerdict;
  /** One-line, honest read of the result for a human running the gate. */
  note: string;
}

/**
 * The honest offline check the plan demands *before any UI*: would biasing selection toward the
 * ~0.72 band have changed which cards surfaced and improved predicted retention? Returns the
 * reconstructed metrics, a verdict, and a plain-language note. Only wire `orderByBand` into the
 * study queue if the verdict is "adopt" — and confirm it live with a delayed-recall gate.
 */
export function simulateBandGate(reviews: ReviewRecord[]): BandGateResult {
  const metrics = bandGateMetrics(reviews);
  const verdict = gateVerdict(metrics);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  let note: string;
  if (verdict === "insufficient-data") {
    note = `Only ${metrics.samples} retrievals reconstructed — need ≥${MIN_SAMPLES} before trusting a verdict.`;
  } else if (verdict === "adopt") {
    note =
      `${pct(metrics.shareTooEasy)} too-easy / ${pct(metrics.shareTooHard)} too-hard reviews land off the band ` +
      `(only ${pct(metrics.shareInBand)} in band) — band ordering has headroom. Verify live before shipping.`;
  } else {
    note =
      `${pct(metrics.shareInBand)} of reviews already sit in the band (mean recall ${pct(metrics.meanRecall)}) — ` +
      `band ordering would change little. Skip until the distribution drifts off-target.`;
  }
  return { metrics, verdict, note };
}
