"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { MethodRoute } from "@/features/method/learningLoop";
import { useT } from "@/i18n/I18nProvider";
import { useTodayPlan } from "../hooks/useTodayPlan";
import type { TaskItem, TaskType } from "../schema";
import { PlanTaskRow } from "./PlanTaskRow";

/**
 * Which plan task types satisfy a method recommendation. Keeps the "Next" chip on
 * this card in agreement with Hoje's next-action CTA — both read `deriveMethodPlan`.
 */
const ROUTE_TASK_TYPES: Record<MethodRoute, TaskType[]> = {
  review: ["study"],
  correct: ["correct", "readWrite"],
  discover: ["discover"],
  speak: ["converse"],
  lesson: ["lesson"],
};

function nextTaskId(tasks: TaskItem[], nextRoute?: MethodRoute): string | null {
  const open = tasks.filter((task) => task.completedAt == null);
  if (open.length === 0) return null;
  const preferred = nextRoute ? open.find((task) => ROUTE_TASK_TYPES[nextRoute].includes(task.type)) : undefined;
  return (preferred ?? open[0]).id;
}

/** The plan's executable front door: every task has a real destination and completion is evidence-driven. */
export function TodayPlanCard({
  onOpenTask,
  onCreatePlan,
  onInstallDefault,
  nextRoute,
}: {
  onOpenTask: (task: TaskItem) => void;
  onCreatePlan?: () => void;
  onInstallDefault?: () => void;
  /** Today's method recommendation; the matching task is marked "Next". */
  nextRoute?: MethodRoute;
}) {
  const { t } = useT();
  const { loading, plan, today, isPlanConcluded, refresh } = useTodayPlan();

  if (loading) return null;
  if (!plan || isPlanConcluded || !today) {
    return (
      <Card className="space-y-3 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Learning plan")}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {isPlanConcluded ? t("Your plan is complete. Start another plan or keep the weekly method loop.") : t("A simple daily plan for your goal.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCreatePlan && <Button variant="secondary" onClick={onCreatePlan}>{t("Create a plan")}</Button>}
          {onInstallDefault && <Button variant="ghost" onClick={onInstallDefault}>{t("Use starter plan")}</Button>}
        </div>
      </Card>
    );
  }

  const highlightedId = nextTaskId(today.tasks, nextRoute);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today’s plan")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("Do an activity and it is checked off for you.")}</p>
        </div>
        <span className="text-xs tabular-nums text-ink-muted">{today.estimatedMinutes} min</span>
      </div>
      <ol className="space-y-2">
        {today.tasks.map((task) => (
          <PlanTaskRow
            key={task.id}
            task={task}
            highlight={task.id === highlightedId}
            onComplete={() => void refresh()}
            onGo={() => onOpenTask(task)}
          />
        ))}
      </ol>
    </Card>
  );
}
