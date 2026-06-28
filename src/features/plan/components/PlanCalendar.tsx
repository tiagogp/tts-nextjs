"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { isStoreAvailable } from "@/lib/store/db";
import { PlanTaskRow } from "./PlanTaskRow";
import {
  CALENDAR_STATUS_DOT,
  CALENDAR_STATUS_RING,
  MONTH_NAMES,
  WEEKDAY_LABELS,
} from "../constants";
import { getActivePlan, updateDayTask } from "../store";
import type { DailyTask, LearningPlan } from "../schema";
import type { PlanNavigationHandlers, PlanTaskActionMap } from "../types";
import { buildCalendarDays, dateString } from "../utils";

export function PlanCalendar({ onStudy, onConverse, onCorrect, onDiscover, onLesson }: PlanNavigationHandlers) {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => dateString(new Date()));
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<string | null>(() => dateString(new Date()));

  const loadPlan = useCallback(() => {
    if (!isStoreAvailable()) { setLoading(false); return; }
    getActivePlan().then((p) => { setPlan(p); setLoading(false); });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadPlan);
    window.addEventListener("phraseloop:plan-updated", loadPlan);
    return () => window.removeEventListener("phraseloop:plan-updated", loadPlan);
  }, [loadPlan]);

  const planDaysByDate = new Map<string, DailyTask>(
    (plan?.days ?? []).map((d) => [d.date, d]),
  );

  const calendarDays = buildCalendarDays(viewYear, viewMonth, planDaysByDate, today);
  const selectedPlanDay = selected ? (planDaysByDate.get(selected) ?? null) : null;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelected(today);
  };

  const completeTask = useCallback(async (date: string, taskId: string) => {
    if (!plan) return;
    const now = Date.now();
    await updateDayTask(plan.id, date, taskId, now);
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => {
          if (d.date !== date) return d;
          const tasks = d.tasks.map((t) => (t.id === taskId ? { ...t, completedAt: now } : t));
          const allDone = tasks.every((t) => t.completedAt != null);
          return { ...d, tasks, completedAt: allDone ? now : undefined };
        }),
      };
    });
  }, [plan]);

  if (loading || !plan) return null;

  const tabCallback: PlanTaskActionMap = {
    discover: onDiscover,
    lesson: undefined,
    study: onStudy,
    converse: onConverse,
    correct: onCorrect,
  };

  const selectedDate = selected ? new Date(selected + "T12:00:00") : null;
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">Plan calendar</p>
          <p className="text-sm font-semibold text-ink">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToday}
            className="rounded px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const isSelected = selected === day.date;
          return (
            <button
              key={day.date}
              type="button"
              aria-label={day.date}
              aria-pressed={isSelected}
              onClick={() => setSelected(day.date)}
              className={`relative flex flex-col items-center rounded-lg py-2 transition-colors ${
                isSelected
                  ? "bg-accent/10"
                  : "hover:bg-surface"
              } ${!day.inCurrentMonth ? "opacity-30" : ""}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                CALENDAR_STATUS_RING[day.status]
              } ${
                isSelected && day.status !== "today"
                  ? "bg-accent/15 font-semibold text-ink"
                  : day.status === "today"
                    ? "font-bold text-accent"
                    : "text-ink-soft"
              }`}>
                {day.dayOfMonth}
              </span>
              {day.status !== "empty" && (
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${CALENDAR_STATUS_DOT[day.status]}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-[10px] text-ink-muted">
        {(["completed", "partial", "missed", "upcoming"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${CALENDAR_STATUS_DOT[s]}`} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs font-semibold text-ink">{selectedLabel}</p>

          {!selectedPlanDay ? (
            <p className="text-xs text-ink-muted">No tasks planned for this day.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {selectedPlanDay.tasks.map((task) => (
                  <PlanTaskRow
                    key={task.id}
                    task={task}
                    hideGoAction={selected < today}
                    completeButtonLabel={{ done: "Mark undone", pending: "Mark done" }}
                    onGo={
                      task.type === "lesson"
                        ? (onLesson ? () => onLesson(task.lessonId) : undefined)
                        : tabCallback[task.type]
                    }
                    onComplete={() => void completeTask(selected, task.id)}
                  />
                ))}
              </ul>
              <p className="text-xs text-ink-muted">~{selectedPlanDay.estimatedMinutes} min</p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
