/**
 * D3 — performance tracking and D4 — weakness detection.
 *
 * Both are pure functions over the review log so they stay testable and never touch
 * IndexedDB directly. A review is a "lapse" when graded Again, a "struggle" when graded
 * Again or Hard. Weakness = a concept (or error type) you keep struggling with.
 */

import { Rating } from "@/lib/srs/fsrs";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { ReviewRecord } from "@/lib/store/repository";

const DAY_MS = 86_400_000;

/* ──────────────────────────── D3: performance ──────────────────────────── */

export interface PerformanceStats {
  totalReviews: number;
  /** Share of reviews graded Good or Easy. */
  accuracy: number;
  /** Share of reviews graded Again (a real failure). */
  lapseRate: number;
  reviewsToday: number;
  /** Consecutive days (ending today) with at least one review. */
  streakDays: number;
  /** Reviews per day for the last 14 days, oldest first. */
  daily: { day: string; count: number }[];
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computePerformance(
  reviews: ReviewRecord[],
  now: number = Date.now(),
): PerformanceStats {
  const total = reviews.length;
  const passed = reviews.filter((r) => r.grade >= Rating.Good).length;
  const lapses = reviews.filter((r) => r.grade === Rating.Again).length;
  const todayKey = dayKey(now);
  const reviewsToday = reviews.filter((r) => dayKey(r.reviewedAt) === todayKey).length;

  const byDay = new Set(reviews.map((r) => dayKey(r.reviewedAt)));
  let streak = 0;
  for (let i = 0; ; i++) {
    if (byDay.has(dayKey(now - i * DAY_MS))) streak++;
    else break;
  }

  const daily: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS);
    daily.push({ day: key, count: reviews.filter((r) => dayKey(r.reviewedAt) === key).length });
  }

  return {
    totalReviews: total,
    accuracy: total ? passed / total : 0,
    lapseRate: total ? lapses / total : 0,
    reviewsToday,
    streakDays: streak,
    daily,
  };
}

/* ──────────────────────────── D4: weakness detection ──────────────────────────── */

/**
 * Where a weakness is heading over time. A flashcard's recall improving only means you
 * recognize the card better — it doesn't tell you you're producing the language better.
 * So the trend is read from your *production*: are new ErrorEvents of this type still
 * piling up, or slowing down? Only error-type weaknesses get a trend, because that's
 * the only key ErrorEvents carry.
 */
export type WeaknessTrend = "improving" | "worsening" | "stable";

export interface Weakness {
  /** The grouping key — a concept string, an ErrorType, or a situational context. */
  label: string;
  kind: "concept" | "errorType" | "context";
  reviews: number;
  /** Share graded Again or Hard — the higher, the weaker. */
  struggleRate: number;
  lapses: number;
  /**
   * Direction of *production* errors over time (recent vs earlier half of the
   * timeline). "stable" when there's no production signal — e.g. concept weaknesses,
   * which ErrorEvents don't tag.
   */
  trend: WeaknessTrend;
  /**
   * Signed share shift of errors toward the recent window, in [-1, 1].
   * Negative = errors slowing down = improving.
   */
  trendDelta: number;
}

const STABLE = { trend: "stable" as const, trendDelta: 0 };

/** Don't flag something as a weakness until we've seen it enough to be meaningful. */
const MIN_REVIEWS = 3;

/** Below this many production errors, the timeline is too sparse to read a trend. */
const MIN_TREND_EVENTS = 4;

/** Share shifts smaller than this are noise, not a trend. */
const TREND_EPSILON = 0.1;

function struggles(r: ReviewRecord): boolean {
  return r.grade === Rating.Again || r.grade === Rating.Hard;
}

function struggleRate(list: ReviewRecord[]): number {
  return list.length ? list.filter(struggles).length / list.length : 0;
}

/**
 * Split an error type's timeline in half by time (first occurrence → now) and compare
 * how many errors fell in each half. Fewer recent errors → improving (↓); more →
 * worsening (↑). Equal-duration windows make the two counts directly comparable.
 *
 * Caveat: this has no denominator for how much you wrote, so a quiet stretch reads the
 * same as genuine improvement. It's the best production signal we have today.
 */
function productionTrend(
  events: ErrorEvent[],
  now: number,
): { trend: WeaknessTrend; trendDelta: number } {
  if (events.length < MIN_TREND_EVENTS) return STABLE;
  const first = Math.min(...events.map((e) => e.createdAt));
  if (now <= first) return STABLE;
  const mid = first + (now - first) / 2;
  let earlier = 0;
  let recent = 0;
  for (const e of events) {
    if (e.createdAt < mid) earlier++;
    else recent++;
  }
  const delta = (recent - earlier) / events.length;
  if (delta <= -TREND_EPSILON) return { trend: "improving", trendDelta: delta };
  if (delta >= TREND_EPSILON) return { trend: "worsening", trendDelta: delta };
  return { trend: "stable", trendDelta: delta };
}

/** Production trend per error type, keyed by ErrorType. */
function productionTrends(
  events: ErrorEvent[],
  now: number,
): Map<string, { trend: WeaknessTrend; trendDelta: number }> {
  const byType = new Map<string, ErrorEvent[]>();
  for (const e of events) {
    for (const t of e.errorTypes) {
      const list = byType.get(t);
      if (list) list.push(e);
      else byType.set(t, [e]);
    }
  }
  const out = new Map<string, { trend: WeaknessTrend; trendDelta: number }>();
  for (const [type, list] of byType) out.set(type, productionTrend(list, now));
  return out;
}

function group(
  reviews: ReviewRecord[],
  kind: Weakness["kind"],
  keyOf: (r: ReviewRecord) => string | undefined,
): Weakness[] {
  const buckets = new Map<string, ReviewRecord[]>();
  for (const r of reviews) {
    const key = keyOf(r);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }
  const out: Weakness[] = [];
  for (const [label, list] of buckets) {
    if (list.length < MIN_REVIEWS) continue;
    const lapses = list.filter((r) => r.grade === Rating.Again).length;
    out.push({
      label,
      kind,
      reviews: list.length,
      struggleRate: struggleRate(list),
      lapses,
      ...STABLE,
    });
  }
  return out;
}

/**
 * The "tutor": recurring weak concepts/error-types, worst first. Only entries with a
 * real struggle rate are returned, so a clean history yields an empty list.
 *
 * `errorEvents` (your production history) drives the per-error-type trend. Pass them in
 * to see whether a weakness is actually getting better in your writing, not just on the
 * flashcard. Omit them and every weakness reads as "stable".
 */
export function detectWeaknesses(
  reviews: ReviewRecord[],
  errorEvents: ErrorEvent[] = [],
  now: number = Date.now(),
): Weakness[] {
  const trends = productionTrends(errorEvents, now);
  const byConcept = group(reviews, "concept", (r) => r.concept?.trim() || undefined);
  const byErrorType = group(reviews, "errorType", (r) => r.errorType);
  // Where you keep getting stuck by *situation* ("work", "travel") — the dimension the
  // conversation path stamps. Like concepts, contexts carry no production trend (stable).
  const byContext = group(reviews, "context", (r) => r.context?.trim() || undefined);
  for (const w of byErrorType) {
    const t = trends.get(w.label);
    if (t) {
      w.trend = t.trend;
      w.trendDelta = t.trendDelta;
    }
  }
  return [...byConcept, ...byErrorType, ...byContext]
    .filter((w) => w.struggleRate > 0)
    .sort((a, b) => b.struggleRate - a.struggleRate || b.reviews - a.reviews);
}
