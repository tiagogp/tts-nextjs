"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springSnappy } from "@/lib/motion";

export interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, type = "button", ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      data-active={active}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={springSnappy}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted cursor-pointer transition-colors enabled:hover:bg-accent/10 enabled:hover:text-ink data-[active=true]:bg-accent/10 data-[active=true]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
