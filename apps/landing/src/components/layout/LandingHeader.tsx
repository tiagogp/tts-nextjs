"use client";

import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { hoverLift, springSnappy, tapPress } from "@/lib/motion";
import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";
import { landingNavItems } from "@landing/constants/landing";
import type { LandingSectionId } from "@landing/types/landing";

type LandingHeaderProps = {
  activeSection: LandingSectionId | null;
  headerReady: boolean;
  language: LandingLanguage;
  scrolled: boolean;
  onLanguageChange: (language: LandingLanguage) => void;
  onSectionLinkClick: (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: LandingSectionId,
  ) => void;
};

export function LandingHeader({
  activeSection,
  headerReady,
  language,
  scrolled,
  onLanguageChange,
  onSectionLinkClick,
}: LandingHeaderProps) {
  const t = (portuguese: string) => translateLanding(language, portuguese);
  // Spring once the header has measured the real scroll position; snap before
  // that so the first resolved state never animates on load.
  const headerTransition = headerReady
    ? { type: "spring" as const, stiffness: 220, damping: 28 }
    : { duration: 0 };

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 px-4 pointer-events-none sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        initial={false}
        className="pointer-events-auto mx-auto mt-4 flex w-full max-w-[1120px] items-center justify-between gap-4 rounded-[14px] border px-4 py-3"
        animate={{
          maxWidth: scrolled ? 960 : 1120,
          marginTop: scrolled ? 10 : 16,
          padding: scrolled ? "0.55rem 1.35rem" : "0.75rem 1rem",
          borderRadius: scrolled ? 999 : 14,

          backgroundColor: scrolled
            ? "color-mix(in srgb, var(--surface-card) 92%, transparent)"
            : "rgba(255, 255, 255, 0)",

          borderColor: scrolled ? "var(--border)" : "rgba(255, 255, 255, 0)",

          boxShadow: scrolled
            ? "0 8px 32px rgba(0, 0, 0, 0.4)"
            : "0 8px 32px rgba(0, 0, 0, 0)",

          backdropFilter: scrolled ? "blur(14px)" : "blur(0px)",
        }}
        transition={headerTransition}
      >
        <a href="#top" className="flex items-center">
          <motion.span
            className="brand-wordmark font-normal leading-none text-ink"
            initial={{ fontSize: "1.28rem" }}
            animate={{ fontSize: scrolled ? "1.08rem" : "1.28rem" }}
            transition={headerTransition}
          >
            PhraseLoop
          </motion.span>
          <motion.span
            className="brand-wordmark font-normal leading-none text-fin"
            initial={{ fontSize: "1.28rem" }}
            animate={{ fontSize: scrolled ? "1.08rem" : "1.28rem" }}
            transition={headerTransition}
          >
            .
          </motion.span>
        </a>

        <nav
          className="hidden items-center gap-2 text-sm font-medium text-ink-muted sm:flex"
          aria-label={t("Navegação da página")}
        >
          {landingNavItems.map((item) => {
            const active = activeSection === item.id;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                onClick={(event) => onSectionLinkClick(event, item.id)}
                className={`relative rounded px-2.5 py-1.5 transition-colors ${
                  active ? "text-ink" : "hover:bg-accent/8 hover:text-ink"
                }`}
              >
                {t(item.label)}

                {active ? (
                  <motion.span
                    layoutId="landing-nav-active"
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-accent"
                    transition={springSnappy}
                  />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="flex rounded border border-line bg-card p-0.5 text-xs font-semibold"
            role="group"
            aria-label={language === "pt" ? "Idioma" : "Language"}
          >
            {(["pt", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={language === option}
                onClick={() => onLanguageChange(option)}
                className={`rounded-xs px-2 py-1.5 transition-colors ${
                  language === option
                    ? "bg-ink text-surface"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <motion.a
            href="#waitlist"
            onClick={(event) => onSectionLinkClick(event, "waitlist")}
            whileHover={hoverLift}
            whileTap={tapPress}
            className="hidden rounded border border-ink bg-ink px-3.5 py-2 text-sm font-semibold text-surface sm:inline-flex"
          >
            {t("Lista de espera")}
          </motion.a>
        </div>
      </motion.div>
    </motion.header>
  );
}
