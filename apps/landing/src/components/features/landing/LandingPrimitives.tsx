"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { sectionReveal } from "@landing/constants/landing";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase text-accent">
      {children}
    </p>
  );
}

export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={sectionReveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.22 }}
    >
      {children}
    </motion.div>
  );
}
