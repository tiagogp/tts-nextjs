import type { Transition, Variants } from "motion/react";

/**
 * Shared motion tokens. Every animation pulls from this one "polished & smooth"
 * scale so transitions across the app read as a single system instead of a dozen
 * one-off durations and springs.
 *
 * Note on blur: a resting `blur(0px)` keeps an element on its own composite
 * layer, which can soften text. So blur is reserved for *transient* surfaces
 * (overlays, switched content, list items) — never the always-mounted main panel.
 */

/** Soft spring for entrances and shared-layout panels — settles, no harsh overshoot. */
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 26 };
/** Snappier spring for sliding indicators (tab underline, segmented thumb, hover/tap). */
export const springSnappy: Transition = { type: "spring", stiffness: 360, damping: 30 };

/** Smooth ease-out for tweens that must not overshoot (opacity, height, rotate). */
export const easeOut = [0.22, 1, 0.36, 1] as const;
export const tweenSmooth: Transition = { duration: 0.32, ease: easeOut };

/** How far elements travel on enter/exit — large enough to read, calm enough to stay subtle. */
export const TRAVEL = 14;
/** Soft blur applied while an element is off-screen, for depth on entrances. */
export const BLUR = 8;
/** Delay between staggered children. */
export const STAGGER = 0.045;

/** Pointer feedback shared by interactive elements. */
export const hoverLift = { y: -2 };
export const tapPress = { scale: 0.97 };

/** Fade + rise + soft blur — the default entrance for overlays and switched content. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: TRAVEL, filter: `blur(${BLUR}px)` },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: springSoft },
  exit: { opacity: 0, y: -TRAVEL, filter: `blur(${BLUR}px)`, transition: tweenSmooth },
};

/** Give to a parent so its `listItem` children cascade in instead of popping at once. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.03 } },
};

/** List item entrance — used inside a `staggerContainer` (or standalone). */
export const listItem: Variants = {
  hidden: { opacity: 0, y: TRAVEL * 0.65, filter: `blur(${BLUR}px)` },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: springSoft },
};
