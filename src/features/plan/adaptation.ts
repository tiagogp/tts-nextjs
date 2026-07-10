import type { EffortSnapshot, LearningPlan } from "./schema";
import { getAllEffortHistory } from "./store";

export type AdaptationKind = "reduce" | "increase" | "on_track";

export interface AdaptationSuggestion {
  kind: AdaptationKind;
  headline: string;
  detail: string;
  /** New daily availability in minutes to suggest. */
  suggestedMinutes: number;
}

/** How many consecutive under/over weeks trigger an adaptation. */
const TRIGGER_WEEKS = 2;
const LOW_THRESHOLD = 0.5;
const HIGH_THRESHOLD = 0.9;

export async function evaluateAdaptation(plan: LearningPlan): Promise<AdaptationSuggestion | null> {
  const history = await getAllEffortHistory();
  if (history.length < TRIGGER_WEEKS) return null;

  // Most recent weeks first
  const sorted = [...history].sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  const recent = sorted.slice(0, TRIGGER_WEEKS);

  const allLow = recent.every((s) => s.adherenceRate < LOW_THRESHOLD);
  const allHigh = recent.every((s) => s.adherenceRate > HIGH_THRESHOLD);

  if (!allLow && !allHigh) return null;

  const current = plan.meta.availabilityMinutes;

  if (allLow) {
    const avg = recent.reduce((sum, s) => sum + s.adherenceRate, 0) / recent.length;
    const factor = Math.max(0.5, avg); // don't cut more than 50%
    const suggestedMinutes = Math.max(10, Math.round(current * factor));
    return {
      kind: "reduce",
      headline: "You're doing less than planned",
      detail: `You completed ~${Math.round(avg * 100)}% of your plan for ${TRIGGER_WEEKS} weeks in a row. Reducing to ${suggestedMinutes} min/day makes the plan more sustainable.`,
      suggestedMinutes,
    };
  }

  // allHigh
  const suggestedMinutes = Math.min(120, Math.round(current * 1.25));
  return {
    kind: "increase",
    headline: "You're ahead of schedule",
    detail: `You've been hitting over ${Math.round(HIGH_THRESHOLD * 100)}% of your plan consistently. You can handle ${suggestedMinutes} min/day — want to accelerate?`,
    suggestedMinutes,
  };
}

/** Build a brief summary to show in the effort card. */
export function buildWeekSummary(snapshot: EffortSnapshot): {
  label: string;
  color: "green" | "yellow" | "red";
} {
  const pct = Math.round(snapshot.adherenceRate * 100);
  if (pct >= 80) return { label: `${pct}% of plan`, color: "green" };
  if (pct >= 40) return { label: `${pct}% of plan`, color: "yellow" };
  return { label: `${pct}% of plan`, color: "red" };
}
