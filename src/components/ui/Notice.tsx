import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "border-line",
  success: "border-success",
  error: "border-danger",
  warning: "border-warning",
} as const;

export interface NoticeProps extends ComponentProps<"div"> {
  tone?: keyof typeof toneClass;
}

export function Notice({ className, tone = "default", ...props }: NoticeProps) {
  return (
    <div
      className={cn("rounded-md border bg-card px-3.5 py-2.5 text-sm text-ink-soft", toneClass[tone], className)}
      {...props}
    />
  );
}
