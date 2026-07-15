"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { listItem, staggerContainer } from "@/lib/motion";
import type { Weakness, WeaknessTrend } from "@/lib/srs/analytics";
import { useT } from "@/i18n/I18nProvider";

interface WeaknessListProps {
  weaknesses: Weakness[];
  genError: string | null;
  generatingKey: string | null;
  onPractice: (weakness: Weakness) => void;
  onGenerate: (weakness: Weakness) => void;
}

const WEAKNESS_KIND_LABEL: Record<Weakness["kind"], string> = {
  errorType: "error type",
  concept: "concept",
  context: "situation",
};

export function WeaknessList({ weaknesses, genError, generatingKey, onPractice, onGenerate }: WeaknessListProps) {
  const { t } = useT();
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Needs attention")}</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
            {t("Recurring patterns from your reviews, ordered by how often they cause difficulty.")}
          </p>
        </div>
        {weaknesses.length > 0 && (
          <span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-medium tabular-nums text-danger">
            {t("{count} patterns", { count: weaknesses.length })}
          </span>
        )}
      </div>
      {genError && <p className="mb-3 text-xs text-danger">{genError}</p>}
      {weaknesses.length === 0 && (
        <div className="rounded border border-line bg-surface px-3 py-3 text-xs text-ink-soft">
          {t("No patterns detected yet. Review a few phrases or run a correction session first.")}
        </div>
      )}
      <motion.ul className="space-y-2" variants={staggerContainer} initial="hidden" animate="show">
        {weaknesses.slice(0, 8).map((weakness) => {
          const key = `${weakness.kind}:${weakness.label}`;
          return (
            <motion.li
              key={key}
              layout
              variants={listItem}
              className="group grid gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{weakness.label}</p>
                <p className="text-xs text-ink-muted">
                  {t(WEAKNESS_KIND_LABEL[weakness.kind])} ·{" "}
                  {t("{count} reviews", { count: weakness.reviews })}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-danger" style={{ width: `${Math.round(weakness.struggleRate * 100)}%` }} />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-ink-soft">
                  {Math.round(weakness.struggleRate * 100)}%
                </span>
                <TrendBadge trend={weakness.trend} delta={weakness.trendDelta} />
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button variant="secondary" size="sm" onClick={() => onPractice(weakness)}>
                  {t("Practice")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGenerate(weakness)}
                  disabled={generatingKey !== null}
                  title={t("Create new practice phrases for this weak spot from existing sources")}
                >
                  {generatingKey === key ? t("Creating…") : t("Create variants")}
                </Button>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </Card>
  );
}

/**
 * Shows where a weak spot is heading: ↓ green = improving, ↑ red = worsening.
 * Stable spots render an empty slot so attention stays on what's moving.
 */
function TrendBadge({ trend, delta }: { trend: WeaknessTrend; delta: number }) {
  const { t } = useT();
  if (trend === "stable") {
    return <span className="w-10 shrink-0" aria-hidden />;
  }
  const improving = trend === "improving";
  const points = `${improving ? "−" : "+"}${Math.abs(Math.round(delta * 100))}`;
  return (
    <span
      className={cn(
        "w-10 shrink-0 text-right text-xs font-medium tabular-nums",
        improving ? "text-success" : "text-danger",
      )}
      title={
        improving
          ? t("Fewer errors of this type in your writing over time")
          : t("More errors of this type in your writing over time")
      }
    >
      {improving ? "↓" : "↑"} {points}
    </span>
  );
}
