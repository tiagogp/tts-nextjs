"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlanOnboarding } from "./PlanOnboarding";
import { PlanTaskRow } from "./PlanTaskRow";
import { useTodayPlan } from "../hooks/useTodayPlan";
import { deletePlan } from "../store";
import { installDefaultPlan } from "../defaultPlans";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { useT } from "@/i18n/I18nProvider";
import type { PlanNavigationHandlers, PlanTaskActionMap } from "../types";

interface TodayCardProps extends PlanNavigationHandlers {
  onOpenSettings?: () => void;
}

export function TodayCard({ onDiscover, onStudy, onConverse, onCorrect, onLesson, onOpenSettings }: TodayCardProps) {
  const { loading, plan, today, isPlanConcluded, completeTask, refresh } = useTodayPlan();
  const { t } = useT();
  const [planOnboardingOpen, setPlanOnboardingOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  if (loading) return null;

  const handlePlanCreated = async () => {
    await refresh();
  };

  const handleCreateDefault = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await installDefaultPlan(getLearningProfile());
      await refresh();
    } finally {
      setCreating(false);
    }
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
            <p className="text-xs uppercase tracking-[0.7px] text-emerald-700 dark:text-emerald-400">{t("Plan complete")}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {t("You finished your {days}-day plan — great work!", { days: plan.meta.planDays })}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{t("Ready to start a new one?")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={creating} onClick={() => void handleCreateDefault()}>
              {creating ? t("Starting…") : t("Start new plan")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlanOnboardingOpen(true)}>
              {t("Customize with AI")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleDeletePlan()}>
              {t("Delete plan")}
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
        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">{t("Learning plan")}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{t("No plan yet")}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t("Start a ready-made plan for your level, or customize one with AI.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={creating} onClick={() => void handleCreateDefault()}>
              {creating ? t("Creating…") : t("Create plan")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlanOnboardingOpen(true)}>
              {t("Customize with AI")}
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

  const phase = plan.phases.find((p) => p.number === today.phase);
  const allDone = today.tasks.every((t) => t.completedAt != null);
  const doneCount = today.tasks.filter((t) => t.completedAt != null).length;
  const totalDays = plan.meta.planDays;
  const dayNumber = plan.days.findIndex((d) => d.date === today.date) + 1;

  const tabCallback: PlanTaskActionMap = {
    discover: onDiscover,
    lesson: undefined,
    study: onStudy,
    converse: onConverse,
    correct: onCorrect,
  };

  return (
    <Card className={`p-5 space-y-4 ${allDone ? "" : "due-pulse"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today · Day {day} of {total}", { day: dayNumber, total: totalDays })}</p>
            {allDone && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                {t("Done ✓")}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink">{phase?.title ? t(phase.title) : t("Phase {phase}", { phase: today.phase })}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{phase?.focus ? t(phase.focus) : null}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-ink">{doneCount}/{today.tasks.length}</p>
          <p className="text-xs text-ink-muted">{t("tasks")}</p>
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
            onGo={
              task.targetMetric?.action === "progress_checkin"
                ? onStudy
                : task.type === "lesson"
                  ? () => onLesson?.(task.lessonId)
                  : tabCallback[task.type]
            }
            onComplete={() => void completeTask(task.id)}
          />
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">{t("~{min} min today", { min: today.estimatedMinutes })}</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("Delete this plan? This cannot be undone."))) void handleDeletePlan();
          }}
          className="text-xs text-ink-muted transition-colors hover:text-red-500"
        >
          {t("Delete plan")}
        </button>
      </div>
    </Card>
  );
}
