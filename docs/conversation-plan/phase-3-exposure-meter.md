# Phase 3 — Exposure meter

**Goal:** the "weekly exposure meter" (idea #1) — but reframed onto data the app can now
actually observe, instead of self-reported conversations that happen elsewhere.

**Depends on:** Phase 1 (conversations are the exposure signal) + the existing review log.

## Why this is now honest

The original idea assumed conversations happened *outside* the app, so "exposure" would have
been manual self-reporting. Once conversation lives in-app (Phase 1), exposure becomes
**measurable**: sessions, minutes, and user turns per week, plus the existing review counts.

Bonus: it fixes a known gap in weakness analytics. `productionTrend` in
`src/lib/srs/analytics.ts` notes it has *no denominator* — "a quiet stretch reads the same as
genuine improvement." Knowing how much the user actually produced this week (turns spoken)
gives that trend its missing denominator: **errors per turn**, not raw error count.

## Steps

- [ ] **Activity stats.** Extend `analytics.ts` with a weekly aggregate over conversations +
      reviews: sessions this week, user turns this week, review count this week. Pure
      function over the logs, like `computePerformance` / `detectWeaknesses`.
- [ ] **Goal.** Let the user set a weekly target (e.g. "3 conversations", "5 output turns").
      Persist it (a small `settings` record or reuse existing settings plumbing).
- [ ] **"In the zone" visual.** Show target vs actual with a band — under-target (coasting)
      vs over-target (overload) vs in the zone. Lives in the Study tab next to
      `PerformanceStats`.
- [ ] **Per-context exposure (optional).** Break exposure down by scenario/context so the
      user sees *which* situations they've actually been practicing — ties back to the
      weakness-by-context view from Phase 0.
- [ ] **Trend denominator (optional, high-value).** Switch the weakness production trend from
      raw error counts to errors-per-turn using the activity log, addressing the caveat in
      `productionTrend`.

## Acceptance criteria

- The Study tab shows weekly exposure vs a user-set goal with a clear in/under/over signal.
- Exposure counts reflect real in-app activity (conversations + reviews), no manual logging.
- (If trend denominator shipped) a quiet week no longer reads as "improving".

## Risks / notes

- Keep the goal **gentle and editable** — a punitive streak/quota meter discourages more than
  it motivates. Frame it as calibration ("right amount of challenge"), per the original idea.
- "Exposure" here is *output* (turns produced, reviews done) — the things the app can see. Be
  explicit that passive input outside the app isn't counted, to avoid a misleading total.
- This phase is the most deferrable; #2 and #3 deliver the core value. Ship it last.
</content>
