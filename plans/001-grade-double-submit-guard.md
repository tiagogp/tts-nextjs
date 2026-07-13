# 001 — Guard `grade()` against double-submission from rapid grade-button taps

- **Status**: DONE
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, small (guard + prop threading, no logic rewrite)

## Problem

`GradeButtons` has no `disabled`/busy state, and `useStudySession.grade()` is an
async function that awaits `recordReview`, then `Promise.all([getReviews(),
getCounts()])`, before it advances the queue with `setQueue(rest)`. Nothing
blocks re-entry into `grade()` while the first call is still in flight.

A rapid double-tap/double-click on a grade button (very plausible on the
single highest-frequency interaction in the app — one tap per flashcard,
every session) re-enters `grade()` with the same stale `current`/`queue`
closure before the first call's `setQueue(rest)` has landed. Both calls read
`current` as the same card, both call `recordReview` for the same card, and
both push an entry onto `sessionResults` — double-recording the SRS review
and duplicating a session-summary line for one card the learner only graded
once.

    // src/features/study/components/GradeButtons.tsx:24-47 — current
    export function GradeButtons({ srs, onGrade }: { srs: SrsRecord; onGrade: (grade: Grade) => void }) {
      const { t } = useT();
      return (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((grade) => (
            <motion.button
              key={grade}
              type="button"
              whileHover={hoverLift}
              whileTap={{ ...tapPress, y: 0 }}
              transition={springSnappy}
              onClick={() => onGrade(grade)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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

    // src/features/study/useStudySession.ts:213-293 — current (relevant lines only)
    const grade = useCallback(
      async (g: Grade, scaffold: ScaffoldTelemetry) => {
        if (!current) return;
        const now = Date.now();
        ...
        const next = await recordReview(current.card, current.srs, g, { ... });
        ...
        const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);
        ...
        if (rest.length > 0) {
          setQueue(rest);
        } else if (reinforcing) {
          ...
        }
        setFlipped(false);
      },
      [current, queue, reinforcing, mode, cooldown, recentAnswers, reloadStandardQueue, reviews, pronAttempts, errorEvents],
    );

    // src/features/study/components/StudyCard.tsx:216-225 — current
    {!flipped ? (
      <Button variant="primary" size="lg" className="py-2.5" onClick={onFlip}>
        {t("Show answer")}
      </Button>
    ) : (
      <GradeButtons
        srs={current.srs}
        onGrade={(g) => onGrade(g, { hintUsed: scaffoldLevel > SCAFFOLD.none, scaffoldLevel })}
      />
    )}

## Target

Guard reentrancy with a ref (always fresh, unlike a `useCallback`-captured
state value) and expose a `grading` boolean purely to disable the buttons in
the UI while a grade is in flight.

    // src/features/study/useStudySession.ts — target (add near the other refs, e.g. after flipAtRef at line 81)
    const flipAtRef = useRef<number | null>(null);
    const gradingRef = useRef(false);
    const [grading, setGrading] = useState(false);

    // src/features/study/useStudySession.ts — target grade()
    const grade = useCallback(
      async (g: Grade, scaffold: ScaffoldTelemetry) => {
        if (!current || gradingRef.current) return;
        gradingRef.current = true;
        setGrading(true);
        try {
          const latencyMs = flipAtRef.current != null ? Date.now() - flipAtRef.current : undefined;
          flipAtRef.current = null;
          const next = await recordReview(current.card, current.srs, g, {
            latencyMs,
            hintUsed: scaffold.hintUsed,
            scaffoldLevel: scaffold.scaffoldLevel,
          });
          const activation = markFirstRunReviewCompleted();
          void emitActivity("cards_reviewed", {
            count: 1,
            cardIds: [current.card.id],
            activation,
          });
          const answers = [...recentAnswers, { grade: g, latencyMs }];
          setRecentAnswers(answers);
          if (mode === "standard" && !cooldown && isSaturated(answers)) setCooldown(true);
          const rest = queue.slice(1);
          const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);
          setSessionResults((prev) => [...prev, {
            cardId: current.card.id, grade: g, srs: next,
          }]);
          setReviews(allReviews);
          setCounts(c);
          if (rest.length > 0) {
            setQueue(rest);
          } else if (reinforcing) {
            setReinforcing(null);
            setQueue(await reloadStandardQueue());
          } else if (mode === "light") {
            setMode("standard");
            setQueue([]);
          } else {
            setQueue(await reloadStandardQueue());
          }
          setFlipped(false);
        } finally {
          gradingRef.current = false;
          setGrading(false);
        }
      },
      [current, queue, reinforcing, mode, cooldown, recentAnswers, reloadStandardQueue, reviews, pronAttempts, errorEvents],
    );

    // src/features/study/useStudySession.ts — target return object (add `grading` alongside `flipped`)
    return {
      available,
      loading,
      queue,
      current,
      flipped,
      grading,
      reviews,
      ...
    };

    // src/features/study/components/StudyCard.tsx — target: accept and thread `grading`
    interface StudyCardProps {
      totalCards: number;
      current?: DueCard;
      queueLength: number;
      flipped: boolean;
      grading: boolean;
      sessionResults: SessionResult[];
      tomorrow: TomorrowPreview | null;
      streakDays: number;
      reviews: ReviewRecord[];
      onFlip: () => void;
      onGrade: (grade: Grade, scaffold: ScaffoldTelemetry) => void;
      onDiscover: () => void;
    }

    export function StudyCard({
      totalCards,
      current,
      queueLength,
      flipped,
      grading,
      sessionResults,
      tomorrow,
      streakDays,
      reviews,
      onFlip,
      onGrade,
      onDiscover,
    }: StudyCardProps) {
      ...
          ) : (
            <GradeButtons
              srs={current.srs}
              disabled={grading}
              onGrade={(g) => onGrade(g, { hintUsed: scaffoldLevel > SCAFFOLD.none, scaffoldLevel })}
            />
          )}

    // src/features/study/components/GradeButtons.tsx — target
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

## Repo conventions to follow

- `Button.tsx` (`src/components/ui/Button.tsx:10`) already uses the
  `disabled:cursor-not-allowed disabled:opacity-50` Tailwind pair and
  `enabled:hover:...` variants — imitate that exact disabled-state styling
  convention in `GradeButtons`, not a new one.
- Keep `try { ... } finally { ... }` wrapping the *entire* existing body of
  `grade()` — do not reorder or drop any of the existing side effects
  (`emitActivity`, `setSessionResults`, etc.).

## Steps

1. In `src/features/study/useStudySession.ts`, add `gradingRef` (a `useRef(false)`)
   next to `flipAtRef` (around line 81) and a `grading` state (`useState(false)`)
   next to `flipped` (around line 64).
2. In the same file, wrap the existing body of `grade()` (lines 214-291) in the
   guard + `try/finally` shown in Target, without changing any of the internal
   logic, dependency array, or side-effect ordering.
3. Add `grading` to the object returned by the hook (around line 419-451),
   next to `flipped`.
4. In `src/features/study/components/StudyCard.tsx`, add `grading: boolean` to
   `StudyCardProps`, destructure it in the function signature, and pass
   `disabled={grading}` to `<GradeButtons />` (around line 221-224).
5. In `src/features/study/components/GradeButtons.tsx`, add an optional
   `disabled?: boolean` prop, apply it to each `motion.button` (`disabled`,
   and skip `whileHover`/`whileTap` when disabled per Target), and add the
   disabled Tailwind classes matching `Button.tsx`'s convention.
6. In `src/features/study/components/StudyTab.tsx`, destructure `grading`
   from `useStudySession()` (around line 35-67) and pass it through to
   `<StudyCard grading={grading} ... />` (around line 159-171).
7. Re-read the diff for all four files and remove any unrelated churn.

## Boundaries

- Do NOT change the SRS grading logic, the queue-advancement branches, or any
  of the activation side-effect calls inside `grade()`.
- Do NOT add a debounce library or a generic "async guard" hook/utility —
  the ref+try/finally pattern is the entire fix.
- Do NOT change `GradeButtons`' public grade-selection behavior when not
  disabled.
- STOP if `useStudySession.ts`'s `grade()` body no longer matches the Problem
  excerpt (drifted since commit `9532b571`) — report the drift instead of
  improvising a different guard placement.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress.
  - `yarn tsc --noEmit` (or the repo's configured typecheck), `yarn lint`,
    and `yarn test` (in particular `src/features/study/studySession.test.ts`
    and any `useStudySession`/`StudyCard` tests) all pass.
- **Behavior check**: In the Study tab, flip a card, then rapidly double-click
  (or double-tap) a grade button. Confirm exactly one entry is added to the
  session summary for that card (not two), and that the grade buttons visibly
  disable (matching `Button.tsx`'s dimmed/`not-allowed` styling) for the brief
  window between tap and the next card appearing. Grade a full queue normally
  afterward and confirm nothing else changed (summary, streak, tomorrow
  preview all render as before).
- **Done when**: the double-grade race can no longer be reproduced by rapid
  double-tapping, the buttons show a disabled state while grading, required
  checks pass, and no other Study tab behavior changed.
