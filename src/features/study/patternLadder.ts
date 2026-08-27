import type { PatternDrillKind } from "./patternDrills";

/**
 * Per-item progression: the rung a learner has reached on one language pattern.
 *
 * `progression.ts` already governs support levels for listening and speaking as a whole.
 * This is the other axis the method needs and did not have — progress on a *pattern*, which
 * is where generalization either happens or does not. A learner can be at
 * `independent_transfer` for listening overall and still only ever have recited one
 * sentence of "I ended up ___".
 *
 * The ladder, and the evidence each rung demands:
 *
 *   retrieval        → 2 unaided productions of the phrase itself
 *   slot_substitution→ 2 valid substitutions with *different* fillings
 *   constrained_cloze→ 2 cloze completions in a situation of the learner's own
 *   new_situation    → 2 verified transfers with low reuse of the source
 *   retired          → out of the study queue; only the proof queue still asks for it
 *
 * "Two" rather than one because a single success is as likely to be luck as learning, and
 * rather than five because a ladder nobody climbs teaches nothing. The fillings must differ
 * from each other, not only from the taught examples: two substitutions with the same word
 * are one substitution done twice.
 */

export type PatternRung = PatternDrillKind | "retrieval" | "retired";

export const RUNG_ORDER: PatternRung[] = [
  "retrieval",
  "slot_substitution",
  "constrained_cloze",
  "minimal_pair",
  "new_situation",
  "retired",
];

/** Successes required to leave a rung. */
export const PROMOTION_THRESHOLD = 2;

export interface PatternEvidence {
  patternId: string;
  rung: PatternRung;
  /** Whether the learner met the rung's bar. */
  passed: boolean;
  /** Content words the learner supplied, so repeats of one filling do not count twice. */
  filling?: string[];
  at: number;
}

export interface PatternProgress {
  patternId: string;
  rung: PatternRung;
  /** Distinct successful fillings at the current rung. */
  distinctSuccesses: number;
  /** Every attempt at the current rung, successful or not. */
  attempts: number;
  /** Ready to be asked for at the next rung. */
  promotable: boolean;
}

function nextRung(rung: PatternRung, hasContrast: boolean): PatternRung {
  const index = RUNG_ORDER.indexOf(rung);
  let next = RUNG_ORDER[Math.min(index + 1, RUNG_ORDER.length - 1)];
  // Minimal-pair discrimination needs an authored wrong neighbour. Without one the rung is
  // skipped rather than faked with a generated distractor, which would teach the wrong
  // contrast half the time.
  if (next === "minimal_pair" && !hasContrast) next = "new_situation";
  return next;
}

export function patternProgress(
  evidence: PatternEvidence[],
  options: { hasContrast?: (patternId: string) => boolean } = {},
): Map<string, PatternProgress> {
  const byPattern = new Map<string, PatternEvidence[]>();
  for (const item of [...evidence].sort((left, right) => left.at - right.at)) {
    const history = byPattern.get(item.patternId) ?? [];
    history.push(item);
    byPattern.set(item.patternId, history);
  }

  const result = new Map<string, PatternProgress>();
  for (const [patternId, history] of byPattern) {
    let rung: PatternRung = "retrieval";
    let fillings = new Set<string>();
    let attempts = 0;

    for (const item of history) {
      // Evidence from a rung the learner has already left is history, not progress.
      if (item.rung !== rung) continue;
      attempts += 1;
      if (!item.passed) continue;
      // A filling already used at this rung is the same success repeated.
      const key = (item.filling ?? []).join(" ") || `attempt-${attempts}`;
      fillings.add(key);
      if (fillings.size >= PROMOTION_THRESHOLD && rung !== "retired") {
        rung = nextRung(rung, options.hasContrast?.(patternId) ?? false);
        fillings = new Set();
        attempts = 0;
      }
    }

    result.set(patternId, {
      patternId,
      rung,
      distinctSuccesses: fillings.size,
      attempts,
      promotable: fillings.size >= PROMOTION_THRESHOLD,
    });
  }
  return result;
}

/** What to ask for next on this pattern. Unseen patterns start at plain retrieval. */
export function rungFor(progress: Map<string, PatternProgress>, patternId: string): PatternRung {
  return progress.get(patternId)?.rung ?? "retrieval";
}

/**
 * A pattern is retired from the study queue once it has been carried into new situations
 * twice. It is not retired from the *proof* queue — that is the whole point of keeping the
 * two separate.
 */
export function isRetired(progress: Map<string, PatternProgress>, patternId: string): boolean {
  return rungFor(progress, patternId) === "retired";
}
