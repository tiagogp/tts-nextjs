"use client";

import { useId, useState, type ReactNode } from "react";

export interface DisclosureProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  nested?: boolean;
}

export default function Disclosure({
  title,
  description,
  badge,
  children,
  defaultOpen = false,
  className = "",
  nested = false,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section
      className={`app-disclosure ${nested ? "app-disclosure-nested" : ""} ${className}`}
      data-open={open}
    >
      <button
        type="button"
        className="app-disclosure-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 text-left">
          <span className="app-disclosure-title">{title}</span>
          {description && <span className="app-disclosure-description">{description}</span>}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {badge}
          <svg className="app-disclosure-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div className="app-disclosure-grid" data-open={open}>
        <div>
          <div
            id={contentId}
            className="app-disclosure-content"
            aria-hidden={!open}
            inert={!open}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
