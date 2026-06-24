"use client";

import { Card } from "@/components/ui/Card";
import Disclosure from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import type { computePerformance } from "@/lib/srs/analytics";

type Performance = ReturnType<typeof computePerformance>;

export function PerformanceStats({ cardsCount, stats }: { cardsCount: number; stats: Performance }) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold tracking-[-0.01em] text-ink">Performance</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Cards" value={String(cardsCount)} />
        <Stat label="Reviews" value={String(stats.totalReviews)} />
        <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
        <Stat label="Streak" value={`${stats.streakDays}d`} />
      </div>

      {stats.totalReviews > 0 && (
        <Disclosure
          title="Review activity"
          description={`Last 14 days · ${stats.reviewsToday} today`}
          className="mt-5"
          nested
        >
          <div className="flex h-16 items-end gap-1">
            {stats.daily.map((day) => {
              const max = Math.max(1, ...stats.daily.map((entry) => entry.count));
              const height = day.count === 0 ? 2 : Math.round((day.count / max) * 56) + 4;
              return (
                <div
                  key={day.day}
                  className={cn("flex-1 rounded-sm", day.count === 0 ? "bg-line" : "bg-accent")}
                  title={`${day.day}: ${day.count}`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </Disclosure>
      )}

      {stats.errorTypes.length > 0 && (
        <Disclosure
          title="Error types"
          description="Accuracy by recurring correction category"
          className="mt-3"
          nested
        >
          <div className="space-y-2">
            {stats.errorTypes.map((entry) => (
              <div key={entry.type} className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-3 text-xs">
                <span className="truncate text-ink">{entry.type}</span>
                <span className="text-right tabular-nums text-ink-soft">{Math.round(entry.accuracy * 100)}%</span>
                <span className="text-right tabular-nums text-ink-muted">{entry.reviews} rev</span>
              </div>
            ))}
          </div>
        </Disclosure>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.8px] text-ink-muted">{label}</p>
    </div>
  );
}
