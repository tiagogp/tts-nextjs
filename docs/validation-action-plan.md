# PhraseLoop — Validation Action Plan

Actionable checklist derived from the external product validation review (2026-07-02).
Companion to [product.md](product.md) (direction) and
[w5-validation-protocol.md](w5-validation-protocol.md) (the gate itself).

How to use: work top to bottom. Check a box only when the **Done when** condition is true,
not when the code merges. Phases 3-5 are gated — do not start them before the gate passes.

**Frame:** the vision is an LLM personal English teacher (guides, diagnoses difficulties,
adapts the plan; A1-C2; more languages later). The wedge — real English + own mistakes →
native-audio review cards for PT-BR A2-B1 self-learners — is the road to that vision, because
the tutor is only defensible on top of longitudinal learner memory (`ErrorEvent`s,
`ReviewRecord`s, weaknesses). The next 30 days validate the wedge; a W5 pass unlocks the tutor.

---

## Phase 0 — Feature Freeze (immediate)

- [ ] **Freeze Speak/Converse, 90-day Plan, adaptive bands/cycle research, theme generator,
      AnkiConnect, per-task provider overrides.**
      No fixes, no polish, no refactors on these surfaces until W5 has run.
      _Why:_ every hour there is an hour not validating; these are tutor-vision co˜mponents
      that only matter after the wedge activates.
      _Done when:_ no commits touch these surfaces except crash fixes, through the end of W5.

---

## Phase 1 — W5 Blockers (week 1)

The three things W5 measures most directly are the three things not finished. Fix these
**before recruiting a single participant.**

- [ ] **Replace first-run TTS audio with real native clips.**
      Record or license short native-speaker clips for the bundled first lesson. No Kokoro
      audio anywhere in the guided loop.
      _Why:_ the #1 differentiator is "native audio, not a robotic re-read" — it must be true
      in minute one or the W5 differentiation gate measures a lie.
      _Done when:_ a clean-install dry run plays only genuine native audio through the full
      guided loop, confirmed by ear.

- [ ] **Ship a signed + notarized build.**
      Set `APPLE_DEVELOPER_ID` + notarytool credentials and produce a `.dmg` that launches
      with a plain double-click.
      _Why:_ the right-click→Open Gatekeeper dance kills trust at minute zero and pollutes
      the activation timer.
      _Done when:_ a fresh Mac (or clean user account) opens the app from the `.dmg` with no
      Gatekeeper workaround.

- [ ] **PT-BR audit of the entire first session.**
      Walk every screen from first launch through the full guided loop + day-2 return. Fix all
      hardcoded English; confirm `deck`, `provider`, `model`, `APKG`, `curation` never appear
      before the loop is understood.
      _Why:_ the ICP is Brazilian; the explain-back gate depends on the interface speaking
      their language.
      _Done when:_ a full first-session walkthrough shows 100% PT-BR and zero jargon terms,
      screenshot-audited screen by screen.

- [ ] **Learner-facing pitch on the first screen.**
      One sentence, PT-BR: _"Cole um vídeo do YouTube. Em 2 minutos, as melhores frases viram
      cards de revisão com o áudio original — e os seus próprios erros viram o treino de
      amanhã."_ (adapt as needed, keep the two differentiators).
      _Why:_ 10-second comprehension test; feeds the explain-back gate.
      _Done when:_ first screen states the promise before any interaction is required.

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

- [ ] **Post to 3-4 target communities.**
      Candidates: Brazilian English-learning communities, the Anki subreddit/forum, Brazilian
      dev communities (Tabnews etc. — the people who own Macs), r/languagelearning.
      _Green:_ ≥30% visitor→signup and ≥25% of signups on Apple Silicon.
      _Red:_ signups skew heavily Windows/mobile → platform strategy must change before any
      growth effort.
      _Done when:_ ≥200 visitors reached and the platform mix is recorded.

### Own-source reliability (do during recruiting downtime)

- [ ] **Pre-download the Whisper model during the guided loop.**
      Start the ~480 MB download in the background once the first lesson begins.
      _Why:_ the model wall currently lands exactly at the "real aha" moment.
      _Done when:_ on a clean install, finishing the guided loop and immediately pasting a
      YouTube URL hits no download wait (on a normal connection).

