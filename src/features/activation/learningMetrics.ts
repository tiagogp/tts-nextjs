import type { ListeningAttempt, ProductionAttempt } from "@/lib/performance/types";
import type { ErrorType } from "@/lib/cards/schema";
import { contentLemmas } from "@/lib/language/pattern";

/**
 * The three learning measures the app was missing, plus the fix to the one it had backwards.
 *
 * The standing rule holds throughout: a measure with no qualifying sample returns `null`,
 * never `0`. "Not measured yet" and "measured and bad" are different facts about a learner,
 * and a panel that shows 0% for both is lying about one of them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/* ─────────────────────── recurring error, with a denominator ─────────────────────── */

export interface PatternErrorRate {
  patternId: string;
  /** Attempts on this pattern that contained at least one error. */
  errors: number;
  /** Attempts that targeted this pattern at all — the chances the learner had to get it right. */
  opportunities: number;
  /** `errors / opportunities`, or null below the sample floor. */
  rate: number | null;
  /** Which error types show up on this pattern, most frequent first. */
  types: ErrorType[];
}

export const MIN_OPPORTUNITIES = 3;

/**
 * Rank weaknesses by error *per opportunity to use the pattern*, not by raw occurrences.
 *
 * Counting occurrences alone confuses "gets this wrong" with "uses this a lot". A learner
 * who missed "ended up" 3 times in 4 attempts is in much worse shape than one who missed it
 * 5 times in 40 — and a count ranking puts the second learner's problem first, so the app
 * drills what they use most instead of what they get wrong most.
 *
 * The denominator has to be per pattern for this to mean anything. Dividing every error
 * type by the same total number of attempts is count ranking with extra steps, because a
 * constant divisor cannot reorder anything. `targetPatternId` is what makes the real
 * denominator available, which is why it is recorded on every elicited attempt.
 */
export function patternErrorRates(
  attempts: ProductionAttempt[],
  options: { sinceDays?: number; now?: number; minOpportunities?: number } = {},
): PatternErrorRate[] {
  const now = options.now ?? Date.now();
  const minOpportunities = options.minOpportunities ?? MIN_OPPORTUNITIES;
  const scoped = attempts.filter((attempt) =>
    attempt.targetPatternId !== undefined &&
    attempt.errorTypesFound !== undefined &&
    (options.sinceDays === undefined || attempt.createdAt >= now - options.sinceDays * DAY_MS));

  const byPattern = new Map<string, ProductionAttempt[]>();
  for (const attempt of scoped) {
    const history = byPattern.get(attempt.targetPatternId!) ?? [];
    history.push(attempt);
    byPattern.set(attempt.targetPatternId!, history);
  }

  return [...byPattern.entries()]
    .map(([patternId, history]) => {
      const failures = history.filter((attempt) => (attempt.errorTypesFound ?? []).length > 0);
      const typeCounts = new Map<ErrorType, number>();
      for (const attempt of failures) {
        for (const type of new Set(attempt.errorTypesFound ?? [])) {
          typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
        }
      }
      return {
        patternId,
        errors: failures.length,
        opportunities: history.length,
        // Below the floor the rate is noise: one slip in two attempts is not a 50% weakness.
        rate: history.length < minOpportunities ? null : failures.length / history.length,
        types: [...typeCounts.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([type]) => type),
      };
    })
    .sort((left, right) => (right.rate ?? -1) - (left.rate ?? -1) || right.errors - left.errors);
}

export interface PatternErrorTrend {
  patternId: string;
  recent: PatternErrorRate;
  previous: PatternErrorRate;
  /** Negative means the error is getting rarer per opportunity. Null when either half is unmeasured. */
  change: number | null;
}

/** Whether recurring errors are actually going away, comparing two windows of equal length. */
export function patternErrorReduction(
  attempts: ProductionAttempt[],
  options: { windowDays?: number; now?: number } = {},
): PatternErrorTrend[] {
  const windowDays = options.windowDays ?? 30;
  const now = options.now ?? Date.now();
  const cutoff = now - windowDays * DAY_MS;
  const recentRates = patternErrorRates(attempts.filter((a) => a.createdAt >= cutoff), { now });
  const previousRates = patternErrorRates(
    attempts.filter((a) => a.createdAt < cutoff && a.createdAt >= cutoff - windowDays * DAY_MS),
    { now },
  );
  const previousByPattern = new Map(previousRates.map((rate) => [rate.patternId, rate]));

  return recentRates.map((recent) => {
    const previous = previousByPattern.get(recent.patternId) ??
      { patternId: recent.patternId, errors: 0, opportunities: 0, rate: null, types: [] };
    return {
      patternId: recent.patternId,
      recent,
      previous,
      change: recent.rate === null || previous.rate === null ? null : recent.rate - previous.rate,
    };
  });
}

/* ───────────────────────────── active vocabulary ───────────────────────────── */

export interface ActiveVocabulary {
  /** Lemmas produced unaided at least `minUses` times, `minGapDays` apart. */
  size: number;
  /** The lemmas themselves, most recently confirmed first. */
  lemmas: string[];
  /** Produced unaided at least once, but not yet twice with a gap. */
  emerging: number;
  /** Unaided productions the count is drawn from. Zero means `size` is not yet meaningful. */
  samples: number;
}

export const ACTIVE_VOCAB_MIN_USES = 2;
export const ACTIVE_VOCAB_MIN_GAP_DAYS = 7;

/**
 * How many distinct words the learner can actually produce, unprompted.
 *
 * Everything else the app measures is per card. This is the breadth number, and it is the
 * single figure that best tracks level — but only if "knows a word" is defined strictly. A
 * word counts here when the learner produced it **without scaffolding**, on **two separate
 * occasions**, at least a week apart. Producing it twice in one session is one memory used
 * twice, which is what a lax version of this metric would quietly reward.
 */
