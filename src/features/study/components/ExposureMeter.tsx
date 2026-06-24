"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { WeeklyActivity } from "@/lib/srs/analytics";
import {
  exposureZone,
  getWeeklyGoal,
  setWeeklyGoal,
  MAX_GOAL,
  MIN_GOAL,
  type ExposureZone,
} from "@/features/study/weeklyGoal";

const ZONE: Record<ExposureZone, { label: string; tone: string; bar: string }> = {
  building: { label: "Building up", tone: "text-ink-muted", bar: "bg-accent" },
  "in-zone": { label: "In the zone", tone: "text-success", bar: "bg-success" },
  strong: { label: "Big week", tone: "text-accent", bar: "bg-accent" },
};

export function ExposureMeter({ activity }: { activity: WeeklyActivity }) {
  // Read once on mount (lazy initializer); edits persist immediately.
  const [goal, setGoal] = useState(getWeeklyGoal);
  const updateGoal = (next: number) => setGoal(setWeeklyGoal(next));

  const zone = exposureZone(activity.conversations, goal);
  const pct = goal > 0 ? Math.min(100, Math.round((activity.conversations / goal) * 100)) : 0;
  const z = ZONE[zone];
  const remaining = Math.max(0, goal - activity.conversations);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold tracking-[-0.01em] text-ink">This week</p>
        <span className={cn("text-xs font-medium", z.tone)}>{z.label}</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <Stat label="Conversations" value={activity.conversations} />
        <Stat label="Output turns" value={activity.turns} />
        <Stat label="Reviews" value={activity.reviews} />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-ink-muted">Weekly goal</span>
        <div className="flex items-center gap-1.5">
          <GoalButton onClick={() => updateGoal(goal - 1)} disabled={goal <= MIN_GOAL} label="Decrease goal">
            −
          </GoalButton>
          <span className="w-14 text-center tabular-nums text-ink">
            {activity.conversations} / {goal}
          </span>
          <GoalButton onClick={() => updateGoal(goal + 1)} disabled={goal >= MAX_GOAL} label="Increase goal">
            +
          </GoalButton>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full transition-all", z.bar)} style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        {zone === "building"
          ? `${remaining} more conversation${remaining === 1 ? "" : "s"} to hit your goal.`
          : zone === "in-zone"
            ? "Right amount of challenge — keep it up."
            : "You're well past your goal this week. Rest counts too."}
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.8px] text-ink-muted">{label}</p>
    </div>
  );
}

function GoalButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
