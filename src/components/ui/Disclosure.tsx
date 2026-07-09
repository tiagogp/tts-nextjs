"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { easeOut } from "@/lib/motion";

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
      className={cn(
        "overflow-hidden border border-line/75 bg-card transition-[border-color,box-shadow] duration-200",
        nested ? "rounded-[0.55rem]" : "rounded-panel",
        open && "border-line",
        open && !nested && "shadow-(--shadow-soft)",
        className,
      )}
      data-open={open}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left text-ink hover:bg-accent/3"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold tracking-[-0.01em]">{title}</span>
          {description && <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{description}</span>}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {badge}
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="text-ink-muted"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: easeOut }}
          >
            <path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </span>
      </button>
      {/* Children stay mounted (height animates) so their state survives collapse. */}
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.22, ease: easeOut }}
        className="overflow-hidden"
      >
        <div id={contentId} className="border-t border-line/65 px-4 pb-4 pt-4" aria-hidden={!open} inert={!open}>
          {children}
        </div>
      </motion.div>
    </section>
  );
}
