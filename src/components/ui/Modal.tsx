"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { springSoft, tweenSmooth } from "@/lib/motion";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          initial={{ opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgb(0 0 0 / 0%)" }}
          animate={{ opacity: 1, backdropFilter: "blur(4px)", backgroundColor: "rgb(0 0 0 / 45%)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgb(0 0 0 / 0%)" }}
          transition={tweenSmooth}
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: "blur(8px)" }}
            transition={springSoft}
            className={cn(
              "w-[min(100%,30rem)] rounded-xl border border-line bg-card p-6 shadow-[0_20px_60px_rgb(0_0_0/0.25)] outline-none",
              className,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
