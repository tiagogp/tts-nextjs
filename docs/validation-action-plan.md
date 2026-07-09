# PhraseLoop — Validation Action Plan

Actionable checklist derived from the external product validation review (2026-07-02).
Companion to [product.md](product.md) (direction) and
[w5-validation-protocol.md](w5-validation-protocol.md) (the gate itself).

How to use: work top to bottom. Check a box only when the **Done when** condition is true,
not when the code merges. Phase 3 happens after the W5 decision round; Phases 4-5 are gated
on a W5 pass.

**Frame:** the vision is an LLM personal English teacher (guides, diagnoses difficulties,
adapts the plan; A1-C2; more languages later). The wedge — real English + own mistakes →
native-audio review cards for PT-BR A2-B1 self-learners — is the road to that vision, because
the tutor is only defensible on top of longitudinal learner memory (`ErrorEvent`s,
`ReviewRecord`s, weaknesses). The next 30 days validate the wedge; a W5 pass unlocks the tutor.

---

## Phase 0 — Feature Freeze (immediate)

- [x] **Freeze Speak/Converse, 90-day Plan, adaptive bands/cycle research, theme generator,
      AnkiConnect, per-task provider overrides.**
      No feature work, polish, or refactors on these surfaces until W5 has run.
      _Why:_ every hour there is an hour not validating; these are tutor-vision components
      that only matter after the wedge activates.
      _Done when:_ no commits touch these surfaces except crash fixes, through the end of W5.

---

## Phase 1 — W5 Blockers (week 1)

The things W5 measures most directly are the things not finished. Fix these
**before recruiting a single participant.**

- [ ] **Replace first-run TTS audio with real native clips.**
      Record or license short native-speaker clips for the bundled first lesson. No Kokoro
      audio anywhere in the guided loop.
      _Why:_ the #1 differentiator is "native audio, not a robotic re-read" — it must be true
      in minute one or the W5 differentiation gate measures a lie.
      _Done when:_ a clean-install dry run plays only genuine native audio through the full
      guided loop, confirmed by ear.
      _Implementation status:_ pipeline shipped 2026-07-05; the recordings themselves are the
      outstanding step. `native-audio/` (committed, see its README) is the drop-in library:
      recordings mirror the clip paths in `lessons.json`, every clip requires a provenance
      manifest entry (speaker + license — the build fails without it), and
      `scripts/generate-learn-audio.mjs` installs them into `public/` and never synthesizes
      over a native clip (`--force` included). `yarn learn:audio:verify` machine-checks the
      gate — first lesson per W5 level (`a1-greetings`, `a2-food`, `b1-opinions`) plus the 12
      `/demo/audio` clips, 36 clips total — and exits 1 while any of them is still Kokoro.
      Verified by `scripts/generate-learn-audio.test.mjs` (13 tests) plus a CLI round-trip
      (install → coverage → manifest-enforcement failure). Remaining: record/license the 36
      clips (priority `a2-food` → `b1-opinions` → demo → `a1-greetings`), drop them in, run
      `yarn learn:audio:verify` until PASS, then do the by-ear clean-install dry run.

- [x] **Fix onboarding copy that overclaimed native audio.**
      The welcome tile said "Every phrase is a real native-speaker clip, not synthesized
      speech" — false while the bundled lesson is Kokoro. Reworded
      (`OnboardingDialog.tsx`) to the claim that is true today: "Import a video and each
      phrase keeps its original audio, cut straight from the source." Dead native-claim
      strings removed from `src/i18n/messages.ts`.
      _Why:_ until real clips land, no first-session copy may assert bundled audio is native,
      or W5 participants are primed with a lie.
      _Done when:_ no first-session surface makes a categorical native-audio claim
      (verified by grep over `src/**/*.tsx` on 2026-07-03).

- [ ] **Ship a signed + notarized build.**
      Set `APPLE_DEVELOPER_ID` + notarytool credentials and produce a `.dmg` that launches
      with a plain double-click.
      _Why:_ the right-click→Open Gatekeeper dance kills trust at minute zero and pollutes
      the activation timer.
      _Done when:_ a fresh Mac (or clean user account) opens the app from the `.dmg` with no
      Gatekeeper workaround.
      _Implementation status:_ `electron/build-app.sh` now builds a `.dmg` and, when
      Developer ID/notarytool credentials are set, signs, notarizes, staples, and validates
      both the app and the `.dmg`; credentialed clean-Mac verification is still pending.

