# 009 — Convert Disclosure's expand/collapse to a CSS grid-rows reveal

- **Status**: TODO
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: `react-doctor/no-layout-property-animation`
- **Estimated scope**: 1 file, small

## Problem

The canonical fix recipe for this rule
(`https://www.react.doctor/prompts/rules/react-doctor/no-layout-property-animation.md`)
lists, for "Expand/collapse with unknown target size" (category C — a simple
open/close toggle like this component, not a list add/remove):

> Use framer-motion's `layout` prop for FLIP optimization **Or** render
> through `<AnimatePresence>` with `height: auto` **CSS alternative:**
> `grid-template-rows: 0fr -> 1fr` or `clip-path`.

`Disclosure.tsx` is a shared primitive — imported by `CorrectTab.tsx`,
`DiscoverTab.tsx`, `PerformanceStats.tsx`, `SettingsScreen.tsx`, `SpeechTab.tsx`,
`C1Tab.tsx`, and `ConverseTab.tsx` — meaning it fans out into two HOT-tier
tabs (Correct, Discover) plus several others. It currently uses
Framer Motion's direct per-frame `height` interpolation, the highest-cost of
the three sanctioned options because it requires JavaScript to run and set a
numeric `height` value on every animation frame (as opposed to a
browser-native CSS transition, which the compositor can drive without
re-invoking JS per frame):

    // src/components/ui/Disclosure.tsx:1-82 — current (full file)
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

The existing comment ("Children stay mounted ... so their state survives
collapse") states a real constraint: the CSS grid-rows technique satisfies it
exactly the same way — the content `div` stays permanently in the DOM, it's
just visually collapsed to zero height via `grid-template-rows`, never
unmounted.

## Target

Replace the second `motion.div` (the content reveal) with a plain `div`
driven by a CSS `grid-template-rows` transition, keeping the exact same
duration (220ms) and easing curve (`easeOut` = `cubic-bezier(0.22, 1, 0.36, 1)`,
from `src/lib/motion.ts:19`) via inline `style`, so the timing/feel is
unchanged. The chevron rotation (`motion.svg`) is untouched — it animates
`rotate`, a transform property, which this rule doesn't flag.

    // src/components/ui/Disclosure.tsx — target (only the final motion.div block changes)
          {/* Children stay mounted (grid row collapses to 0fr) so their state survives collapse. */}
          <div
            className="grid overflow-hidden"
            style={{
              gridTemplateRows: open ? "1fr" : "0fr",
              transition: "grid-template-rows 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              className="overflow-hidden"
              style={{
                opacity: open ? 1 : 0,
                transition: "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div id={contentId} className="border-t border-line/65 px-4 pb-4 pt-4" aria-hidden={!open} inert={!open}>
                {children}
              </div>
            </div>
          </div>

The `motion` import stays (still used by `motion.svg` for the chevron) — do
not remove it.

## Repo conventions to follow

- `src/lib/motion.ts:19` (`export const easeOut = [0.22, 1, 0.36, 1] as const;`)
  is the source of truth for the easing curve — the CSS `cubic-bezier(0.22, 1,
  0.36, 1)` value must match it exactly (this is the same curve already used
  by the `motion.svg` chevron's `transition={{ duration: 0.25, ease: easeOut }}`
  a few lines above, just expressed as a CSS string instead of a JS array).
  Per Hard Rule 5, do not change the duration or curve — 220ms was the
  original `motion.div`'s duration.
- Keep the `aria-hidden={!open}`/`inert={!open}` attributes on the innermost
  content `div` exactly as they are — this plan changes only the animation
  mechanism, not the accessibility attributes already present.

## Steps

1. In `src/components/ui/Disclosure.tsx`, replace the final `motion.div`
   block (currently lines 68-77) with the two nested plain `div`s shown in
   Target: an outer `grid`-based wrapper whose `gridTemplateRows` toggles
   between `"0fr"` and `"1fr"` with a CSS transition, and an inner wrapper
   that fades opacity via a matching CSS transition, containing the existing
   `contentId` div unchanged.
2. Update the comment above the block (currently "Children stay mounted
   (height animates) so their state survives collapse.") to reflect the new
   mechanism, as shown in Target.
3. Leave the `motion` import, the `button`/`motion.svg` chevron block, and
   everything else in the file untouched.
4. Re-read the diff and confirm only the final reveal block changed.

## Boundaries

- Do NOT remove the `motion` import — the chevron rotation still needs it.
- Do NOT change the chevron's rotation animation, the `easeOut` token's
  value in `src/lib/motion.ts`, or the 220ms/250ms durations.
- Do NOT change the `nested`/nesting styling, `data-open`, or any Tailwind
  class on the outer `section`.
- Do NOT convert other `Disclosure` consumers' call sites — this plan only
  touches the shared component's internals; its public props (`title`,
  `description`, `badge`, `children`, `defaultOpen`, `className`, `nested`)
  are unchanged, so no caller needs updating.
- STOP if the file no longer matches the Problem excerpt (drifted since
  commit `9532b571`) — report the drift instead of guessing.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears the
    `no-layout-property-animation` diagnostic on this file (no `animate={{
    height: ... }}` remains) and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: Open a `Disclosure` in the Correct tab and in the
  Discover tab (confirms fan-out to both HOT-tier consumers), toggle it open
  and closed several times, and confirm: (a) the reveal timing and easing
  feel identical to before (220ms, same curve), (b) content stays in the DOM
  and its internal state survives a collapse/expand cycle (e.g., scroll
  position or a focused control inside, matching the original comment's
  guarantee), (c) the chevron still rotates smoothly and independently. Using
  React DevTools Profiler / "Highlight updates", confirm the open/close
  toggle no longer triggers a JS-driven per-frame render in this component
  (the animation is now CSS-driven, so React shouldn't re-render on every
  animation frame).
- **Done when**: the diagnostic clears on this file, the reveal is visually
  and behaviorally identical to before, required checks pass, and the
  Profiler confirms no more per-frame JS work for the reveal.
