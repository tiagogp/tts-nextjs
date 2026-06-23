import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends ComponentProps<"div"> {
  /** `panel` = soft-shadow surface; `flat` = bordered card without shadow. */
  variant?: "panel" | "flat";
}

export function Card({ className, variant = "panel", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card",
        variant === "panel"
          ? "rounded-panel border border-line/75 shadow-(--shadow-soft)"
          : "rounded-lg border border-line",
        className,
      )}
      {...props}
    />
  );
}