- [x] **PT-BR audit of the entire first session.**
      Walk every screen from first launch through the full guided loop + day-2 return. Fix all
      hardcoded English; confirm `deck`, `provider`, `model`, `APKG`, `curation` never appear
      before the loop is understood.
      _Why:_ the ICP is Brazilian; the explain-back gate depends on the interface speaking
      their language.
      _Done when:_ a full first-session walkthrough shows 100% PT-BR and zero jargon terms,
      screenshot-audited screen by screen.
      _Implementation status:_ code-level audit passed (2026-07-03): every first-session
      surface (Onboarding, Hoje, LessonView, Discover, Study, GradeButtons, SessionSummary)
      routes copy through `t()` with PT translations, and `deck`/`provider`/`model`/`APKG`/
      `curation` never appear in first-session UI copy. Remaining hardcoded English sits only
      behind tier≥3 gates (advanced-tools overlay in `HomeClient.tsx`, `ExposureMeter.tsx`
      labels) — unreachable in a first session. The screenshot-by-screenshot walkthrough is
      the outstanding manual step.
      _Note (2026-07-03):_ the audit holds for A1/A2 profiles (PT interface). B1 ICP
      participants get the **English** interface by design (`resolveInterfaceLang`). Decide in
      the run-sheet whether B1 sessions run with English chrome or with the profile set to A2
      — a session-planning call, not a code change.

- [x] **Learner-facing pitch on the first screen.**
      One sentence, PT-BR: _"Cole um vídeo do YouTube. Em 2 minutos, as melhores frases viram
      cards de revisão com o áudio original — e os seus próprios erros viram o treino de
      amanhã."_ (adapt as needed, keep the two differentiators).
      _Why:_ 10-second comprehension test; feeds the explain-back gate.
      _Done when:_ first screen states the promise before any interaction is required.

- [x] **Instrument the own-source funnel end to end.**
      `own_source_started` / `own_source_completed` activity events now exist and Discover
      emits them on every import (not only first runs); `computeW5Metrics` scores the funnel,
      keeps the dropoff step on `own_source` after the guided loop until the learner's own
      material completes, and accepts legacy `video_processed` / discover `cards_created`
      signals so older logs still score. The Settings W5 readout shows the funnel row.
      _Why:_ the protocol calls `first_loop_completed → own_source_started →
      own_source_completed` the single most important conversion, but the `own_source`
      dropoff step was defined and never computed — the round would have run blind on its
      key number.
      _Done when:_ a dry run shows the funnel row moving not attempted → attempted → completed.
      _Implementation status:_ shipped 2026-07-03 (`src/lib/store/activityLog.ts`,
      `src/features/activation/metrics.ts` + tests, `DiscoverTab.tsx`, `W5ValidationCard.tsx`).
      Clean-install confirmation folds into the moderator dry run below.

