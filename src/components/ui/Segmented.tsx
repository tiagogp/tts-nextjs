"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** `inline` hugs its content; `fill` spreads options into equal columns. */
  variant?: "inline" | "fill";
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "inline",
  className,
}: SegmentedProps<T>) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, dir: 1 | -1) => {
    const n = options.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + dir * step + n) % n;
      if (!options[idx].disabled) {
        onChange(options[idx].value);
        refs.current[idx]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative rounded-[0.55rem] bg-line/45 p-1",
        variant === "fill" ? "grid" : "inline-flex gap-1",
        className,
      )}
      style={variant === "fill" ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative z-10 min-w-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]",
              active ? "text-ink" : "text-ink-muted enabled:hover:text-ink",
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-md bg-card shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
                transition={springSnappy}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
