# 005 — Adopt `LazyMotion` + `m` for the always-mounted shared UI and app shell

- **Status**: DONE
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: `react-doctor/use-lazy-motion`
- **Estimated scope**: 8 files (1 provider + 7 component files), small per file

## Problem

`react-doctor/use-lazy-motion` (canonical recipe:
`https://www.react.doctor/prompts/rules/react-doctor/use-lazy-motion.md`) fires
28 times in `src/`. The highest-leverage cluster is the shared UI primitives
and app shell that mount on *every* session, unconditionally — `Button`,
`IconButton`, `Chip`, `Modal`, `Segmented`, `AppHeader`, and `HomeClient` all
import the full `motion` object instead of `LazyMotion` + `m`:

    // src/components/ui/Button.tsx:4 — current
    import { motion, type HTMLMotionProps } from "motion/react";
    ...
    <motion.button ... />

    // src/components/ui/IconButton.tsx:4 — current
    import { motion, type HTMLMotionProps } from "motion/react";
    ...
    <motion.button ... />

    // src/components/ui/Chip.tsx:4 — current
    import { motion, type HTMLMotionProps } from "motion/react";
    ...
    <motion.button ... />

    // src/components/ui/Segmented.tsx:4 — current
    import { motion } from "motion/react";
    ...
    <motion.span ... />

    // src/components/ui/Modal.tsx:4 — current
    import { AnimatePresence, motion } from "motion/react";
    ...
    <motion.div ...> ... <motion.div ...> ... </motion.div> </motion.div>

    // src/components/app/AppHeader.tsx:4 — current
    import { motion } from "motion/react";
    ...
    <motion.span layoutId="tab-underline" ... />

    // src/components/app/HomeClient.tsx:4 — current
    import { motion } from "motion/react";
    ...
    (three usages: the lesson-view wrapper, the tab-panel wrapper, and the
    "section unlocked" toast — see Target below for exact lines)

`AppProviders.tsx` already wraps the whole tree in `MotionConfig` but has no
`LazyMotion` boundary, so none of this qualifies for the deferred-feature
bundle split:

    // src/components/app/AppProviders.tsx:4,15-21 — current
    import { MotionConfig } from "motion/react";
    ...
      <MotionConfig reducedMotion="user">
        <I18nProvider lang={lang}>
          <AiSettingsProvider>
            <TtsSettingsProvider>{children}</TtsSettingsProvider>
          </AiSettingsProvider>
        </I18nProvider>
      </MotionConfig>

**Honesty check on the actual bundle win**: `motion`'s bundle-splitting only
pays off once *no* component in the shipped route bundle still imports the
full `motion` object — as long as any other file (e.g. `Disclosure.tsx`,
`GradeButtons.tsx`, `CorrectionList.tsx`, and the remaining ~20 `use-lazy-motion`
sites not in this plan) still does `import { motion } from "motion/react"`,
that full animation-feature bundle is still part of the same JS graph. This
plan is the necessary foundation — it migrates the components on the
unconditional, every-session critical path (the app shell and its shared
primitives) — but the full ~30kb reduction this rule promises will not show
up in a bundle-size measurement until a follow-up migrates the remaining
`motion.*` usages elsewhere in `src/`. Track that as a separate follow-up;
don't report this plan as having achieved the full bundle-size win.

