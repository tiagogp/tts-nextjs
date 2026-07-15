/**
 * Level advancement — readiness model. Pure functions over existing logs (mirrors
 * `analytics.ts` / `band.ts`): no new storage, readiness is derived on read from the
 * progress snapshot, the weakness list, and current card/SRS state.
 *
 * The trust rule from docs/product.md applies here: a gap is only surfaced
 * when real evidence (the learner's own sentence or phrase) can be attached to it —
 * a bare "Weak" label with no example is dropped, not shown.
 */

import type { EnglishLevel } from "@/features/discover/types";
import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { ProgressSnapshot, SkillKey } from "@/features/progress/model";
import type { Weakness } from "@/lib/srs/analytics";
import type { SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";
import { STABILITY_TARGET_DAYS } from "@/lib/srs/skillState";

const DAY_MS = 86_400_000;
/** Evidence windows: reviews counted and check-ins accepted within this many days. */
const VOLUME_WINDOW_DAYS = 30;
const CHECKIN_WINDOW_DAYS = 30;
/** Recall criterion: recent-review pass score and minimum sample size. */
const RECALL_SCORE = 80;
const RECALL_MIN_SAMPLES = 10;
/** Production criterion: grammar signal floor + what counts as a blocking weakness. */
const GRAMMAR_SCORE = 75;
const BLOCKING_STRUGGLE_RATE = 0.5;
/** Overall criterion: whole-snapshot floor (matches the "level-readiness" milestone). */
const OVERALL_SCORE = 80;
/** How many evidence-backed gaps the coach surfaces at once. */
const MAX_GAPS = 5;

/** The advancement ladder. C1 is terminal — C1→C2 is explicitly out of scope. */
const LADDER: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export function nextLevelOf(level: EnglishLevel): EnglishLevel | null {
  const index = LADDER.indexOf(level);
  if (index === -1 || index === LADDER.length - 1) return null;
  return LADDER[index + 1];
}

/** Per-transition thresholds, keyed by the *current* level. Higher bands demand more. */
interface BandThresholds {
  /** Reviews in the last {@link VOLUME_WINDOW_DAYS} days. */
  volume: number;
  /** Cards whose FSRS stability has reached {@link STABILITY_TARGET_DAYS}. */
  stableCards: number;
  /** Naturalness signal floor; 0 = not required at this transition. */
  naturalness: number;
}

const THRESHOLDS: Record<EnglishLevel, BandThresholds> = {
  A1: { volume: 30, stableCards: 15, naturalness: 0 },
  A2: { volume: 40, stableCards: 25, naturalness: 0 },
  B1: { volume: 60, stableCards: 40, naturalness: 65 },
  B2: { volume: 80, stableCards: 60, naturalness: 70 },
  // Terminal levels — never consulted, present so the record stays total.
  C1: { volume: 80, stableCards: 60, naturalness: 70 },
  C2: { volume: 80, stableCards: 60, naturalness: 70 },
};

export type ReadinessCriterionId =
  | "volume"
  | "recall"
  | "stability"
  | "production"
  | "overall"
  | "checkin";

export interface ReadinessCriterion {
  id: ReadinessCriterionId;
  achieved: boolean;
  /** 0..1 — how far along this criterion is; feeds the evidence bar. */
  progress: number;
  /** Observed value (count or score) so the UI can show real evidence, localized. */
  current: number;
  /** The bar this criterion asks for (count or score). */
  target: number;
}

/** A weakness with the learner's own evidence attached (trust rule). */
export interface ReadinessGap {
  weakness: Weakness;
  example:
    | { kind: "error"; original: string; corrected: string }
    | { kind: "phrase"; front: string; back: string };
}

export interface LevelReadiness {
  currentLevel: EnglishLevel;
  /** null when the ladder ends (C1/C2) — the coach shows a terminal state. */
  targetLevel: EnglishLevel | null;
  /** All criteria achieved — the level test is unlocked. */
  eligible: boolean;
  /** 0..100 mean criterion progress — the evidence bar. */
  score: number;
  criteria: ReadinessCriterion[];
  /** Worst-first weaknesses standing between the learner and the next level. */
  gaps: ReadinessGap[];
}

export interface LevelReadinessInput {
  profileLevel: EnglishLevel;
  snapshot: ProgressSnapshot;
  weaknesses: Weakness[];
  errorEvents: ErrorEvent[];
  cards: Card[];
  cardsWithSrs: { card: Card; srs: SrsRecord }[];
  reviews: ReviewRecord[];
  /** Newest `kind: "checkin"` assessment timestamp, if any. */
  lastCheckinAt?: number;
  now?: number;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function skillScore(snapshot: ProgressSnapshot, key: SkillKey): { score: number; samples: number } {
  const skill = snapshot.skills.find((s) => s.key === key);
  return { score: skill?.score ?? 0, samples: skill?.samples ?? 0 };
}

/** A weakness bad enough to block advancement: still worsening and struggled with half the time. */
function isBlocking(w: Weakness): boolean {
  return w.trend === "worsening" && w.struggleRate >= BLOCKING_STRUGGLE_RATE;
}

/** Attach the learner's own evidence to a weakness; null when none can be found. */
export function gapEvidence(
  weakness: Weakness,
  errorEvents: ErrorEvent[],
  cards: Card[],
): ReadinessGap["example"] | null {
  if (weakness.kind === "errorType") {
    const newest = errorEvents
      .filter((event) => event.errorTypes.includes(weakness.label as ErrorEvent["errorTypes"][number]))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (newest) return { kind: "error", original: newest.original, corrected: newest.corrected };
  }
  const match = cards
    .filter((card) =>
      weakness.kind === "context" ? card.context === weakness.label : card.concept === weakness.label,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (match) return { kind: "phrase", front: match.front, back: match.back };
  return null;
}

export function computeLevelReadiness(input: LevelReadinessInput): LevelReadiness {
  const now = input.now ?? Date.now();
  const currentLevel = input.profileLevel;
  const targetLevel = nextLevelOf(currentLevel);
  const thresholds = THRESHOLDS[currentLevel];

  const recentReviews = input.reviews.filter(
    (review) => review.reviewedAt >= now - VOLUME_WINDOW_DAYS * DAY_MS,
  ).length;
  const stableCards = input.cardsWithSrs.filter(
    (entry) => entry.srs.stability >= STABILITY_TARGET_DAYS,
  ).length;
  const recall = skillScore(input.snapshot, "recall");
  const grammar = skillScore(input.snapshot, "grammar");
  const naturalness = skillScore(input.snapshot, "naturalness");
  const blocking = input.weaknesses.filter(isBlocking);
  const checkinFresh =
    input.lastCheckinAt != null && now - input.lastCheckinAt <= CHECKIN_WINDOW_DAYS * DAY_MS;

  const productionParts = [
    clamp01(grammar.score / GRAMMAR_SCORE),
    blocking.length === 0 ? 1 : 0,
    ...(thresholds.naturalness > 0 ? [clamp01(naturalness.score / thresholds.naturalness)] : []),
  ];
  const criteria: ReadinessCriterion[] = [
    {
      id: "volume",
      achieved: recentReviews >= thresholds.volume,
      progress: clamp01(recentReviews / thresholds.volume),
      current: recentReviews,
      target: thresholds.volume,
    },
    {
      id: "recall",
      achieved: recall.score >= RECALL_SCORE && recall.samples >= RECALL_MIN_SAMPLES,
      progress: clamp01(recall.score / RECALL_SCORE) * clamp01(recall.samples / RECALL_MIN_SAMPLES),
      current: recall.score,
      target: RECALL_SCORE,
    },
    {
      id: "stability",
      achieved: stableCards >= thresholds.stableCards,
      progress: clamp01(stableCards / thresholds.stableCards),
      current: stableCards,
      target: thresholds.stableCards,
    },
    {
      id: "production",
      achieved:
        grammar.score >= GRAMMAR_SCORE &&
        blocking.length === 0 &&
        (thresholds.naturalness === 0 || naturalness.score >= thresholds.naturalness),
      progress: productionParts.reduce((sum, p) => sum + p, 0) / productionParts.length,
      current: grammar.score,
      target: GRAMMAR_SCORE,
    },
    {
      id: "overall",
      achieved: input.snapshot.averageScore >= OVERALL_SCORE && input.snapshot.confidence !== "low",
      progress:
        clamp01(input.snapshot.averageScore / OVERALL_SCORE) *
        (input.snapshot.confidence === "low" ? 0.5 : 1),
      current: input.snapshot.averageScore,
      target: OVERALL_SCORE,
    },
    {
      id: "checkin",
      achieved: checkinFresh,
      progress: checkinFresh ? 1 : 0,
      current: checkinFresh ? 1 : 0,
      target: 1,
    },
  ];

  const gaps: ReadinessGap[] = [];
  for (const weakness of input.weaknesses) {
    if (gaps.length >= MAX_GAPS) break;
    const example = gapEvidence(weakness, input.errorEvents, input.cards);
    if (example) gaps.push({ weakness, example });
  }

  const score = Math.round(
    (criteria.reduce((sum, c) => sum + c.progress, 0) / criteria.length) * 100,
  );

  return {
    currentLevel,
    targetLevel,
    eligible: targetLevel != null && criteria.every((c) => c.achieved),
    score,
    criteria,
    gaps,
  };
}
