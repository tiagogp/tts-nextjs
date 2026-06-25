"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { isStoreAvailable } from "@/lib/store/db";
import { getActivePlan, updateDayTask } from "../store";
import type { DailyTask, LearningPlan, TaskItem, TaskType } from "../schema";

/* ── types ─────────────────────────────────────────────────── */

type DayStatus = "completed" | "partial" | "missed" | "today" | "upcoming" | "empty";

interface CalendarDay {
  date: string;        // "2026-06-24"
  dayOfMonth: number;
  inCurrentMonth: boolean;
  status: DayStatus;
  planDay: DailyTask | null;
}

/* ── helpers ────────────────────────────────────────────────── */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TASK_LABELS: Record<TaskType, string> = {
  discover: "Discover",
  study: "Study",
  converse: "Speak",
  correct: "Correct",
};

const TASK_COLORS: Record<TaskType, string> = {
  discover: "bg-accent/10 text-accent",
  study: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  converse: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  correct: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayStatus(planDay: DailyTask | null, dateStr: string, today: string): DayStatus {
  if (!planDay) return "empty";
  if (dateStr === today) return "today";
  const done = planDay.tasks.filter((t) => t.completedAt != null).length;
  if (done === planDay.tasks.length) return "completed";
  if (dateStr < today) return done > 0 ? "partial" : "missed";
  if (done > 0) return "partial";
  return "upcoming";
}

function buildCalendarDays(
  year: number,
  month: number,
  planDaysByDate: Map<string, DailyTask>,
  today: string,
): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  // Monday-based: 0=Mon … 6=Sun
  let startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrev - i);
    const ds = isoDate(d);
    cells.push({
      date: ds,
      dayOfMonth: daysInPrev - i,
      inCurrentMonth: false,
      status: dayStatus(planDaysByDate.get(ds) ?? null, ds, today),
      planDay: planDaysByDate.get(ds) ?? null,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const ds = isoDate(date);
    cells.push({
      date: ds,
      dayOfMonth: d,
      inCurrentMonth: true,
      status: dayStatus(planDaysByDate.get(ds) ?? null, ds, today),
      planDay: planDaysByDate.get(ds) ?? null,
    });
  }

  // Next month padding to complete the last row
  const remainder = cells.length % 7;
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      const date = new Date(year, month + 1, d);
      const ds = isoDate(date);
      cells.push({
        date: ds,
        dayOfMonth: d,
        inCurrentMonth: false,
        status: dayStatus(planDaysByDate.get(ds) ?? null, ds, today),
        planDay: planDaysByDate.get(ds) ?? null,
      });
    }
  }

  return cells;
}

/* ── status dot ─────────────────────────────────────────────── */

const DOT: Record<DayStatus, string> = {
  completed: "bg-emerald-500",
  partial: "bg-amber-400",
  missed: "bg-red-500",
  today: "bg-accent",
  upcoming: "bg-line",
  empty: "",
};

const DAY_RING: Record<DayStatus, string> = {
  completed: "",
  partial: "",
  missed: "",
  today: "ring-2 ring-accent ring-offset-1",
  upcoming: "",
  empty: "",
};

/* ── main component ─────────────────────────────────────────── */

interface PlanCalendarProps {
  onStudy?: () => void;
  onConverse?: () => void;
  onCorrect?: () => void;
  onDiscover?: () => void;
}

export function PlanCalendar({ onStudy, onConverse, onCorrect, onDiscover }: PlanCalendarProps) {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => isoDate(new Date()));
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<string | null>(() => isoDate(new Date()));

  const loadPlan = useCallback(() => {
    if (!isStoreAvailable()) { setLoading(false); return; }
    getActivePlan().then((p) => { setPlan(p); setLoading(false); });
  }, []);

  useEffect(() => {
    loadPlan();
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

  const tabCallback: Record<TaskType, (() => void) | undefined> = {
    discover: onDiscover,
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
                DAY_RING[day.status]
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
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${DOT[day.status]}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-[10px] text-ink-muted">
        {(["completed", "partial", "missed", "upcoming"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${DOT[s]}`} />
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
                  <DayTaskRow
                    key={task.id}
                    task={task}
                    isPast={selected < today}
                    onGo={tabCallback[task.type]}
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

/* ── task row ───────────────────────────────────────────────── */

function DayTaskRow({
  task,
  isPast,
  onGo,
  onComplete,
}: {
  task: TaskItem;
  isPast: boolean;
  onGo?: () => void;
  onComplete: () => void;
}) {
  const done = task.completedAt != null;
  return (
    <li className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
      done ? "border-line bg-surface opacity-60" : "border-line bg-canvas"
    }`}>
      <button
        type="button"
        aria-label={done ? "Mark undone" : "Mark done"}
        onClick={onComplete}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-accent"
        }`}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TASK_COLORS[task.type]}`}>
          {TASK_LABELS[task.type]}
        </span>
        <p className={`truncate text-xs ${done ? "line-through text-ink-muted" : "text-ink-soft"}`}>
          {task.instruction}
        </p>
      </div>

      {!done && !isPast && onGo && (
        <button
          type="button"
          onClick={onGo}
          className="shrink-0 text-xs font-medium text-accent transition-opacity hover:opacity-70"
        >
          Go →
        </button>
      )}
    </li>
  );
}
