"use client";

import type { AdvancedReviewSummary, RefinementEvent } from "@/lib/cards/schema";

interface NaturalnessReviewProps {
  refinements: RefinementEvent[];
  overall?: AdvancedReviewSummary;
}

export function NaturalnessReview({ refinements, overall }: NaturalnessReviewProps) {
  if (refinements.length === 0 && !overall) return null;

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">Naturalness upgrades</p>
        <p className="text-xs text-ink-muted">
          Correct, but stronger options a native speaker would likely reach for.
        </p>
      </div>

      {overall && (
        <div className="space-y-1.5 text-xs text-ink-soft">
          {overall.strengths.length > 0 && (
            <p>
              <span className="font-medium text-ink-muted">Strengths:</span>{" "}
              {overall.strengths.join("; ")}
            </p>
          )}
          {overall.nextFocus && (
            <p>
              <span className="font-medium text-ink-muted">Next focus:</span> {overall.nextFocus}
            </p>
          )}
        </div>
      )}

      {refinements.length > 0 && (
        <ul className="space-y-2">
          {refinements.map((item) => (
            <li key={item.id} className="rounded-md border border-line bg-card px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-line px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-muted">
                  {item.dimension}
                </span>
                {item.impact && <span className="text-xs text-ink-muted">{item.impact}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.original}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-ink">{item.suggested}</p>
              {item.rationale && <p className="mt-1.5 text-xs text-ink-muted">{item.rationale}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