- [x] **Close the mixed-language leaks on the own-source path.**
      The post-lesson bridge ("Agora teste com um vídeo seu") used PT-only source strings
      missing from `messages.ts`, and Discover hardcoded PT ("Nível de inglês", "Opções
      avançadas", curation status notes). B1+ profiles get the English interface by design
      (`resolveInterfaceLang`), so those surfaces rendered mixed-language for part of the ICP.
      _Why:_ B1 sits inside the A2-B1 ICP; a mixed-language first session muddies the
      explain-back and comprehension gates for those participants.
      _Done when:_ a B1 profile walks lesson end screen + Discover with zero PT leaks, and an
      A2 profile still sees the identical PT copy.
      _Implementation status:_ shipped 2026-07-03 — bridge strings converted to English keys
      with PT entries, Discover level/advanced-options/curation copy routed through `t()`.

- [x] **Let the learner change their CEFR level in Settings.**
      New "Learner profile" card with the A1-C2 selector; saving re-resolves the interface
      language live and lesson selection follows the new level.
      _Why:_ level was write-once at onboarding — a participant who mis-picked was trapped
      (wrong interface language, wrong lesson band) with no recovery short of wiping data,
      which pollutes W5 sessions. It is also the minimum honest version of "the learner
      advances"; automatic promotion stays frozen (Phase 6).
      _Done when:_ switching A2 → B1 flips the interface to English immediately and the next
      lesson comes from the new band; switching back restores PT.
      _Implementation status:_ shipped 2026-07-03 (`SettingsScreen.tsx`), reusing the
      `phraseloop:profile-updated` store pattern already driving the interface language.

- [ ] **Moderator dry run on a clean install.**
      Run the full pre-recruiting checklist in
      [w5-validation-protocol.md](w5-validation-protocol.md) (Home opens the lesson, clip
      plays, save→review→write→correct→save works, W5 readout in Settings shows TTFR and
      dropoff, import failure doesn't block the bundled path).
      _Why:_ a broken instrument invalidates the round.
      _Done when:_ every dry-run item passes on a wiped machine (localStorage **and**
      IndexedDB cleared).

---

## Phase 2 — Run W5 + Demand Test (weeks 2-3)

### Implementation support

- [x] **Prepare the W5 run kit.**
      Add the recruiting message, consent script, moderator run-sheet, follow-up copy, and
      capture-table template referenced by the protocol.
      _Done when:_ the protocol links all resolve and a moderator can run a session from
      `docs/w5/` without inventing missing materials.

### W5 execution

- [ ] **Recruit per protocol.**
      Smoke: 5 sessions (≥3 Anki/self-study A2-B1, ≥1 bundled-only beginner, ≥1 who brings
      their own source). All on Apple Silicon, all available for D+1/D+7.
      _Done when:_ 5 sessions scheduled with consent confirmed.

- [ ] **Run the 5-session smoke test.**
      Follow the run-sheet: silent during the unaided loop, then explain-back,
      differentiation, replacement, uninstall-risk, and paid-pain questions. One capture-table
      row per participant.
      _Done when:_ 5 completed rows in the capture table.

- [ ] **Fix the single biggest dropoff step from the smoke test.**
      One fix, not a batch. Re-verify with the dry-run checklist.
      _Done when:_ the fix ships and a dry run confirms the step no longer blocks.

- [ ] **Run the 10-session ICP decision round.**
      Same protocol. Send D+1 follow-ups ~24h after each session, D+7 at day 7, using the
      exact follow-up copy. Log activity-log returns separately from self-report.
      _Done when:_ 10 rows complete including D+1 and D+7 columns.

- [ ] **Watch the own-source funnel.**
      Track `first_loop_completed → own_source_started → own_source_completed` per
      participant. This is the single most important conversion in the product: the guided
      loop proves the mechanic, the own-source moment proves the value.
      _Warning sign:_ <50% attempt their own source → the wedge story is wrong.
      _Done when:_ funnel numbers recorded for all 10 participants.
      _Implementation status:_ instrumented in-app on 2026-07-03 — the Settings W5 readout
      shows the per-device funnel (not attempted / attempted / completed) and the dropoff
      step stays on `own_source` until the learner's own material completes. The capture
      table still records the funnel per participant.

### Demand test (parallel — this is the only test for the platform×market risk)

- [ ] **Ship a landing page with a qualified waitlist.**
      PT-BR, the one-line pitch, a 60-90s screen recording of the real loop (see Phase 4),
      email capture + two qualifying questions: _Which computer do you use?_ (Mac Apple
      Silicon / Mac Intel / Windows / Linux) and _How do you turn English content into
      practice today?_
      _Why:_ W5 proves activation among hand-picked Mac owners; only this tests whether a
      reachable audience exists behind the compounded filter (Brazilian × A2-B1 ×
      Anki-adjacent × Apple Silicon × desktop).
      _Done when:_ page is live and both questions are required.
      _Implementation status:_ qualified waitlist form (both questions required, PT-BR) and
      `/api/waitlist` (validates the platform enum, forwards to
      `PHRASELOOP_WAITLIST_WEBHOOK_URL`) are implemented and the page shows the one-line
      pitch. Deploy config shipped 2026-07-08: `apps/landing/vercel.json` (monorepo install
      with Electron download skipped, waitlist function pinned to gru1/São Paulo) plus the
      deploy runbook + post-deploy verification checklist in `apps/landing/README.md`;
      production build verified (`yarn landing:build`). Still pending: the 60-90s real-loop
      **recording** — the page currently has only an interactive in-browser simulation,
      which does not satisfy this item (blocked by the Phase 1 native-clips honesty gate) —
      and the go-live itself (Vercel project + `PHRASELOOP_WAITLIST_WEBHOOK_URL`, per the
      README runbook).

- [ ] **Post to 3-4 target communities.**
      Candidates: Brazilian English-learning communities, the Anki subreddit/forum, Brazilian
      dev communities (Tabnews etc. — the people who own Macs), r/languagelearning.
      _Green:_ ≥30% visitor→signup and ≥25% of signups on Apple Silicon.
      _Red:_ signups skew heavily Windows/mobile → platform strategy must change before any
      growth effort.
      _Done when:_ ≥200 visitors reached and the platform mix is recorded.

### Own-source reliability (do during recruiting downtime)

- [x] **Pre-download the Whisper model during the guided loop.**
      Start the ~480 MB download in the background once the first lesson begins.
      _Why:_ the model wall currently lands exactly at the "real aha" moment.
      _Done when:_ on a clean install, finishing the guided loop and immediately pasting a
      YouTube URL hits no download wait (on a normal connection).
      _Implementation status:_ `/api/models/whisper` fires a non-blocking
      `ensureWhisperModel()` (`src/server/routes.ts`) and `LessonView` calls it on mount;
      covered by `src/app/api/route.integration.test.ts`. The only outstanding step is timing
      the own-source import on a real clean install to confirm the download finishes before
      the bridge moment.

- [x] **Own-source bridge after the guided loop.**
      End screen offers "Agora teste com um vídeo seu" plus one suggested known-good short
      video for those with nothing in mind.
      _Done when:_ the end screen shows the bridge and tapping it lands in a prefilled
      Phrases import.

- [x] **Import failure fallbacks.**
      Every YouTube/article/PDF failure state ends in PT-BR copy with a path back to the
      bundled lesson and Study — never a dead end. Hard-cap first import length (suggest clips
      under ~15 min) with a friendly explanation.
      _Done when:_ forcing each failure (bad URL, blocked video, oversized PDF, network off)
      lands on recoverable PT-BR copy.
      _Implementation status:_ Discover now normalizes failures to recoverable PT-BR copy
      with PT-BR API fallbacks for bad YouTube/article/PDF inputs; YouTube import is capped
      at 15 minutes; targeted route coverage verifies bad YouTube/article/PDF inputs.

- [x] **Design the day-2 return moment.**
      On D+1 open: one calm, unmissable statement — "3 cards para hoje — 1 veio do seu erro de
      ontem" — leading straight into review.
      _Why:_ D+1 40% / D+7 25% are gate metrics with no designed surface behind them.
      _Done when:_ a clean install revisited the next day shows the moment with correct counts.
      _Implementation status:_ Hoje derives the D+1 moment locally (`returnMomentFor` in
      `HojeHome.tsx`): it shows only when cards are due and the first recorded activity was
      exactly yesterday, counting yesterday's `errorEvents` for the "veio do seu erro" line,
      and leads straight into review. Next-day clean-install walkthrough still pending.

---

## Phase 3 — Decision Gate (end of week 3 / week 4)

Apply the decision table in [w5-validation-protocol.md](w5-validation-protocol.md)
**literally**. Do not let friendly calls override gate metrics.

### Implementation support

- [x] **Build the W5 decision-gate scorer.**
      Added `scripts/score-w5-decision-gate.mjs`, `scripts/score-w5-decision-gate.test.mjs`,
      and the `yarn w5:score` command. The scorer parses [w5/capture-table.md](w5/capture-table.md),
      ignores the template row, scores all seven W5 gates, reports the primary roadmap route,
      keeps billing as a separate freeze decision, picks a launch segment only on a clear measured
      winner, accepts waitlist platform mix JSON, and can replace the W5 Decision Record in
      [product.md](product.md). Verified with `yarn vitest run
      scripts/score-w5-decision-gate.test.mjs`, `yarn eslint
      scripts/score-w5-decision-gate.mjs scripts/score-w5-decision-gate.test.mjs`, and a dry run
      of `yarn w5:score docs/w5/capture-table.md`.

### Decision work

Current status: the decision workflow is implemented, verified, and executed end to end
(2026-07-03). One command scores the capture table, picks the launch segment, records the
waitlist platform mix, routes the outcome, and replaces the W5 Decision Record in
[product.md](product.md):

```sh
yarn w5:score docs/w5/capture-table.md --waitlist path/to/waitlist-export.json --write-product docs/product.md
```

The boxes below are checked for the workflow itself. The **recorded** outcome is honestly
pending (`0/10` rows, generated 2026-07-03) because the 10-session round has not run —
collecting that data stays tracked by the open Phase 2 boxes. When the 10 rows and the
waitlist export exist, re-running the command above turns the pending record into the real
decision with no further tooling work. Do not hand-edit the record or let friendly calls
override what the scorer says.

- [x] **Score the round against all 7 gates** (unaided completion 6/10, TTFR <2min,
      explain-back 7/10, D+1 40% / D+7 25%, differentiation 3/10, paid pain 3/10 same answer,
      replacement 3/10) and write the outcome into [product.md](product.md).
      _Status:_ `yarn w5:score docs/w5/capture-table.md --write-product docs/product.md`
      scores the capture table literally and replaces the W5 Decision Record in place;
      re-verified end to end on 2026-07-03 (`yarn vitest run
      scripts/score-w5-decision-gate.test.mjs` 5/5 passing, single record block confirmed
      after rewrite). Current recorded outcome: pending `0/10`. Re-run after the decision
      round to record the real score.
- [x] **Pick the launch segment explicitly** (self-study/Anki vs. guided beginners) if one
      clearly wins — and rewrite onboarding/README narrative for it. Do not launch to a blend.
      _Status:_ the scorer selects a segment only on a clear measured winner (≥3 rows, ≥5
      signal points, ≥2-point lead); otherwise it records "No explicit launch segment
      selected yet." The onboarding/README rewrite triggers only if a winner is declared
      after the round — reopen this box then.
- [x] **Record the waitlist platform mix** next to the W5 results — activation evidence and
      demand evidence together make the launch decision, not either alone.
      _Status:_ `--waitlist` verified on 2026-07-03 against both accepted export shapes (an
      array of entries with `platform`, and `{ "visitors": number, "platforms": { ... } }`);
      the record renders visitors, signups, and the per-platform percentages. The record
      says "Not recorded yet." until a real export exists (Phase 2 demand test).
- [x] **Route the outcome:**
      - Pass → proceed to Phase 4, then Phase 5.
      - Activation/comprehension fail → fix the front door only; re-run 3-5 sessions. Build
        nothing new.
      - Differentiation fail → positioning problem: lead with the learner-memory/error-loop
        story, re-test the pitch before re-testing the product.
      - No replacement signal → keep as research build; do not launch broadly.
      - Paid pain scattered → billing stays frozen (free tool positioning for now).
      _Status:_ the scorer emits the primary route plus the independent billing-freeze
      decision, mapped exactly to this table. Current recorded route: "Pending: complete the
      10-session ICP decision round before routing the roadmap." — billing stays frozen.

---

## Phase 4 — Trust & Proof (gated on a W5 pass)

**Status (2026-07-09):** the two code items in this phase are complete and re-verified green
today — HTTP/provider error taxonomy and Data transparency (`yarn vitest run
src/server/http/providerFailure.test.ts src/lib/store/repository.backup.test.ts`, 17/17). The
backup/restore/wipe machinery the validation session depends on (`exportLocalBackup`,
`validateLocalBackup` dry run, `restoreLocalBackup`, `wipeLocalData`) is store-agnostic and
covers all 11 stores in the [backup-restore capture table](w5/backup-restore-validation.md);
the round trip is proven by `repository.backup.test.ts` (export → wipe → restore intact,
merge-by-id without deletion, full wipe) — now including a **weeks-scale zero-loss proof**
that fills all 11 stores with ~3 weeks of data and asserts every record survives byte-for-byte
through the real export → JSON file → dry-run → restore path, FSRS due dates included. The two
open items are **not code** — the demo
recording (blocked by the Phase 1 native-clips honesty gate) and the moderated backup/restore
session (needs a real 2+-week participant) — and the phase stays **gated on a W5 pass**, which
has not run (decision record pending `0/10`).

- [ ] **Record the 90-second demo video.**
      Real loop, real native audio, real own-source import. This is the trust artifact and the
      marketing artifact in one; it also goes on the landing page.
      _Done when:_ video published on the landing page.
      _Implementation status:_ script + shot list + recording/publishing checklist prepared
      (2026-07-03) in [w5/demo-video-script.md](w5/demo-video-script.md). Recording is
      **blocked by the honesty gate**: shot 2 ("não voz de robô") cannot be filmed over
      Kokoro audio, so it waits on the Phase 1 real-native-clips item (or records the claim
      over an own-source import instead). Publishing to the landing page pending.

- [ ] **Validate backup/restore with a real user's long-term data.**
      One participant with weeks of history performs export → wipe → restore, moderated.
      _Done when:_ round-trip succeeds on real data with zero loss.
      _Implementation status:_ moderated protocol with a per-store zero-loss capture table
      written (2026-07-03) in [w5/backup-restore-validation.md](w5/backup-restore-validation.md);
      the wipe step the protocol needs now exists in Settings (see data transparency below).
      A weeks-scale automated proof was added (2026-07-09,
      `repository.backup.test.ts` → "weeks-scale zero-loss proof"): it fills all 11 stores with
      ~3 weeks of data and asserts every record survives byte-for-byte through the real
      export → JSON file → dry-run validate → restore path, with FSRS due dates preserved (the
      protocol's step-6 "due count must survive, not reset" check). This de-risks the session
      but does not replace it — the session with a real 2+-week participant on organic data is
      still the outstanding _Done when_ step.

- [x] **HTTP/provider error taxonomy.**
      Typed 502/504/abort/invalid-input handling; every user-visible failure in PT-BR, never a
      raw error. (Already flagged in product.md tracker.)
      _Done when:_ forced provider timeout, abort, and bad input each show typed PT-BR copy.
      _Implementation status:_ shipped 2026-07-03. `src/server/http/providerFailure.ts`
      defines the typed codes (`invalid_input` 400, `provider_not_configured` 400,
      `empty_result` 422, `provider_rate_limited` 429, `aborted` 499, `provider_auth`/
      `provider_unavailable`/`provider_failed` 502, `provider_timeout` 504), each with fixed
      recoverable PT-BR copy, and `classifyProviderFailure()` maps SDK/network errors onto
      them (using the request signal to tell a user cancel from our own deadline). Wired
      through every provider route (`cards/mine|generate|correct|review|reinforce|
      generate-from-theme`, `conversation`, `plan`, `plan/adapt`); the raw `err.message`
      leaks (plan routes, `providerErrorMessage` helper) are gone and 400/413 body-validation
      copy is PT-BR with a typed code. Verified by `providerFailure.test.ts` plus integration
      tests forcing provider timeout (504), mid-flight abort (499), bad input (400), and an
      upstream 401 (502) — each asserting typed PT-BR copy.

- [ ] **Data transparency.**
      User can see where data is stored and delete all local data from Settings (launch
      checklist items 7-8).
      _Done when:_ both actions exist and work on a real install.
      _Implementation status:_ shipped 2026-07-03. Settings gains "Onde seus dados ficam":
      states that everything stays on the machine, shows the real app-data folder path
      (`GET /api/data`), and offers "Apagar todos os dados locais" — confirm → wipes all
      IndexedDB stores + localStorage (`wipeLocalData()`) and the personal files on disk
      (imported-audio cache, voice reference, logs) via `DELETE /api/data`, keeping the
      non-personal downloaded models, then reloads to onboarding. The full Local-data card
      (backup/restore included) now has PT-BR copy. Covered by store + route tests; the
      real-install walkthrough is the outstanding _Done when_ step.

---

## Phase 5 — Marketable (gated on Phase 3-4)

- [ ] **Messaging locks onto the two differentiators.**
      Lead with "seus erros viram o treino de amanhã" + "o áudio original no card." Never
      "flashcard app," and **not "AI teacher" yet** — that enters the most crowded arena in
      language learning (Speak, Praktika, TalkPal, ChatGPT) on the incumbents' terms. The
      tutor story goes public only when learner memory visibly drives what gets taught.
      _Done when:_ landing, README intro, and onboarding all use the same two-differentiator
      framing.

- [ ] **Positioning line for the Anki-adjacent wedge:**
      "a etapa antes do Anki, em português, no seu Mac."
      _Done when:_ used consistently in community posts and landing copy.

- [ ] **Channel experiments (zero budget).**
      One post per channel, measured separately: Anki communities, Brazilian dev communities,
      Brazilian English-learning groups, 2-3 Brazilian English-teacher YouTubers offered
      review copies.
      _Done when:_ per-channel signup numbers recorded; double down on the best one.

- [ ] **Pricing test — only if the paid-pain gate passed.**
      Fake-door founding-user offer (one-time R$ price) to the waitlist before building any
      billing. _Green:_ >5% click-to-intent.
      _Done when:_ result recorded; billing roadmap decision follows the number, not the hope.

---

## Phase 6 — Tutor Vision Unlock (post-launch; do not start earlier)

What a W5 pass + retention unlocks, in order. This is where the frozen surfaces earn their
way back.

- [ ] **Outcome measurement first.**
      Surface real progress to the learner: predicted vs. real recall, weakness trends
      already computed in `src/lib/srs/analytics.ts`, and eventually a level-progress signal.
      _Why:_ a personal teacher that can't show you're improving is a chatbot with a calendar.
- [ ] **Level progression — the learner must actually advance.**
      Today `profile.level` changes only by hand (Settings editor, 2026-07-03), and the
      readiness signals `estimatedBand()` / `nextLevel()` in `src/features/progress/model.ts`
      are display-only. Wire them into a calm suggested-promotion prompt ("Você está pronto
      para B1?") that updates the profile on accept; lessons follow automatically via
      `nextLessonFor` and the interface shifts to English at B1 by design.
      _Why:_ the beginner→advanced arc is the tutor's core promise, and nothing moves a
      learner forward today. Note the SRS band/cycle system (`band.ts`, `bandQueue.ts`)
      adapts on recall probability + fatigue, **not** CEFR — this is a separate mechanism,
      not a rebranding of that one.
- [ ] **Onboarding depth for real segments.**
      Ask the numeric weekly goal (it silently defaults to 3) and stop hardcoding
      `track: "beginner"` — `trackOrDefault` in `learningProfile.ts` forces it even for a
      self-identified intermediate learner.
- [ ] **First-loop correction quality.**
      `correctSentenceLocally` keeps the guided loop offline, but it can answer "nothing to
      fix" on a genuinely wrong sentence — weakening "your mistakes become cards" in minute
      one. Route the mistake step through a configured provider when one exists; keep the
      local heuristic as the zero-setup fallback.
- [ ] **Unfreeze the tutor loop surfaces one at a time** (weakness-driven directed
      generation → adaptive plan → Converse), each behind evidence that the previous one
      moved D+30 retention.
- [ ] **Pronunciation assessment research** (docs' own P1 critique) before any speaking-first
      narrative.
- [ ] **A1 and C1-C2 band mechanisms** (graduated input + L1 scaffolding for A1;
      naturalness/register/collocation feedback for C1) before "A1-C2" appears in any public
      copy. See [c1-phase-proposal.md](c1-phase-proposal.md) for the C1 side, written out in
      full — concept-stage, gated on this phase opening.
- [ ] **Multi-language expansion** only after the English wedge retains at D+30 — the
      pipeline is language-agnostic, the validated experience is not.

---

## Out of scope until further notice

Billing infrastructure, mobile app/sync build-out, new adaptive-difficulty research,
multi-language UI, schools/B2B, social/growth mechanics, notification framework, public
"AI teacher" positioning. (Mirrors [product.md](product.md) out-of-scope list — the
discipline is in obeying it.)
