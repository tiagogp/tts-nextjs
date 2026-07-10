import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "text-ink-muted",
  accent: "text-accent",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
} as const;

export interface StatusPillProps extends ComponentProps<"span"> {
  tone?: keyof typeof toneClass;
}

export function StatusPill({ className, tone = "default", ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-current px-2 py-0.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
