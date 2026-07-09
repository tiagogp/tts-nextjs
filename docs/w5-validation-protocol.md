# W5 — Validation Protocol

This is the system of record for the W5 first-run validation round. The printable
materials live in [w5/](w5/); use this file to decide who to recruit, what to measure,
and when the round is strong enough to change the roadmap.

## Goal

Validate whether a fresh ICP user can complete the core learning loop, understand why it is useful,
and show a real return signal without being coached.

The loop under test is **Hear/Find -> Review -> Fix**:

```text
curated native clip -> save one phrase -> review -> write one sentence -> correct -> save correction
```

Do not explain that loop before the first run. Let the interface do the work. The roadmap is
subordinate to this round: TTFR (`first_run_started` -> `first_loop_completed`), explain-back,
unprompted differentiation, and D+1/D+7 return decide what gets built or promoted next.

## Recruiting Split

Minimum viable smoke test: **5 sessions**, biased toward the launch wedge.
Launch decision round: **10 ICP sessions**.

- At least 3 Anki / self-study users at A2-B1 who already use YouTube, articles, PDFs, or cards.
- At least 1 bundled-lessons-only beginner, to catch activation failures in the fallback path.
- Prefer 1 participant who brings a source they already care about.
- All participants need Apple Silicon macOS (M1 or later).
- All participants need to be available for D+1 and D+7 follow-up pings.

Treat 5 sessions as a smoke test only. If the signal is mixed, extend to **10 ICP sessions**
before making a major roadmap decision.

Use the round to choose the launch customer explicitly. The acceptable launch segments are:

- **Guided beginners** who need bundled lessons, structure, and little setup.
- **Serious self-study / Anki users** who bring real sources and already value review.

Do not interpret a blended result as permission to launch to both. If one segment clearly
understands, returns, and names value faster, make that segment the launch narrative.

## Materials

- [Recruiting message](w5/recruiting-message.md)
- [Consent script](w5/consent-script.md)
- [Moderator run-sheet](w5/moderator-run-sheet.md)
- [Follow-up messages](w5/followup-messages.md)
- [Capture table](w5/capture-table.md)

## Test Setup

Run each session on a clean install with no prior cards, keys, or local model state.
A clean install must clear browser storage too: the activation timer lives in
localStorage while learning data lives in IndexedDB, so wiping only one of them
desyncs the W5 readout in Settings.

Use one of two install methods:

- Moderator installs the build before timing begins.
- Participant drives a clean test Mac with the build already installed.

Never ask the participant to handle the right-click -> Open workaround. That measures
the known install problem, not activation.

## Pre-Recruiting Dry Run

Before recruiting, run one moderator dry run on a clean install and confirm:

- Home opens the recommended first lesson, not a second demo path inside Phrases.
- The user can hear a curated native clip.
- The app highlights 2-3 useful phrases.
- The user can save one phrase, enter Review, and complete one review.
- The user can write one sentence with that phrase, get it corrected, and save the correction.
- The end state can say: "You created 2 review cards: one from real English, one from your own mistake."
- Settings -> W5 validation shows `bundled_lesson` or `own_source` activation source, time to
  first review, time to first loop, and dropoff step.
- First-run copy avoids `deck`, `provider`, `APKG`, `curation`, and `model` until the loop is clear.
- Phrases import failure does not block the bundled lesson and Review path.

## Gate Metrics

Judge the **round**, not one noisy session. For launch decisions, use 10 ICP sessions.

1. **Unaided completion:** at least 6/10 complete the first loop without help.
2. **Activation:** median time to first completed loop is under 2 minutes on fresh install.
3. **Comprehension:** at least 7/10 explain PhraseLoop as "it turns real English and my
   mistakes into review cards" without being prompted.
4. **Retention:** at least 40% return D+1 and 25% return D+7.
5. **Differentiation:** at least 3/10 name native source audio, mistakes becoming drills, or
   lower-friction card creation unprompted.
6. **Paid pain:** at least 3/10 name the same thing they would pay R$19-39/month for:
   managed cloud generation, review-anywhere sync, or curated graded content. If "none" wins,
   monetization fails for this round.
7. **Replacement:** at least 3/10 say they would use PhraseLoop instead of their current
   Anki/card-making process for the next 7 days.

