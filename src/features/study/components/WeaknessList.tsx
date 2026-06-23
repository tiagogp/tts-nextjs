"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { listItem, staggerContainer } from "@/lib/motion";
import type { Weakness, WeaknessTrend } from "@/lib/srs/analytics";

interface WeaknessListProps {
  weaknesses: Weakness[];
  genError: string | null;
  generatingKey: string | null;
  onPractice: (weakness: Weakness) => void;
  onGenerate: (weakness: Weakness) => void;
}

export function WeaknessList({ weaknesses, genError, generatingKey, onPractice, onGenerate }: WeaknessListProps) {
  return (
    <Card className="p-5">
      <p className="mb-1 text-sm font-semibold tracking-[-0.01em] text-ink">Weak spots</p>
      <p className="mb-4 text-xs text-ink-muted">
        Concepts and error types you keep struggling with — worst first. ↓/↑ shows whether that error is slowing
        down or piling up in your writing.
      </p>
      {genError && <p className="mb-3 text-xs text-danger">{genError}</p>}
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
                  {weakness.kind === "errorType" ? "error type" : "concept"} · {weakness.reviews} reviews
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
                Practice
              </Chip>
              <button
                type="button"
                onClick={() => onGenerate(weakness)}
                disabled={generatingKey !== null}
                className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-ink-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="Generate new cards for this concept from existing sources"
              >
                {generatingKey === key ? "Generating…" : "New cards"}
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
          ? "Fewer errors of this type in your writing over time"
          : "More errors of this type in your writing over time"
      }
    >
      {improving ? "↓" : "↑"} {points}
    </span>
  );
}
