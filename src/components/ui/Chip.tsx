"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springSnappy, tapPress } from "@/lib/motion";

export interface ChipProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  active?: boolean;
  tone?: "default" | "danger";
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, tone = "default", type = "button", ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      data-active={active}
      data-tone={tone}
      whileHover={{ y: -1 }}
      whileTap={tapPress}
      transition={springSnappy}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "border-danger/55 text-danger enabled:hover:border-danger enabled:hover:bg-danger/10"
          : "border-line text-ink-muted enabled:hover:border-line-strong enabled:hover:text-ink",
        active && tone !== "danger" && "border-accent text-accent bg-accent/10",
        className,
      )}
      {...props}
    />
  ),
);
Chip.displayName = "Chip";
