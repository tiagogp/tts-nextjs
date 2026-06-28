import type { EnglishLevel } from "@/features/discover/types";
import { isLevelAtLeast } from "@/features/discover/levels";
import { languageLabel } from "@/features/settings/languages";
import type { LearningProfile } from "@/features/settings/learningProfile";
import a1b1 from "@/plans/a1-b1.json";
import b2c1 from "@/plans/b2-c1.json";
import type { LearningPlan, PlanGenerationResult, PlanMeta } from "./schema";
import { buildPlan, getActivePlan, savePlan } from "./store";

/** Pre-authored, no-AI fallback plans keyed by the band they cover. */
const DEFAULT_PLANS = {
  "a1-b1": a1b1 as PlanGenerationResult,
  "b2-c1": b2c1 as PlanGenerationResult,
} as const;

export type DefaultPlanId = keyof typeof DEFAULT_PLANS;

/** A1/A2/B1 learners get the foundational plan; B2+ get the advanced one. */
export function defaultPlanIdForLevel(level: EnglishLevel): DefaultPlanId {
  return isLevelAtLeast(level, "B2") ? "b2-c1" : "a1-b1";
}

function targetLevelFor(id: DefaultPlanId): EnglishLevel {
  return id === "a1-b1" ? "B1" : "C1";
}

/** Most common per-day estimate, used as the plan's daily availability. */
function representativeMinutes(result: PlanGenerationResult): number {
  const counts = new Map<number, number>();
  for (const day of result.days) {
    counts.set(day.estimatedMinutes, (counts.get(day.estimatedMinutes) ?? 0) + 1);
  }
  let best = 20;
  let bestCount = -1;
  for (const [minutes, count] of counts) {
    if (count > bestCount) {
      best = minutes;
      bestCount = count;
    }
  }
  return best;
}

export function buildDefaultPlanMeta(profile: LearningProfile, id: DefaultPlanId): PlanMeta {
  const result = DEFAULT_PLANS[id];
  const targetLevel = targetLevelFor(id);
  return {
    goal: profile.focus.trim() || `Reach ${targetLevel}`,
    currentLevel: profile.level,
    targetLevel,
    availabilityMinutes: representativeMinutes(result),
    planDays: result.days.length,
    language: languageLabel(profile.targetLang),
  };
}

/** Install the pre-authored plan matching the learner's level — no AI provider needed. */
export async function installDefaultPlan(profile: LearningProfile): Promise<LearningPlan> {
  const id = defaultPlanIdForLevel(profile.level);
  const plan = buildPlan(buildDefaultPlanMeta(profile, id), DEFAULT_PLANS[id]);
  await savePlan(plan);
  return plan;
}

/** Keep onboarding idempotent: install a ready-made plan only when none is active. */
export async function ensureDefaultPlan(profile: LearningProfile): Promise<LearningPlan | null> {
  const activePlan = await getActivePlan();
  if (activePlan) return activePlan;
  return installDefaultPlan(profile);
}
