import { nanoid } from "nanoid";
import { STORES, get, getAll, put, del } from "@/lib/store/db";
import type { DailyTask, EffortSnapshot, LearningPlan, PlanMeta, PlanGenerationResult, Phase } from "./schema";
import { addDays, dateString } from "./utils";
import { applyObjectiveDistribution } from "./objectivePolicy";

export { getIsoWeek } from "./utils";

const ACTIVE_PLAN_KEY = "phraseloop.activePlanId.v1";

/** Build a full LearningPlan from the LLM result + meta, anchored to today. */
export function buildPlan(meta: PlanMeta, result: PlanGenerationResult): LearningPlan {
  const shaped = meta.objective ? applyObjectiveDistribution(result, meta.objective) : result;
  const startsOn = dateString(new Date());
  const start = new Date(startsOn);

  const phases: Phase[] = shaped.phases.map((p) => ({
    number: p.number,
    title: p.title,
    focus: p.focus,
    startDay: p.startDay,
    endDay: p.endDay,
  }));

  const days: DailyTask[] = shaped.days.map((d) => ({
    date: dateString(addDays(start, d.dayNumber - 1)),
    phase: d.phase,
    estimatedMinutes: d.estimatedMinutes,
    tasks: d.tasks.map((t) => ({ id: nanoid(), ...t })),
  }));

  return {
    id: nanoid(),
    createdAt: Date.now(),
    startsOn,
    meta,
    phases,
    days,
  };
}

export async function savePlan(plan: LearningPlan): Promise<void> {
  await put(STORES.learningPlan, plan);
  try {
    localStorage.setItem(ACTIVE_PLAN_KEY, plan.id);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("phraseloop:plan-updated"));
  }
}

export async function getActivePlan(): Promise<LearningPlan | null> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(ACTIVE_PLAN_KEY);
  } catch {}
  if (!id) return null;
  const plan = await get<LearningPlan>(STORES.learningPlan, id);
  return plan ?? null;
}

export async function getAllPlans(): Promise<LearningPlan[]> {
  return getAll<LearningPlan>(STORES.learningPlan);
}

export async function deletePlan(id: string): Promise<void> {
  await del(STORES.learningPlan, id);
  try {
    if (localStorage.getItem(ACTIVE_PLAN_KEY) === id) {
      localStorage.removeItem(ACTIVE_PLAN_KEY);
    }
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("phraseloop:plan-updated"));
  }
}

export async function updateDayTask(
  planId: string,
  date: string,
  taskId: string,
  completedAt: number,
  evidence?: { at: number; count: number },
): Promise<void> {
  const plan = await get<LearningPlan>(STORES.learningPlan, planId);
  if (!plan) return;
  const updated: LearningPlan = {
    ...plan,
    days: plan.days.map((d) => {
      if (d.date !== date) return d;
      const allDone = d.tasks.every((t) => t.id === taskId || t.completedAt != null);
      return {
        ...d,
        completedAt: allDone ? completedAt : undefined,
        tasks: d.tasks.map((t) => (t.id === taskId
          ? { ...t, completedAt, ...(evidence ? { evidenceAt: evidence.at, evidenceCount: evidence.count } : {}) }
          : t)),
      };
    }),
  };
  await put(STORES.learningPlan, updated);
}

export async function getTodayTasks(planId: string): Promise<DailyTask | null> {
  const plan = await get<LearningPlan>(STORES.learningPlan, planId);
  if (!plan) return null;
  const today = dateString(new Date());
  return plan.days.find((d) => d.date === today) ?? null;
}

/* ── effort history ─────────────────────────────────────────── */

export async function getEffortSnapshot(weekOf: string): Promise<EffortSnapshot | null> {
  const snap = await get<EffortSnapshot>(STORES.effortHistory, weekOf);
  return snap ?? null;
}

export async function saveEffortSnapshot(snapshot: EffortSnapshot): Promise<void> {
  await put(STORES.effortHistory, snapshot);
}

export async function getAllEffortHistory(): Promise<EffortSnapshot[]> {
  return getAll<EffortSnapshot>(STORES.effortHistory);
}
