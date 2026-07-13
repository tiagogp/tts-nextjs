# 004 — Memoize the per-render analytics derivations in `useStudySession`

- **Status**: DONE
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small

## Problem

Six array-scanning derivations run as plain function calls on every render of
`useStudySession` — not wrapped in `useMemo` — even though the hook backs the
Study tab, the single hottest render loop in the app (re-renders on every
card flip and every grade):

    // src/features/study/useStudySession.ts:406-416 — current
    const stats = computePerformance(reviews);
    const retention = computeReturnAfterMiss(reviews);
    const activity = computeWeeklyActivity(conversations, reviews);
    const weaknesses = detectWeaknesses(reviews, errorEvents);
    const weeklyGoal = getWeeklyGoal();
    const showAdaptiveDepth = reviews.length >= 5;

    // P2 #5 — derive the three-path cycle plan from per-skill state + due + light availability.
    const skillStates = deriveSkillStates(reviews, cardsWithSrs, pronAttempts, errorEvents);
    const lightAvailable = buildLightQueue(queue, cardsWithSrs).length > 0;
    const cyclePlan = deriveCyclePlan(skillStates, { due: counts.due, lightAvailable });

`computePerformance`, `computeReturnAfterMiss`, `computeWeeklyActivity`, and
`detectWeaknesses` each do a full filter/sort/bucket pass over `reviews`
(and `errorEvents`/`conversations`), and `reviews` grows unbounded with app
usage. `deriveSkillStates` does the same over `reviews` + `cardsWithSrs` +
`pronAttempts` + `errorEvents` combined. None of these six calls are gated by
`useMemo`, so every render — including one triggered by an unrelated state
change like `setFlipped(true)` on a card flip, which doesn't change any of
`reviews`/`errorEvents`/`conversations`/`cardsWithSrs`/`pronAttempts`/`queue`/
`counts.due` — re-runs all of them from scratch.

The target pattern is one `useMemo` per derived value, with the dependency
array listing the actual reactive inputs the computation reads.

## Target

    // src/features/study/useStudySession.ts — target (replaces lines 406-416)
    const stats = useMemo(() => computePerformance(reviews), [reviews]);
    const retention = useMemo(() => computeReturnAfterMiss(reviews), [reviews]);
    const activity = useMemo(
      () => computeWeeklyActivity(conversations, reviews),
      [conversations, reviews],
    );
    const weaknesses = useMemo(
      () => detectWeaknesses(reviews, errorEvents),
      [reviews, errorEvents],
    );
    const weeklyGoal = getWeeklyGoal();
    const showAdaptiveDepth = reviews.length >= 5;

    // P2 #5 — derive the three-path cycle plan from per-skill state + due + light availability.
    const skillStates = useMemo(
      () => deriveSkillStates(reviews, cardsWithSrs, pronAttempts, errorEvents),
      [reviews, cardsWithSrs, pronAttempts, errorEvents],
    );
    const lightAvailable = useMemo(
      () => buildLightQueue(queue, cardsWithSrs).length > 0,
      [queue, cardsWithSrs],
    );
    const cyclePlan = useMemo(
      () => deriveCyclePlan(skillStates, { due: counts.due, lightAvailable }),
      [skillStates, counts.due, lightAvailable],
    );

`getWeeklyGoal()` and `showAdaptiveDepth` are left as plain calls: the first
takes no reactive input (a pure read with no dependency to key on) and the
second is a single `.length >= 5` comparison — both are already effectively
free and memoizing them would only add noise, matching the audit's own
"reject premature memoization" guidance.

## Repo conventions to follow

- Use one `useMemo` per derived value, with no combining unrelated
  derivations into one memo.
- `useMemo` is already imported and used elsewhere in this same file's sibling
  component (`StudyCard.tsx:3,77-80`, `useMemo(() => (cardId ? ... : 0), [cardId, reviews])`)
  — this file (`useStudySession.ts`) currently imports `useCallback`, `useEffect`,
  `useRef`, `useState` from `"react"` (line 10) but not `useMemo`; add it to
  that same import line rather than a separate import statement.

## Steps

1. In `src/features/study/useStudySession.ts` line 10, add `useMemo` to the
   existing `import { useCallback, useEffect, useRef, useState } from "react";`.
2. Replace lines 406-416 with the Target block above — six `useMemo`-wrapped
   derivations, `getWeeklyGoal()` and `showAdaptiveDepth` left as plain calls.
3. Confirm the returned object (lines 418-451) references the same variable
   names (`stats`, `retention`, `activity`, `weaknesses`, `weeklyGoal`,
   `showAdaptiveDepth`, `cyclePlan`) — no changes needed there since the
   names are unchanged, only how they're computed.
4. Re-read the diff and confirm no dependency array omits a value the memoized
   function actually reads (check each of the four analytics functions'
   signatures in `src/lib/srs/analytics.ts` and `deriveSkillStates`'s in
   `src/lib/srs/skillState.ts` if unsure).

## Boundaries

- Do NOT memoize `getWeeklyGoal()` or `showAdaptiveDepth` — the audit
  explicitly rejects memoizing trivial/no-input computations.
- Do NOT change the signatures of `computePerformance`, `computeReturnAfterMiss`,
  `computeWeeklyActivity`, `detectWeaknesses`, `deriveSkillStates`,
  `buildLightQueue`, or `deriveCyclePlan` themselves — only wrap their call
  sites in this one file.
- Do NOT touch the `grade()` callback or any other part of this file outside
  lines 406-416 (and the line-10 import) in this plan.
- STOP if lines 406-416 no longer match the Problem excerpt (drifted since
  commit `9532b571`) — report the drift instead of guessing new line numbers.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: Open the Study tab with React DevTools Profiler
  recording, flip a card (no grade yet — this changes `flipped` only, not
  `reviews`/`errorEvents`/`conversations`/`cardsWithSrs`/`pronAttempts`).
  Before this change, `computePerformance`/`detectWeaknesses`/etc. re-run on
  that render; after this change, "Why did this render" in the Profiler
  should show the memoized values as reused (bailout), not recomputed. Then
  grade a card and confirm `stats`/`weaknesses`/`cyclePlan` *do* update
  (since `reviews` genuinely changed) — the memoization must not go stale.
  Confirm the Performance Stats panel, Weakness list, and Cycle picker all
  show the same values as before this change after a full grading session.
- **Done when**: a card-flip render no longer recomputes the six derivations
  (confirmed in the Profiler), a grade still correctly updates them, required
  checks pass, and Study tab UI values match pre-change behavior exactly.
