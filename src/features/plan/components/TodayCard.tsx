"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlanOnboarding } from "./PlanOnboarding";
import { PlanTaskRow } from "./PlanTaskRow";
import { useTodayPlan } from "../hooks/useTodayPlan";
import { deletePlan } from "../store";
import type { PlanNavigationHandlers, PlanTaskActionMap } from "../types";

interface TodayCardProps extends PlanNavigationHandlers {
  onOpenSettings?: () => void;
}

export function TodayCard({ onDiscover, onStudy, onConverse, onCorrect, onOpenSettings }: TodayCardProps) {
  const { loading, plan, today, isPlanConcluded, completeTask, refresh } = useTodayPlan();
  const [planOnboardingOpen, setPlanOnboardingOpen] = useState(false);

  if (loading) return null;

  const handlePlanCreated = async () => {
    await refresh();
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    await deletePlan(plan.id);
    await refresh();
  };

  if (isPlanConcluded && plan) {
    return (
      <>
        <Card className="p-5 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.7px] text-emerald-700 dark:text-emerald-400">Plan complete</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              You finished your {plan.meta.planDays}-day plan — great work!
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">Ready to start a new one?</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setPlanOnboardingOpen(true)}>
              Start new plan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleDeletePlan()}>
              Delete plan
            </Button>
          </div>
        </Card>
        <PlanOnboarding
          open={planOnboardingOpen}
          onClose={() => setPlanOnboardingOpen(false)}
          onPlanCreated={handlePlanCreated}
          onOpenSettings={onOpenSettings}
        />
      </>
    );
  }

  if (!plan || !today) {
    return (
      <>
        <Card className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">Learning plan</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">No plan yet</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Create a 30–90 day plan and get a daily task list.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setPlanOnboardingOpen(true)}>
            Create plan
          </Button>
        </Card>
        <PlanOnboarding
          open={planOnboardingOpen}
          onClose={() => setPlanOnboardingOpen(false)}
          onPlanCreated={handlePlanCreated}
          onOpenSettings={onOpenSettings}
        />
      </>
    );
  }

  const phase = plan.phases.find((p) => p.number === today.phase);
  const allDone = today.tasks.every((t) => t.completedAt != null);
  const doneCount = today.tasks.filter((t) => t.completedAt != null).length;
  const totalDays = plan.meta.planDays;
  const dayNumber = plan.days.findIndex((d) => d.date === today.date) + 1;

  const tabCallback: PlanTaskActionMap = {
    discover: onDiscover,
    study: onStudy,
    converse: onConverse,
    correct: onCorrect,
  };

  return (
    <Card className={`p-5 space-y-4 ${allDone ? "" : "due-pulse"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.7px] text-accent">Today · Day {dayNumber} of {totalDays}</p>
            {allDone && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                Done ✓
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink">{phase?.title ?? `Phase ${today.phase}`}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{phase?.focus}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-ink">{doneCount}/{today.tasks.length}</p>
          <p className="text-xs text-ink-muted">tasks</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${today.tasks.length > 0 ? (doneCount / today.tasks.length) * 100 : 0}%` }}
        />
      </div>

      <ul className="space-y-2">
        {today.tasks.map((task) => (
          <PlanTaskRow
            key={task.id}
            task={task}
            onGo={tabCallback[task.type]}
            onComplete={() => void completeTask(task.id)}
          />
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">~{today.estimatedMinutes} min today</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this plan? This cannot be undone.")) void handleDeletePlan();
          }}
          className="text-xs text-ink-muted transition-colors hover:text-red-500"
        >
          Delete plan
        </button>
      </div>
    </Card>
  );
}
