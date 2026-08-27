"use client";

import { Card } from "@/components/ui/Card";
import Disclosure from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import type {
  computeDueReviewRhythm,
  computePerformance,
  computeReturnAfterMiss,
} from "@/lib/srs/analytics";
import { useT } from "@/i18n/I18nProvider";

type Performance = ReturnType<typeof computePerformance>;
type Retention = ReturnType<typeof computeReturnAfterMiss>;
type ReviewRhythm = ReturnType<typeof computeDueReviewRhythm>;

export function PerformanceStats({
  cardsCount,
  stats,
  retention,
  rhythm,
}: {
  cardsCount: number;
  stats: Performance;
  retention?: Retention;
  rhythm?: ReviewRhythm;
}) {
  const { t } = useT();
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold tracking-[-0.01em] text-ink">{t("Performance")}</p>
      <div className="grid grid-cols-3 gap-4">
        <Stat label={t("Phrases")} value={String(cardsCount)} />
        <Stat label={t("Reviews")} value={String(stats.totalReviews)} />
        <Stat label={t("Accuracy")} value={`${Math.round(stats.accuracy * 100)}%`} />
      </div>

      {rhythm && <ReviewRhythmSummary rhythm={rhythm} />}

      {retention && retention.missGaps > 0 && (
        <p className="mt-4 text-xs text-ink-muted">
          {retention.missGaps === 1
            ? t("You've come back {returns} of {gaps} time within a week of a break.", {
                returns: retention.promptReturns,
                gaps: retention.missGaps,
              })
            : t("You've come back {returns} of {gaps} times within a week of a break.", {
                returns: retention.promptReturns,
                gaps: retention.missGaps,
              })}
        </p>
      )}

      {stats.totalReviews > 0 && (
        <Disclosure
          title={t("Review activity")}
          description={t("Last 14 days · {count} today", { count: stats.reviewsToday })}
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
          title={t("Error types")}
          description={t("Accuracy by recurring correction category")}
          className="mt-3"
          nested
        >
          <div className="space-y-2">
            {stats.errorTypes.map((entry) => (
              <div key={entry.type} className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-3 text-xs">
                <span className="truncate text-ink">{entry.type}</span>
                <span className="text-right tabular-nums text-ink-soft">{Math.round(entry.accuracy * 100)}%</span>
                <span className="text-right tabular-nums text-ink-muted">
                  {t("{count} rev", { count: entry.reviews })}
                </span>
              </div>
            ))}
          </div>
        </Disclosure>
      )}
    </Card>
  );
}

function ReviewRhythmSummary({ rhythm }: { rhythm: ReviewRhythm }) {
  const { t } = useT();
  const measured = rhythm.onTimeRate !== null;
  return (
    <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.7px] text-accent">
            {t("Due-review rhythm")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {measured
              ? t("{done} of {total} scheduled reviews were completed on their due day.", {
                  done: rhythm.onTimeReviews,
                  total: rhythm.resolvedReviews + rhythm.overdueNow,
                })
              : t("Tracking starts with your next scheduled review.")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {measured ? `${Math.round((rhythm.onTimeRate ?? 0) * 100)}%` : "—"}
          </p>
          {measured && (
            <p className="text-[11px] text-ink-muted">
              {t("{count} due day(s) in rhythm", { count: rhythm.currentRunDueDays })}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 border-t border-accent/15 pt-2 text-[11px] text-ink-muted">
        {t("Days with nothing due are rest days and never interrupt this rhythm.")}
      </p>
    </div>
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
