# Phase 0 — Context primitive

**Goal:** give every mistake and card a *situational context* ("work", "restaurant",
"medical", …), and teach weakness detection to group by it.

**Why first:** it's the smallest change with the biggest leverage. It completes the
"stuck-points diary" (#2) and enables the "context repertoire generator" (#3) *before*
conversation exists — and conversation in Phase 1 just sets this tag automatically from the
scenario.

## Scope note: no DB migration needed

IndexedDB object stores are schemaless per record, so adding an **optional** field to
`ErrorEvent` / `Card` records needs no `DB_VERSION` bump. We only group in memory
(`getAll` → group), so no new index either. (The conversation store in Phase 1 *does* bump
the version.)

## Steps

- [ ] **Schema.** Add `context?: string` to `ErrorEvent` and `Card` in
      `src/lib/cards/schema.ts`. Document it as a free-form situational tag (lowercased,
      e.g. `"job-interview"`), distinct from `concept` (the linguistic point) and
      `errorType` (the grammatical category).
- [ ] **Correction parse.** Carry `context` through `parseErrorsJson` in
      `src/features/correct/model.ts` (accept it from the tool JSON; leave undefined when
      absent).
- [ ] **Correct route + API.** Thread an optional `context` param through
      `/api/cards/correct` and `evaluateCorrectionText` in `src/features/correct/api.ts`.
- [ ] **Card generation.** Propagate `source` context onto generated `Card.context` in the
      providers / `generate()` path so cards inherit the source's context.
- [ ] **Denormalize for analytics.** Add `context?: string` to `ReviewRecord`
      (`src/lib/store/repository.ts`) and set it in `recordReview` from `card.context` —
      mirrors how `concept` / `errorType` are already denormalized so analytics survives
      card deletion.
- [ ] **Weakness grouping.** In `src/lib/srs/analytics.ts`, add a third grouping
      `kind: "context"` to `detectWeaknesses` (alongside `concept` and `errorType`). Context
      weaknesses carry no production trend (same as concepts → `STABLE`).
- [ ] **Reinforcement by context.** Extend `getReinforcementCards` /
      `getReinforcementSources` in `repository.ts` to accept `kind: "context"`.
- [ ] **UI.** Show context in `WeaknessList` and let the user add/edit a context tag in the
      Correct tab. Optional manual entry for now; Phase 1 fills it automatically.

## Acceptance criteria

- A correction can be saved with a `context`, and it round-trips through card → review.
- `detectWeaknesses` returns context-keyed weaknesses, sorted with the existing ones.
- Existing records with no `context` still work (everything stays optional).
- `src/lib/srs/analytics.test.ts` extended with a context-grouping case.

## Risks / notes

- Keep `context` values normalized (a small canonical list + free-form) so "work" and
  "Work" don't split a weakness. A shared `normalizeContext()` helper avoids drift.
- Don't overload `concept` — `concept` is the linguistic isolate ("preposition after a
  motion verb"); `context` is the *situation*. They're orthogonal and both useful.
</content>