## Target

    // src/components/app/AppProviders.tsx — target
    "use client";

    import type { ReactNode } from "react";
    import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
    import { AiSettingsProvider } from "@/features/settings/context/AiSettingsContext";
    import { TtsSettingsProvider } from "@/features/speech/context/TtsSettingsContext";
    import { I18nProvider } from "@/i18n/I18nProvider";
    import type { UiLang } from "@/i18n/config";

    export default function AppProviders({
      children,
      lang,
    }: Readonly<{ children: ReactNode; lang?: UiLang }>) {
      return (
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion="user">
            <I18nProvider lang={lang}>
              <AiSettingsProvider>
                <TtsSettingsProvider>{children}</TtsSettingsProvider>
              </AiSettingsProvider>
            </I18nProvider>
          </MotionConfig>
        </LazyMotion>
      );
    }

    // Note: do NOT pass the `strict` prop on <LazyMotion> — `strict` throws if
    // any `motion.*` (non-`m`) component renders inside the boundary, and the
    // ~20 other `motion.*` usages elsewhere in src/ (out of scope for this
    // plan) would crash the app. Non-strict mode allows `m` and `motion` to
    // coexist safely while the rest of the migration happens incrementally.

    // src/components/ui/Button.tsx — target (only the import and JSX tag change)
    import { m, type HTMLMotionProps } from "motion/react";
    ...
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

    // src/components/ui/IconButton.tsx — target (only the import and JSX tag change)
    import { m, type HTMLMotionProps } from "motion/react";
    ...
    export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
      ({ className, active, type = "button", ...props }, ref) => (
        <m.button
          ref={ref}
          type={type}
          data-active={active}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={springSnappy}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted cursor-pointer transition-colors enabled:hover:bg-accent/10 enabled:hover:text-ink data-[active=true]:bg-accent/10 data-[active=true]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
      ),
    );

    // src/components/ui/Chip.tsx — target (only the import and JSX tag change)
    import { m, type HTMLMotionProps } from "motion/react";
    ...
    export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
      ({ className, active, tone = "default", type = "button", ...props }, ref) => (
        <m.button
          ref={ref}
          type={type}
          data-active={active}
          data-tone={tone}
          whileHover={{ y: -1 }}
          whileTap={tapPress}
          transition={springSnappy}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
            tone === "danger"
              ? "border-danger/55 text-danger enabled:hover:border-danger enabled:hover:bg-danger/10"
              : "border-line text-ink-muted enabled:hover:border-line-strong enabled:hover:text-ink",
            active && tone !== "danger" && "border-accent text-accent bg-accent/10",
            className,
          )}
          {...props}
        />
      ),
    );

    // src/components/ui/Segmented.tsx — target (only the import and JSX tag change)
    import { m } from "motion/react";
    ...
            {active && (
              <m.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-md bg-card shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
                transition={springSnappy}
              />
            )}

    // src/components/ui/Modal.tsx — target (import + both motion.div tags; AnimatePresence unchanged)
    import { AnimatePresence, m } from "motion/react";
    ...
      <AnimatePresence>
        {open && (
          <m.div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tweenSmooth}
            onMouseDown={(event) => {
              if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
            }}
          >
            <m.div
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
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

    // src/components/app/AppHeader.tsx — target (only the import and JSX tag change)
    import { m } from "motion/react";
    ...
                {active && (
                  <m.span
                    layoutId="tab-underline"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent"
                    transition={springSnappy}
                  />
                )}

    // src/components/app/HomeClient.tsx — target (import + all three motion.div usages)
    import { m } from "motion/react";
    ...
              <section className="h-full overflow-y-auto app-scroll-region">
                <m.div
                  className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSoft}
                >
                  <LessonView ... />
                </m.div>
              </section>
    ...
                    <m.div
                      className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                      initial={false}
                      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: TRAVEL }}
                      transition={springSoft}
                    >
                      <TabContent ... />
                    </m.div>
    ...
          {announcedLabel && (
            <m.div
              className="pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink shadow-lg"
              initial={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
              transition={springSoft}
              role="status"
            >
              {t("New section unlocked: {section}", { section: t(announcedLabel) })}
            </m.div>
          )}

(If this plan is applied before 002, the `<TabContent .../>` line inside the
second `m.div` block will already be wrapped by `<TabErrorBoundary>` from
plan 002 — that wrapper is untouched by this plan; only the `motion.div` →
`m.div` tag and the top-of-file import change here.)

## Repo conventions to follow

- Every file in this plan already imports from `"motion/react"` (the `motion`
  package's React entry point, this repo's actual import path — not
  `"framer-motion"`) — `LazyMotion`, `m`, and `domAnimation` are all exported
  from that same path; do not change the import source.
- Preserve every existing `whileHover`/`whileTap`/`transition`/`animate`/
  `initial`/`exit`/`layoutId` prop and value exactly — this plan changes only
  the imported identifier (`motion` → `m`) and the JSX tag name
  (`motion.button` → `m.button`, etc.), never the animation props themselves,
  per Hard Rule 5 (the motion token choices in `src/lib/motion.ts` are a
  settled design decision, not part of this fix).

## Steps

1. In `src/components/app/AppProviders.tsx`, change the import on line 4 to
   `import { LazyMotion, MotionConfig, domAnimation } from "motion/react";`
   and wrap the existing `<MotionConfig>` element in `<LazyMotion features={domAnimation}>`
   (do not pass `strict`), closing it after `</MotionConfig>`.
2. In `src/components/ui/Button.tsx`, change line 4's import from `motion` to
   `m` and the two `<motion.button>`/`</motion.button>` — actually one
   self-closing `<motion.button ... />` — tag to `<m.button ... />`.
3. In `src/components/ui/IconButton.tsx`, same swap: import and the one
   `<motion.button ... />` tag.
4. In `src/components/ui/Chip.tsx`, same swap: import and the one
   `<motion.button ... />` tag.
5. In `src/components/ui/Segmented.tsx`, same swap: import and the one
   `<motion.span ... />` tag (inside the `active &&` block).
6. In `src/components/ui/Modal.tsx`, change the import to
   `import { AnimatePresence, m } from "motion/react";` (keep
   `AnimatePresence` as-is) and swap both `<motion.div>` tags (the backdrop
   and the panel) to `<m.div>`.
7. In `src/components/app/AppHeader.tsx`, same swap: import and the one
   `<motion.span layoutId="tab-underline" ... />` tag.
8. In `src/components/app/HomeClient.tsx`, change the import on line 4 to
   `import { m } from "motion/react";` and swap all three `<motion.div>`
   usages (the lesson-view wrapper around line 183, the tab-panel wrapper
   around line 287, and the "section unlocked" toast around line 322) to
   `<m.div>`.
9. Re-read the diff for all 8 files and confirm no animation prop, value, or
   unrelated line was touched — only import identifiers and tag names.

## Boundaries

- Do NOT pass `strict` to `<LazyMotion>` — it would crash every other
  `motion.*` usage still present elsewhere in `src/` (out of scope here).
- Do NOT migrate any file outside the 8 listed above in this plan (e.g.
  `Disclosure.tsx`, `GradeButtons.tsx`, `CorrectionList.tsx`,
  `TranscriptReview.tsx`, `ConverseTab.tsx`) — track those as a separate
  follow-up plan; migrating them here would balloon this diff far beyond one
  reviewable change.
- Do NOT change any animation value, spring/transition token, or the
  `src/lib/motion.ts` token file itself.
- Do NOT claim in any report that this plan alone reduces the shipped bundle
  by ~30kb — it doesn't, until the remaining `motion.*` usages elsewhere in
  `src/` are migrated too (see Problem).
- STOP if any of the 8 files' current `motion` import or JSX usage no longer
  matches the excerpts above (drifted since commit `9532b571`) — report the
  drift instead of improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears the `use-lazy-motion`
    diagnostic on these 8 files and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: Load the app and click through all 5 tabs, open
  Settings (uses `Button`/`IconButton` throughout), open the onboarding
  `Modal`, and toggle a `Segmented` control (e.g. in Settings or Discover's
  source picker). Confirm every hover/tap/spring animation on these
  components looks and feels identical to before (same spring stiffness,
  same blur/scale, same tab-underline slide in `AppHeader`) — this is a
  behavior-preserving import swap, not a visual change. Using React DevTools
  or a bundle analyzer (`next build` + `.next/analyze` if configured, or
  compare `.next/static/chunks` sizes before/after), confirm no regression in
  initial bundle size for the app shell route; do not expect the full ~30kb
  reduction yet (see Problem's honesty note) — only confirm no increase.
- **Done when**: all 8 files render and animate identically to before,
  `use-lazy-motion` is clear on them specifically, required checks pass, and
  the remaining-migration follow-up is noted in `plans/README.md` rather than
  silently dropped.
