"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { MethodPlan } from "@/features/method/learningLoop";
import { useT } from "@/i18n/I18nProvider";

export function MethodBalance({ plan }: { plan: MethodPlan }) {
  const { t } = useT();
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Input → output method")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t(plan.action.title)}</p>
          <p className="mt-1 text-xs text-ink-muted">{t(plan.action.detail)}</p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs tabular-nums text-ink-muted">
          {t("~{count} min", { count: plan.action.minutes })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {plan.balance.map((entry) => {
          const percent = Math.round(entry.share * 100);
          const target = Math.round(entry.target * 100);
          const low = entry.deficit > 0.08;
          return (
            <div key={entry.area}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-ink">{t(entry.label)}</p>
                <span className={cn("text-xs tabular-nums", low ? "text-accent" : "text-ink-muted")}>
                  {percent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={cn("h-full rounded-full", low ? "bg-accent" : "bg-success")}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                {t("target {count}%", { count: target })}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
