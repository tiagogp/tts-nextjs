# 003 — Stop re-fetching the entire reviews store on every card grade

- **Status**: DONE
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files (1 core + 2 test files), small

## Problem

Every single flashcard grade calls `getReviews()`, which is an unindexed
`getAll()` over the *entire* `reviews` IndexedDB object store:

    // src/lib/store/repository.ts:253-255 — current
    export function getReviews(): Promise<ReviewRecord[]> {
      return getAll<ReviewRecord>(STORES.reviews);
    }

    // src/lib/store/repository.ts:257-268 — current (the repo's own comment
    // already names this exact problem)
    /**
     * Reviews graded at or after `since`, straight off the `reviewedAt` index. Prefer this
     * over `getReviews()` for windowed stats (weekly activity, recent-days charts) — the
     * full log grows without bound under daily use.
     */
    export function getReviewsSince(since: number): Promise<ReviewRecord[]> {
      return getAllFromIndex<ReviewRecord>(
        STORES.reviews,
        "reviewedAt",
        IDBKeyRange.lowerBound(since),
      );
    }

But `grade()` — the single highest-frequency call in the app, one per
flashcard — doesn't use the indexed, bounded query. It re-reads the *whole*
table on every card:

    // src/features/study/useStudySession.ts:213-293 — current (relevant lines)
    const grade = useCallback(
      async (g: Grade, scaffold: ScaffoldTelemetry) => {
        if (!current) return;
        ...
        const next = await recordReview(current.card, current.srs, g, {
          latencyMs,
          hintUsed: scaffold.hintUsed,
          scaffoldLevel: scaffold.scaffoldLevel,
        });
        ...
        const rest = queue.slice(1);
        const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);
        ...
        setReviews(allReviews);
        setCounts(c);
        ...
      },
      [current, queue, reinforcing, mode, cooldown, recentAnswers, reloadStandardQueue, reviews, pronAttempts, errorEvents],
    );

    // src/lib/store/repository.ts:226-251 — current: recordReview already builds
    // the exact review record and persists it, but only returns the SRS record
    export async function recordReview(
      card: Card,
      srs: SrsRecord,
      grade: Grade,
      telemetry?: ReviewTelemetry,
      now: Date = new Date(),
    ): Promise<SrsRecord> {
      const { next, scheduledDays, previousState } = applyGrade(srs, grade, now);
      await put(STORES.srs, next);
      const review: ReviewRecord = {
        id: crypto.randomUUID(),
        cardId: card.id,
        grade,
        reviewedAt: now.getTime(),
        previousState,
        scheduledDays,
        concept: card.concept,
        errorType: card.errorType,
        context: card.context,
        latencyMs: telemetry?.latencyMs,
        hintUsed: telemetry?.hintUsed,
        scaffoldLevel: telemetry?.scaffoldLevel,
      };
      await put(STORES.reviews, review);
      return next;
    }

The cost of this full scan grows unbounded with the learner's total lifetime
review count (exactly what the `getReviewsSince` comment warns about) — every
grade gets slower as the app is used more, on the app's core loop. The full
history genuinely is needed downstream (`computePerformance`,
`detectWeaknesses`, `deriveSkillStates` all operate over all-time reviews, so
swapping to `getReviewsSince` would silently change their semantics) — the
real fix is to stop re-fetching what was already just computed and written:
`recordReview` already builds the exact `ReviewRecord` for this grade and
persists it; it just doesn't hand it back.

## Target

Change `recordReview` to return the review record it already built, and have
`grade()` append it to the in-memory `reviews` array instead of re-reading
the whole store.

    // src/lib/store/repository.ts — target
    export async function recordReview(
      card: Card,
      srs: SrsRecord,
      grade: Grade,
      telemetry?: ReviewTelemetry,
      now: Date = new Date(),
    ): Promise<{ next: SrsRecord; review: ReviewRecord }> {
      const { next, scheduledDays, previousState } = applyGrade(srs, grade, now);
      await put(STORES.srs, next);
      const review: ReviewRecord = {
        id: crypto.randomUUID(),
        cardId: card.id,
        grade,
        reviewedAt: now.getTime(),
        previousState,
        scheduledDays,
        concept: card.concept,
        errorType: card.errorType,
        context: card.context,
        latencyMs: telemetry?.latencyMs,
        hintUsed: telemetry?.hintUsed,
        scaffoldLevel: telemetry?.scaffoldLevel,
      };
      await put(STORES.reviews, review);
      return { next, review };
    }

    // src/features/study/useStudySession.ts — target (relevant lines only; the
    // rest of grade()'s body is unchanged)
        const { next, review } = await recordReview(current.card, current.srs, g, {
          latencyMs,
          hintUsed: scaffold.hintUsed,
          scaffoldLevel: scaffold.scaffoldLevel,
        });
        ...
        const rest = queue.slice(1);
        const allReviews = [...reviews, review];
        const c = await getCounts();
        ...
        setReviews(allReviews);
        setCounts(c);

