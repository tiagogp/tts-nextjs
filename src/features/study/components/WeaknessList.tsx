"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
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
      <p className="mb-1 text-sm font-semibold tracking-[-0.01em] text-ink">{t("Weak spots to reinforce")}</p>
      <p className="mb-4 text-xs text-ink-muted">
        {t(
          "The app ranks concepts, error types, and situations from your reviews. Practice saved phrases, or create fresh variants from the same sources.",
        )}
      </p>
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
              className="group flex flex-wrap items-center gap-2 py-1 sm:flex-nowrap sm:gap-3"
            >
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm text-ink">{weakness.label}</p>
                <p className="text-xs text-ink-muted">
                  {t(WEAKNESS_KIND_LABEL[weakness.kind])} ·{" "}
                  {t("{count} reviews", { count: weakness.reviews })}
                </p>
              </div>
              <div className="hidden w-24 shrink-0 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${Math.round(weakness.struggleRate * 100)}%` }}
                  />
                </div>
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-ink-soft">
                {Math.round(weakness.struggleRate * 100)}%
              </span>
              <TrendBadge trend={weakness.trend} delta={weakness.trendDelta} />
              <Chip tone="danger" className="shrink-0" onClick={() => onPractice(weakness)}>
                {t("Drill")}
              </Chip>
              <button
                type="button"
                onClick={() => onGenerate(weakness)}
                disabled={generatingKey !== null}
                className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-ink-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={t("Create new practice phrases for this weak spot from existing sources")}
              >
                {generatingKey === key ? t("Creating…") : t("New phrases")}
              </button>
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
