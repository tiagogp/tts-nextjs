import type { RefinementDimension, RefinementEvent } from "@/lib/cards/schema";

const MAX_EXAMPLES_PER_DIMENSION = 3;

/**
 * A register/naturalness/collocation gap, ranked by how often it showed up in the sample.
 * Mirrors `errorTypes` in src/lib/srs/analytics.ts (worst-first, evidence attached) but for
 * the dimension error-type tracking can't see.
 */
export interface RegisterGap {
  dimension: RefinementDimension;
  count: number;
  examples: RefinementEvent[];
}

/**
 * Turns a flat refinement list into the C1 diagnosis "rubric": most-frequent dimension first,
 * each with real examples attached. No score is invented — the ranking and the evidence are
 * the same data, just grouped, so a "Weak" label always has the flagged sentence next to it.
 */
export function groupRefinementsByDimension(refinements: RefinementEvent[]): RegisterGap[] {
  const byDimension = new Map<RefinementDimension, RefinementEvent[]>();
  for (const refinement of refinements) {
    const bucket = byDimension.get(refinement.dimension);
    if (bucket) bucket.push(refinement);
    else byDimension.set(refinement.dimension, [refinement]);
  }

  return Array.from(byDimension.entries())
    .map(([dimension, examples]) => ({
      dimension,
      count: examples.length,
      examples: examples.slice(0, MAX_EXAMPLES_PER_DIMENSION),
    }))
    .sort((a, b) => b.count - a.count);
}