If activation or comprehension fails, fix the front door before building new surfaces.
If differentiation fails across the board, treat it as a positioning problem before
treating it as a feature problem.
If paid pain is scattered or weak, do not build billing.
If replacement is weak, treat PhraseLoop as a research build rather than a launch candidate.

## Session Flow

1. Read the consent script and get clear verbal consent.
2. Start from the first app screen.
3. Start the stopwatch at handover.
4. Stay silent until the participant completes the first loop or gives up.
5. Let them complete one Hear -> Review -> Fix loop unaided:
   curated clip, save phrase, review, write a sentence, correct it, save the correction.
6. Ask explain-back, differentiation, replacement, uninstall-risk, and willingness-to-pay questions.
7. Confirm D+1 and D+7 follow-up permission.

During observation, record whether the two intended differentiators are noticed without help:

- Native audio from real material.
- Personal mistakes becoming review drills.

Ask these after the unaided loop:

- "Show me how you currently turn real English into practice."
- "When did you last make a card or save a phrase? What was annoying?"
- "Would you use PhraseLoop instead of that process for the next 7 days?"
- "What would this replace, if anything?"
- "What would make you uninstall it tomorrow?"
- "What are you paying for today to learn English?"
- "Which one would you actually pay R$19-39/month for: better native audio/cards without local
  setup, mobile review with sync, curated graded content, none, or something else?"

Use the [moderator run-sheet](w5/moderator-run-sheet.md) during the call.

## Event Model

Minimum activation events:

```ts
first_run_started
clip_played
phrase_saved
review_started
review_completed
mistake_submitted
correction_saved
first_loop_completed
own_source_started
own_source_completed
day_1_returned
day_7_returned
```

Derived metrics:

```ts
activation = first_loop_completed
ttfr = first_loop_completed.ts - first_run_started.ts
dropoff_step =
  | "clip"
  | "save_phrase"
  | "review"
  | "mistake"
  | "correction"
  | "own_source"
```

`mistake_submitted` is recorded directly when the learner submits a sentence in the guided
lesson's write step, which corrects locally with no AI provider so the loop can complete on a
clean install. The guided lesson orders the loop as save -> write -> correct -> review, so the
loop counts as complete with review and correction in either order.
Current app telemetry may derive some of these names from lower-level activity events such as
`cards_created`, `cards_reviewed`, and `correction_generated`, but the W5 notes should use the
event names above.

## Follow-Up: The Retention Signal

Send D+1 about 24 hours after the session and D+7 about 7 days after the session.

If local activity data is available, log the actual return. If not, log self-report and
mark it `(self-reported)`. Do not blend these sources.

Use the exact follow-up copy in [followup-messages.md](w5/followup-messages.md).

## Capture Template: One Row Per Participant

```md
| ID | Segment | Activation source | Install method | TT saved phrase | TT first loop | Unaided loop? | Explain-back pass? | Native audio noticed? | Mistake drill noticed? | Differentiator | Differentiator source | Current workflow | 7-day replacement? | Uninstall risk | Paid today | Paid pain | D+1 return | D+1 source | D+7 return | D+7 source | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W5-01 | self-study/Anki / guided beginner | bundled_lesson / own_source | moderator-installed / clean test machine |  |  | Y/N | Y/N | Y/N | Y/N |  | unprompted / prompted / none |  | Y/N |  |  | managed-cloud / review-anywhere / curated-content / none / other | Y/N/declined | activity-log / self-reported | Y/N/declined | activity-log / self-reported |  |
```

## Decision Notes

Do not let a friendly call override the gate metrics. The useful outcomes are:

- Clear pass: preserve the front door and reopen the next roadmap surface only if D+1/D+7
  support return behavior.
- Clear fail on activation/comprehension: simplify first-run before adding features.
- Clear fail on differentiation: revisit positioning and the promise.
- Clear segment winner: make that segment the launch customer and rewrite onboarding/README for it.
- No segment winner: run 3-5 more sessions before choosing a launch audience.
- Clear paid pain: package one paid offer around that pain.
- No clear paid pain: keep monetization as research; do not build billing.
- Clear replacement signal: keep the self-study/Anki launch wedge and remove distracting first-run surfaces.
- No replacement signal: do not launch broadly; reposition or keep the build in research.
- Mixed signal: run 3-5 more sessions before deciding.
