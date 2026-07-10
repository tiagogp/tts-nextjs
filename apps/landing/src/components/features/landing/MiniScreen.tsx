"use client";

import { motion } from "motion/react";
import { springSnappy } from "@/lib/motion";
import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";
import { cardHover } from "@landing/constants/landing";

export function MiniScreen({
  kind,
  language,
  title,
}: {
  kind: "discover" | "practice" | "correct";
  language: LandingLanguage;
  title: string;
}) {
  return (
    <motion.div
      className="rounded-lg border border-line bg-card p-3"
      whileHover={cardHover}
      transition={springSnappy}
    >
      <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
        <p className="text-sm font-semibold text-ink">PhraseLoop.</p>
        <p className="text-xs text-ink-muted">{title}</p>
      </div>
      {kind === "discover" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1 text-center text-[11px] font-medium">
            <span className="rounded bg-accent py-1 text-white">YouTube</span>
            <span className="rounded border border-line py-1 text-ink-muted">
              {translateLanding(language, "Artigo")}
            </span>
            <span className="rounded border border-line py-1 text-ink-muted">
              PDF
            </span>
          </div>
          <motion.div
            className="rounded border border-line bg-surface p-2 text-xs text-ink"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            Consistency matters more than intensity.
          </motion.div>
          <motion.div
            className="rounded border border-line bg-surface p-2 text-xs text-ink"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
          >
            I kept putting it off for weeks.
          </motion.div>
        </div>
      ) : null}
      {kind === "practice" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {["24 hoje", "418 cards", "9 dias"].map((item) => (
              <span
                key={item}
                className="rounded border border-line bg-surface p-2 text-center text-xs font-semibold text-ink"
              >
                {translateLanding(language, item)}
              </span>
            ))}
          </div>
          <motion.div
            className="rounded border border-line bg-surface p-3"
            animate={{ borderColor: ["#dedbd6", "#ff5600", "#dedbd6"] }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.2 }}
          >
            <p className="text-sm font-semibold text-ink">turns out</p>
            <p className="mt-1 text-xs text-ink-muted">
              {translateLanding(
                language,
                "Use em uma frase sobre uma surpresa recente.",
              )}
            </p>
          </motion.div>
        </div>
      ) : null}
      {kind === "correct" ? (
        <div className="space-y-2">
          <div className="rounded border border-line bg-surface p-2 text-xs text-ink-muted">
            I am agree with this idea.
          </div>
          <div className="rounded border border-line bg-surface p-2 text-xs text-ink">
            I agree with this idea.
          </div>
          <motion.div
            className="rounded bg-accent/10 p-2 text-xs font-semibold text-accent"
            animate={{ opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {translateLanding(language, "Gerar áudio no Mac")}
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  );
}
