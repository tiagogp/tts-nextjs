# 007 — Adopt `m` for GradeButtons, the highest-remaining `use-lazy-motion` site

- **Status**: TODO
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: `react-doctor/use-lazy-motion`
- **Estimated scope**: 1 file, trivial

## Problem

`react-doctor/use-lazy-motion` (canonical recipe:
`https://www.react.doctor/prompts/rules/react-doctor/use-lazy-motion.md`)
still fires on `GradeButtons.tsx`:

    // src/features/study/components/GradeButtons.tsx:3 — current
    import { motion } from "motion/react";
    ...
    export function GradeButtons({
      srs,
      disabled,
      onGrade,
    }: {
      srs: SrsRecord;
      disabled?: boolean;
      onGrade: (grade: Grade) => void;
    }) {
      const { t } = useT();
      return (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((grade) => (
            <motion.button
              key={grade}
              type="button"
              disabled={disabled}
              whileHover={disabled ? undefined : hoverLift}
              whileTap={disabled ? undefined : { ...tapPress, y: 0 }}
              transition={springSnappy}
              onClick={() => onGrade(grade)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
                GRADE_TONE[grade],
              )}
            >
              <span>{t(GRADE_LABELS[grade])}</span>
              <span className="tabular-nums opacity-70">{previewInterval(srs, grade)}</span>
            </motion.button>
          ))}
        </div>
      );
    }

This file imports the full `motion` object instead of `LazyMotion`'s paired
`m` import — and unlike the 8 files migrated in an earlier plan (which
included the app-wide `<LazyMotion features={domAnimation}>` boundary added
to `AppProviders.tsx`), `GradeButtons.tsx` itself was not part of that batch.
It renders 4 `motion.button` elements, one per grade, and re-renders on
**every single grade action** — the single highest-frequency interaction in
the entire app, higher-frequency than any of the previously-migrated files.
`AppProviders.tsx` already wraps the whole component tree in `LazyMotion`
(non-strict, so `m` and `motion` can coexist safely) — this file just needs
to use `m` like its siblings now do.

## Target

    // src/features/study/components/GradeButtons.tsx — target (import + JSX tag only)
    import { m } from "motion/react";
    ...
    export function GradeButtons({
      srs,
      disabled,
      onGrade,
    }: {
      srs: SrsRecord;
      disabled?: boolean;
      onGrade: (grade: Grade) => void;
    }) {
      const { t } = useT();
      return (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((grade) => (
            <m.button
              key={grade}
              type="button"
              disabled={disabled}
              whileHover={disabled ? undefined : hoverLift}
              whileTap={disabled ? undefined : { ...tapPress, y: 0 }}
              transition={springSnappy}
              onClick={() => onGrade(grade)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
                GRADE_TONE[grade],
              )}
            >
              <span>{t(GRADE_LABELS[grade])}</span>
              <span className="tabular-nums opacity-70">{previewInterval(srs, grade)}</span>
            </m.button>
          ))}
        </div>
      );
    }

No provider change needed here — `AppProviders.tsx` already supplies the
`LazyMotion` boundary app-wide from the earlier plan.

## Repo conventions to follow

- Match the exact `motion` → `m` swap pattern already applied to
  `src/components/ui/Button.tsx`, `IconButton.tsx`, `Chip.tsx`, `Segmented.tsx`
  in the earlier LazyMotion plan — import identifier and JSX tag name only,
  every animation prop (`whileHover`, `whileTap`, `transition`) untouched.

## Steps

1. In `src/features/study/components/GradeButtons.tsx`, change the import on
   line 3 from `import { motion } from "motion/react";` to
   `import { m } from "motion/react";`.
2. Change the `<motion.button ... >` / `</motion.button>` tag to `<m.button
   ... >` / `</m.button>`.
3. Re-read the diff and confirm no other line changed — same animation
   values, same `disabled`/`whileHover`/`whileTap` logic from the earlier
   grade-guard plan, untouched.

## Boundaries

- Do NOT touch `AppProviders.tsx` or any other file — the `LazyMotion`
  boundary already exists app-wide.
- Do NOT change any animation prop value, the `disabled` guard logic, or
  anything else in this file.
- STOP if the file's `motion` import or `motion.button` usage no longer
  matches the Problem excerpt (drifted since commit `9532b571`) — report the
  drift instead of improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears the `use-lazy-motion`
    diagnostic on this file and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: In the Study tab, flip a card and confirm all 4 grade
  buttons render, hover/tap animate identically to before (same lift/press
  spring feel), and grading still works (including the existing disabled
  state while a grade is in flight from the earlier double-submit-guard
  plan). This is a behavior-preserving import swap, not a visual change.
- **Done when**: `GradeButtons.tsx` renders and animates identically to
  before, `use-lazy-motion` is clear on this file, and required checks pass.
