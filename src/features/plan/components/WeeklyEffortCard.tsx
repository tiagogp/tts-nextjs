"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Notice";
import { isStoreAvailable } from "@/lib/store/db";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import type { AdaptationSuggestion } from "../adaptation";
import { buildWeekSummary, evaluateAdaptation } from "../adaptation";
import { computeAndSaveEffortSnapshot } from "../effort";
import { getActivePlan, getAllEffortHistory, savePlan } from "../store";
import type { DailyTask, EffortSnapshot, LearningPlan } from "../schema";

const COLOR_CLASSES = {
  green: "text-emerald-700 dark:text-emerald-400",
  yellow: "text-amber-700 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

const BAR_CLASSES = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

export function WeeklyEffortCard() {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [snapshot, setSnapshot] = useState<EffortSnapshot | null>(null);
  const [suggestion, setSuggestion] = useState<AdaptationSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [adapting, setAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [adapted, setAdapted] = useState(false);
  const { provider, selectedModel } = useProviderSelection({ fallbackToEvaluator: true });

  const load = useCallback(async () => {
    if (!isStoreAvailable()) return;
    const activePlan = await getActivePlan();
    if (!activePlan) { setPlan(null); return; }
    setPlan(activePlan);

    // Always recompute so activity done in this session is reflected immediately
    const snap = await computeAndSaveEffortSnapshot(activePlan);
    setSnapshot(snap);
    const s = await evaluateAdaptation(activePlan);
    setSuggestion(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await load();
      if (!cancelled) setLoading(false);
    };
    void run();

    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    const onActivity = () => void load();
    window.addEventListener("phraseloop:activity", onActivity);
    window.addEventListener("phraseloop:plan-updated", onActivity);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("phraseloop:activity", onActivity);
      window.removeEventListener("phraseloop:plan-updated", onActivity);
    };
  }, [load]);

  const adaptPlan = useCallback(async () => {
    if (!plan || !suggestion) return;
    setAdapting(true);
    setAdaptError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayIndex = plan.days.findIndex((d) => d.date >= today);
      const startDayNumber = todayIndex >= 0 ? todayIndex + 1 : plan.days.length + 1;
      const remainingDays = plan.days.length - todayIndex;
      if (remainingDays <= 0) return;

      const effortHistory = await getAllEffortHistory();

      const res = await fetch("/api/plan/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: plan.meta,
          phases: plan.phases,
          remainingDays,
          startDayNumber,
          newAvailabilityMinutes: suggestion.suggestedMinutes,
          effortHistory,
          provider,
          ollamaModel: selectedModel || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        days?: Array<{
          dayNumber: number;
          phase: number;
          estimatedMinutes: number;
          tasks: Array<{ type: string; instruction: string; targetMetric?: { action: string; quantity: number } }>;
        }>;
        newAvailabilityMinutes?: number;
        error?: string;
      } | null;

      if (!res.ok || !data?.days) {
        setAdaptError(data?.error ?? "Couldn't revise the plan.");
        return;
      }

      // Rebuild the remaining days with real dates, keeping past days intact
      const baseDate = new Date(today);
      const revisedDays: DailyTask[] = data.days.map((d) => {
        const dayDate = new Date(baseDate);
        dayDate.setDate(baseDate.getDate() + (d.dayNumber - startDayNumber));
        return {
          date: dayDate.toISOString().slice(0, 10),
          phase: d.phase,
          estimatedMinutes: d.estimatedMinutes,
          tasks: d.tasks.map((t) => ({
            id: nanoid(),
            type: t.type as DailyTask["tasks"][number]["type"],
            instruction: t.instruction,
            ...(t.targetMetric ? { targetMetric: t.targetMetric as DailyTask["tasks"][number]["targetMetric"] } : {}),
          })),
        };
      });

      const updatedPlan: LearningPlan = {
        ...plan,
        meta: {
          ...plan.meta,
          availabilityMinutes: data.newAvailabilityMinutes ?? suggestion.suggestedMinutes,
        },
        days: [
          ...plan.days.slice(0, todayIndex),
          ...revisedDays,
        ],
      };

      await savePlan(updatedPlan);
      setPlan(updatedPlan);
      setSuggestion(null);
      setAdapted(true);
    } catch (err: unknown) {
      setAdaptError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdapting(false);
    }
  }, [plan, suggestion, provider, selectedModel]);

  if (loading || !plan || !snapshot) return null;

  const summary = buildWeekSummary(snapshot);
  const pct = Math.round(snapshot.adherenceRate * 100);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">This week</p>
          <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${COLOR_CLASSES[summary.color]}`}>
            {summary.label}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-ink tabular-nums">{snapshot.actualMinutes} min</p>
          <p className="text-xs text-ink-muted">of {snapshot.plannedMinutes} planned</p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${BAR_CLASSES[summary.color]}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span>
          <span className="font-semibold tabular-nums text-ink">{snapshot.streak}</span> day streak
        </span>
        <span>{plan.meta.availabilityMinutes} min/day target</span>
      </div>

      {suggestion && !adapted && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-ink">{suggestion.headline}</p>
          <p className="text-xs text-ink-soft">{suggestion.detail}</p>
          {adaptError && <Notice tone="error" className="text-xs">{adaptError}</Notice>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
              Keep as is
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void adaptPlan()}
              disabled={adapting}
              className="flex items-center gap-1.5"
            >
              {adapting && <Spinner className="h-3 w-3" />}
              {adapting ? "Adjusting…" : `Switch to ${suggestion.suggestedMinutes} min/day`}
            </Button>
          </div>
        </div>
      )}

      {adapted && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Plan updated to {plan.meta.availabilityMinutes} min/day.
        </p>
      )}
    </Card>
  );
}
