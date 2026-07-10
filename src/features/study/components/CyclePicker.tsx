"use client";

import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import type { CyclePath, CyclePlan } from "../cyclePlanner";

/**
 * P2 #5 — the cycle-expressing home: up to three honest paths (challenge / review / light),
 * with the recommended one pre-highlighted and a one-tap "just start" that runs it — so the
 * common case is a single tap, not a cold decision.
 */
export function CyclePicker({ plan, onStart }: { plan: CyclePlan; onStart: (path: CyclePath) => void }) {
  const { t } = useT();
  const rec = plan.options.find((o) => o.path === plan.recommended)!;
  return (
    <UiCard className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today's next step")}</p>
          <p className="mt-1 text-xs text-ink-muted">{t("Start with the recommended path.")}</p>
        </div>
        <Button size="sm" onClick={() => onStart(plan.recommended)}>
          {t("Start · {load}", { load: rec.load })}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {plan.options.map((option) => (
          <button
            key={option.path}
            type="button"
            disabled={!option.available}
            onClick={() => onStart(option.path)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left transition-colors",
              option.recommended
                ? "border-accent bg-accent/10"
                : "border-line hover:border-accent/40",
              !option.available && "cursor-not-allowed opacity-40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{option.title}</span>
              {option.recommended && (
                <span className="text-[10px] uppercase tracking-wide text-accent">{t("Recommended")}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{option.description}</p>
            <p className="mt-1.5 text-[11px] text-ink-soft">{option.load}</p>
          </button>
        ))}
      </div>
    </UiCard>
  );
}