export function activeVocabulary(
  attempts: ProductionAttempt[],
  options: { minUses?: number; minGapDays?: number } = {},
): ActiveVocabulary {
  const minUses = options.minUses ?? ACTIVE_VOCAB_MIN_USES;
  const minGapDays = options.minGapDays ?? ACTIVE_VOCAB_MIN_GAP_DAYS;

  const unaided = attempts
    .filter((attempt) => !attempt.scaffoldUsed && !attempt.skipped && attempt.text.trim())
    .sort((left, right) => left.createdAt - right.createdAt);

  // For each lemma, the timestamps of uses that were far enough apart to count separately.
  const uses = new Map<string, number[]>();
  for (const attempt of unaided) {
    for (const token of contentLemmas(attempt.text)) {
      const history = uses.get(token) ?? [];
      const last = history[history.length - 1];
      if (last === undefined || attempt.createdAt - last >= minGapDays * DAY_MS) {
        history.push(attempt.createdAt);
        uses.set(token, history);
      } else if (history.length === 0) {
        uses.set(token, [attempt.createdAt]);
      }
    }
  }

  const active = [...uses.entries()].filter(([, history]) => history.length >= minUses);
  return {
    size: active.length,
    lemmas: active
      .sort((left, right) => right[1][right[1].length - 1] - left[1][left[1].length - 1])
      .map(([token]) => token),
    emerging: [...uses.values()].filter((history) => history.length < minUses).length,
    samples: unaided.length,
  };
}

/* ───────────────────────────── production latency ───────────────────────────── */

export interface ProductionLatency {
  /** Median ms from prompt to the learner starting to answer, on mastered items. */
  medianMs: number | null;
  samples: number;
  /** Change vs. the preceding window; negative means faster. Null when either half is empty. */
  changeMs: number | null;
}

/**
 * How long the learner hesitates before producing something they already know.
 *
 * `preparationMs` was being captured on every attempt and never aggregated. It is only
 * meaningful over items the learner has actually mastered — hesitating over new language is
 * not a fluency signal, it is a learning signal — so the caller passes the set of mastered
 * items in. Median rather than mean: one interrupted session should not move the number.
 */
export function productionLatency(
  attempts: ProductionAttempt[],
  masteredIds: Set<string>,
  options: { windowDays?: number; now?: number } = {},
): ProductionLatency {
  const windowDays = options.windowDays ?? 30;
  const now = options.now ?? Date.now();
  const cutoff = now - windowDays * DAY_MS;

  const eligible = (attempt: ProductionAttempt) =>
    attempt.preparationMs !== undefined &&
    attempt.preparationMs > 0 &&
    !attempt.scaffoldUsed &&
    !attempt.skipped &&
    (attempt.targetPatternId !== undefined && masteredIds.has(attempt.targetPatternId));

  const median = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
  };

  const recent = attempts.filter((a) => eligible(a) && a.createdAt >= cutoff);
  const previous = attempts.filter((a) => eligible(a) && a.createdAt < cutoff && a.createdAt >= cutoff - windowDays * DAY_MS);
  const recentMedian = median(recent.map((a) => a.preparationMs!));
  const previousMedian = median(previous.map((a) => a.preparationMs!));

  return {
    medianMs: recentMedian,
    samples: recent.length,
    changeMs: recentMedian === null || previousMedian === null ? null : recentMedian - previousMedian,
  };
}

/* ─────────────────────── comprehension of unfamiliar speech ─────────────────────── */

export interface ColdListening {
  /** Checks on a voice the learner had not heard before, played once. */
  attempts: number;
  /** Of those, main idea correct. */
  correct: number;
  /** Null, never zero, when no qualifying check exists. */
  rate: number | null;
  /**
   * Why the rate is null, when it is. `no_unfamiliar_audio` is the default state of the
   * app, not an error: every built-in lesson clip is the same synthetic voice, so the top
   * rung of the listening ladder cannot be reached — or measured — without audio the
   * learner imports themselves. Saying so is better than showing a number that quietly
   * means something else, or a 0% that reads as failure.
   */
  unmeasuredReason?: "no_unfamiliar_audio" | "no_attempts";
}

/**
 * Comprehension of speech the learner has never heard, on one play.
 *
 * Strict on purpose. A replay turns the check into study; a familiar or mixed speaker
 * measures the voice as much as the language; and subtitles measure reading. Only an
 * unfamiliar speaker, heard once, with no subtitles, tells you whether the learner can
 * follow English they were not prepared for.
 */
export function coldListening(attempts: ListeningAttempt[]): ColdListening {
  if (attempts.length === 0) {
    return { attempts: 0, correct: 0, rate: null, unmeasuredReason: "no_attempts" };
  }
  const qualifying = attempts.filter((attempt) =>
    attempt.speakerFamiliarity === "unfamiliar" &&
    !attempt.subtitleUsed &&
    !attempt.scaffoldUsed &&
    !attempt.skipped &&
    // One play. `playCounts` is per question, so every question must have been heard once.
    attempt.playCounts.every((count) => count <= 1) &&
    (attempt.playbackRates ?? [attempt.playbackRate]).every((rate) => rate >= 1));

  if (qualifying.length === 0) {
    return { attempts: 0, correct: 0, rate: null, unmeasuredReason: "no_unfamiliar_audio" };
  }
  const correct = qualifying.filter((attempt) => attempt.mainIdeaCorrect).length;
  return { attempts: qualifying.length, correct, rate: correct / qualifying.length };
}
