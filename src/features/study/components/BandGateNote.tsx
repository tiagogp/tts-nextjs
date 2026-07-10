"use client";

import { Card as UiCard } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { BandGateResult } from "@/lib/srs/band";
import { useT } from "@/i18n/I18nProvider";

/**
 * P3 #7 — surface the offline difficulty-band gate honestly. The band ships gated: it only
 * re-orders the due queue once the gate, replayed over the real review log, says "adopt". This
 * shows the current verdict and its plain-language reason so the decision is inspectable rather
 * than hidden — exactly the "confirm offline before any UI" step the strategy demands.
 */
export function BandGateNote({ gate }: { gate: BandGateResult }) {
  const { t } = useT();
  const status =
    gate.verdict === "adopt"
      ? { label: t("Active"), cls: "border-accent bg-accent/10 text-accent" }
      : gate.verdict === "skip"
        ? { label: t("Holding"), cls: "border-line bg-surface-2 text-ink-soft" }
        : { label: t("Gathering data"), cls: "border-line bg-surface-2 text-ink-muted" };
  return (
    <UiCard className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.7px] text-ink-soft">{t("Review order")}</p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            status.cls,
          )}
        >
          {status.label}
        </span>
      </div>
      <p className="text-xs text-ink-muted">{gate.note}</p>
      {gate.verdict === "adopt" && (
        <p className="text-[11px] text-ink-soft">
          {t("Due phrases are ordered toward the best recall zone first.")}
        </p>
      )}
    </UiCard>
  );
}
