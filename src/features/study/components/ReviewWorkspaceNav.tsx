"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";

export type ReviewView = "review" | "progress" | "library";

interface ReviewWorkspaceNavProps {
  value: ReviewView;
  /** The only count shown: due is the one number that asks for action. */
  due: number;
  onChange: (view: ReviewView) => void;
}

export function ReviewWorkspaceNav({ value, due, onChange }: ReviewWorkspaceNavProps) {
  const { t } = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options: { value: ReviewView; label: string; count?: number }[] = [
    { value: "review", label: t("Review now"), count: due },
    { value: "progress", label: t("Progress") },
    { value: "library", label: t("Library") },
  ];

  const select = (index: number) => {
    onChange(options[index].value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = options.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div className="sticky top-0 z-20 -mx-1 bg-surface/95 px-1 py-2 backdrop-blur-sm">
      <div
        role="tablist"
        aria-label={t("Review sections")}
        className="grid grid-cols-3 gap-1 rounded-panel border border-line/75 bg-card p-1 shadow-(--shadow-soft)"
      >
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              id={`review-view-tab-${option.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`review-view-panel-${option.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                active
                  ? "bg-accent/10 text-ink"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.count !== undefined && option.count > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                    active ? "bg-accent text-white" : "bg-line/70 text-ink-soft",
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
