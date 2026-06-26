"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line bg-input px-3 py-2 text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-55";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(control, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(control, "resize-none", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-ink-muted", className)} {...props} />;
}

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
