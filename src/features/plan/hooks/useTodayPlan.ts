"use client";

import { useCallback, useEffect, useState } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import type { DailyTask, LearningPlan } from "../schema";
import { getActivePlan, getTodayTasks, updateDayTask } from "../store";

export interface TodayPlanState {
  loading: boolean;
  plan: LearningPlan | null;
  today: DailyTask | null;
  /** True when a plan exists but its last day has already passed. */
  isPlanConcluded: boolean;
  completeTask: (taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTodayPlan(): TodayPlanState {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [today, setToday] = useState<DailyTask | null>(null);

  const refresh = useCallback(async () => {
    if (!isStoreAvailable()) return;
    const activePlan = await getActivePlan();
    setPlan(activePlan);
    if (activePlan) {
      const todayTasks = await getTodayTasks(activePlan.id);
      setToday(todayTasks);
    } else {
      setToday(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    };
    void load();
    const onPlanUpdated = () => void refresh();
    window.addEventListener("phraseloop:plan-updated", onPlanUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("phraseloop:plan-updated", onPlanUpdated);
    };
  }, [refresh]);

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!plan || !today) return;
      const now = Date.now();
      await updateDayTask(plan.id, today.date, taskId, now);
      // Optimistic update
      setToday((prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.map((t) => (t.id === taskId ? { ...t, completedAt: now } : t));
        const allDone = tasks.every((t) => t.completedAt != null);
        return { ...prev, tasks, completedAt: allDone ? now : undefined };
      });
    },
    [plan, today],
  );

  const currentDate = new Date().toISOString().slice(0, 10);
  const isPlanConcluded =
    plan != null &&
    today == null &&
    plan.days.length > 0 &&
    plan.days[plan.days.length - 1].date < currentDate;

  return { loading, plan, today, isPlanConcluded, completeTask, refresh };
}