- [ ] **Own-source bridge after the guided loop.**
      End screen offers "Agora teste com um vídeo seu" plus one suggested known-good short
      video for those with nothing in mind.
      _Done when:_ the end screen shows the bridge and tapping it lands in a prefilled
      Phrases import.

- [ ] **Import failure fallbacks.**
      Every YouTube/article/PDF failure state ends in PT-BR copy with a path back to the
      bundled lesson and Study — never a dead end. Hard-cap first import length (suggest clips
      under ~10 min) with a friendly explanation.
      _Done when:_ forcing each failure (bad URL, blocked video, oversized PDF, network off)
      lands on recoverable PT-BR copy.

- [ ] **Design the day-2 return moment.**
      On D+1 open: one calm, unmissable statement — "3 cards para hoje — 1 veio do seu erro de
      ontem" — leading straight into review.
      _Why:_ D+1 40% / D+7 25% are gate metrics with no designed surface behind them.
      _Done when:_ a clean install revisited the next day shows the moment with correct counts.

---

## Phase 3 — Decision Gate (end of week 3 / week 4)

Apply the decision table in [w5-validation-protocol.md](w5-validation-protocol.md)
**literally**. Do not let friendly calls override gate metrics.

- [ ] **Score the round against all 7 gates** (unaided completion 6/10, TTFR <2min,
      explain-back 7/10, D+1 40% / D+7 25%, differentiation 3/10, paid pain 3/10 same answer,
      replacement 3/10) and write the outcome into [product.md](product.md).
- [ ] **Pick the launch segment explicitly** (self-study/Anki vs. guided beginners) if one
      clearly wins — and rewrite onboarding/README narrative for it. Do not launch to a blend.
- [ ] **Record the waitlist platform mix** next to the W5 results — activation evidence and
      demand evidence together make the launch decision, not either alone.
- [ ] **Route the outcome:** - Pass → proceed to Phase 4, then Phase 5. - Activation/comprehension fail → fix the front door only; re-run 3-5 sessions. Build
      nothing new. - Differentiation fail → positioning problem: lead with the learner-memory/error-loop
      story, re-test the pitch before re-testing the product. - No replacement signal → keep as research build; do not launch broadly. - Paid pain scattered → billing stays frozen (free tool positioning for now).

---

## Phase 4 — Trust & Proof (gated on a W5 pass)

- [ ] **Record the 90-second demo video.**
      Real loop, real native audio, real own-source import. This is the trust artifact and the
      marketing artifact in one; it also goes on the landing page.
      _Done when:_ video published on the landing page.

- [ ] **Validate backup/restore with a real user's long-term data.**
      One participant with weeks of history performs export → wipe → restore, moderated.
      _Done when:_ round-trip succeeds on real data with zero loss.

- [ ] **HTTP/provider error taxonomy.**
      Typed 502/504/abort/invalid-input handling; every user-visible failure in PT-BR, never a
      raw error. (Already flagged in product.md tracker.)
      _Done when:_ forced provider timeout, abort, and bad input each show typed PT-BR copy.

- [ ] **Data transparency.**
      User can see where data is stored and delete all local data from Settings (launch
      checklist items 7-8).
      _Done when:_ both actions exist and work on a real install.

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
- [ ] **Unfreeze the tutor loop surfaces one at a time** (weakness-driven directed
      generation → adaptive plan → Converse), each behind evidence that the previous one
      moved D+30 retention.
- [ ] **Pronunciation assessment research** (docs' own P1 critique) before any speaking-first
      narrative.
- [ ] **A1 and C1-C2 band mechanisms** (graduated input + L1 scaffolding for A1;
      naturalness/register/collocation feedback for C1) before "A1-C2" appears in any public
      copy.
- [ ] **Multi-language expansion** only after the English wedge retains at D+30 — the
      pipeline is language-agnostic, the validated experience is not.

---

## Out of scope until further notice

Billing infrastructure, mobile app/sync build-out, new adaptive-difficulty research,
multi-language UI, schools/B2B, social/growth mechanics, notification framework, public
"AI teacher" positioning. (Mirrors [product.md](product.md) out-of-scope list — the
discipline is in obeying it.)
