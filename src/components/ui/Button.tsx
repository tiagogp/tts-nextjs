"use client";

import { forwardRef } from "react";
import { m, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { hoverLift, springSnappy, tapPress } from "@/lib/motion";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer select-none transition-[color,background-color,border-color,filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white font-semibold enabled:hover:brightness-95",
        secondary:
          "border border-line bg-input text-ink-soft enabled:hover:border-line-strong enabled:hover:text-ink",
        danger: "text-danger enabled:hover:bg-danger/10",
        ghost: "text-ink-soft enabled:hover:bg-accent/10 enabled:hover:text-ink",
        solid: "bg-off-black text-white enabled:hover:brightness-110",
      },
      size: {
        sm: "px-2.5 py-1 text-xs",
        md: "px-3.5 py-2 text-sm",
        lg: "w-full px-4 py-2.5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <m.button
      ref={ref}
      type={type}
      whileHover={hoverLift}
      whileTap={tapPress}
      transition={springSnappy}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