`getCounts()` stays as-is: it calls IndexedDB's native `.count()` on each
store (`src/lib/store/db.ts:183-186`), which does not materialize records and
is not part of this finding — only the `getAll()`-based `getReviews()` call
is removed from this hot path. `getReviews()` itself stays exported and
unchanged; it is still correctly used elsewhere for one-time loads (initial
mount in `useStudySession`'s `refresh()`, `ProgressOverview`, etc.) where a
full-history read is appropriate and only happens once per mount, not once
per grade.

## Repo conventions to follow

- `getReviewsSince` (`repository.ts:257-268`) is the exemplar for this file's
  existing convention of leaving a comment above a function that explains a
  performance tradeoff — the module already documents this exact class of
  problem, so no new commenting convention is needed.
- Keep `recordReview`'s new return shape a plain object literal
  (`{ next, review }`), matching this codebase's preference for explicit
  named fields over positional tuples for anything with more than one
  return value (see `applyGrade`'s own `{ next, scheduledDays, previousState }`
  return one line above, in the same function).

## Steps

1. In `src/lib/store/repository.ts`, change `recordReview`'s return type from
   `Promise<SrsRecord>` to `Promise<{ next: SrsRecord; review: ReviewRecord }>`
   and its final `return next;` to `return { next, review };` (lines 226-251).
   No other line in the function body changes.
2. In `src/features/study/useStudySession.ts`, update the call site (around
   line 224) from `const next = await recordReview(...)` to
   `const { next, review } = await recordReview(...)`.
3. In the same function, replace
   `const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);`
   (line 241) with `const allReviews = [...reviews, review];` followed by
   `const c = await getCounts();`. Leave every other line of `grade()`
   unchanged — `allReviews` is still used identically below it (as
   `evidenceAfter`'s filter input and as the argument to `setReviews`).
4. Remove `getReviews` from this file's import from `@/lib/store/repository`
   (around line 16) only if it is no longer referenced anywhere else in
   `useStudySession.ts` after step 3 — check before removing.
5. Update the one test call site that consumes `recordReview`'s return value
   as an `SrsRecord`, in `src/lib/store/repository.query.test.ts:155-156`:

       // current
       const srs2 = await recordReview(card, srs1!, Rating.Good, undefined, new Date(1_700_000_000_000));
       await recordReview(card, srs2, Rating.Good, undefined, new Date(1_700_000_200_000));

       // target
       const { next: srs2 } = await recordReview(card, srs1!, Rating.Good, undefined, new Date(1_700_000_000_000));
       await recordReview(card, srs2, Rating.Good, undefined, new Date(1_700_000_200_000));

   The other four `recordReview(...)` call sites in test files
   (`src/features/study/studySession.test.ts:55,76`,
   `src/lib/store/repository.query.test.ts:135`,
   `src/lib/store/repository.backup.test.ts:85`) already discard the return
   value (bare `await recordReview(...)` with no assignment) — confirm this
   and leave them unchanged.
6. Re-read the diff across all three files and remove any unrelated churn.

## Boundaries

- Do NOT change `getReviewsSince`, `getReviews`'s own implementation, or any
  other call site of `getReviews()` outside `grade()` — those are correct
  one-time-per-mount reads and out of scope.
- Do NOT change what data downstream consumers (`computePerformance`,
  `detectWeaknesses`, `deriveSkillStates`, `computeReturnAfterMiss`) receive —
  `allReviews` must remain the full all-time list, just built by appending
  instead of re-fetching.
- Do NOT touch `getCounts()` or `count()` — they use IndexedDB's native
  count and are not part of this finding.
- STOP if `recordReview` or `grade()` no longer match the Problem excerpts
  (drifted since commit `9532b571`) — report the drift instead of
  improvising a different data-flow.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass — in
    particular `src/lib/store/repository.query.test.ts`,
    `src/lib/store/repository.backup.test.ts`, and
    `src/features/study/studySession.test.ts`.
- **Behavior check**: In the Study tab, grade a full queue of cards (mixed
  grades) and confirm performance stats, retention, weaknesses, and the
  session summary all show identical values to before this change — nothing
  downstream should differ, since `allReviews` still ends up with the same
  contents, just built without a round-trip. Using the React DevTools
  Profiler, record a grade action before and after: confirm the trace no
  longer shows an IndexedDB read scaling with total review count (the
  `getReviews`/`getAll` call should be gone from the `grade()` path).
- **Done when**: `grade()` no longer calls `getReviews()`, all Study tab
  stats/session-summary values are unchanged after grading, required checks
  pass, and the Profiler trace confirms the full-store read is gone from the
  per-grade path.
