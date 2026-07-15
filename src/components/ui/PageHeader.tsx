import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
}

/** Consistent page identity for primary tabs and full-screen app overlays. */
export function PageHeader({ eyebrow, title, description, aside, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.8px] text-accent">{eyebrow}</p>
        )}
        <h1 className={cn("text-2xl font-semibold tracking-[-0.025em] text-ink", eyebrow && "mt-1")}>
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
