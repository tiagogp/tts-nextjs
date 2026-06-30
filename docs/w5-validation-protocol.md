# W5 — Validation Protocol

This is the system of record for the W5 first-run validation round. The printable
materials live in [w5/](w5/); use this file to decide who to recruit, what to measure,
and when the round is strong enough to change the roadmap.

## Goal

Validate whether a fresh user can discover the core learning loop, understand why it is
useful, and show a real return signal without being coached.

The loop under test is **Find -> Review -> Fix**:

```text
demo or Discover -> save phrases -> Study -> Correct -> practice from the mistake
```

Do not explain that loop before the first run. Let the interface do the work. The roadmap is
subordinate to this round: TTFR, explain-back, unprompted differentiation, and D+1/D+7 return
decide what gets built or promoted next.

## Recruiting Split

Minimum viable round: **5 sessions**.

- At least 2 Anki / self-study users.
- At least 2 bundled-lessons-only beginners.
- Prefer 1 participant who brings a source they already care about.
- All participants need Apple Silicon macOS (M1 or later).
- All participants need to be available for D+1 and D+7 follow-up pings.

Treat 5 sessions as a smoke test. If the signal is mixed, extend to **8-10 sessions**
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

## Test Setup

Run each session on a clean install with no prior cards, keys, or local model state.

Use one of two install methods:

- Moderator installs the build before timing begins.
- Participant drives a clean test Mac with the build already installed.

Never ask the participant to handle the right-click -> Open workaround. That measures
the known install problem, not activation.

## Gate Metrics

Judge the **round**, not one noisy session.

1. **Activation:** median time to first review (TTFR) is under 2 minutes on fresh install.
2. **Comprehension:** most participants can explain the loop without using internal terms
   like AI, Anki, provider, deck, or model.
3. **Retention:** D+1 and D+7 capture real return behavior where possible.
4. **Differentiation:** at least one participant names a concrete differentiator
   unprompted.
5. **Paid pain:** participants can name one specific thing they would pay for, if any:
   managed cloud generation, review-anywhere sync, or curated graded content.

If activation or comprehension fails, fix the front door before building new surfaces.
If differentiation fails across the board, treat it as a positioning problem before
treating it as a feature problem.
If paid pain is scattered or weak, do not build billing.

## Session Flow

1. Read the consent script and get clear verbal consent.
2. Start from the first app screen.
3. Start the stopwatch at handover.
4. Stay silent until the participant reaches the first review or gives up.
5. Let them complete one Find -> Review -> Fix loop unaided.
6. Ask explain-back, differentiation, and replacement / willingness-to-pay questions.
7. Confirm D+1 and D+7 follow-up permission.

During observation, record whether the two intended differentiators are noticed without help:

- Native audio from real material.
- Personal mistakes becoming review drills.

Use the [moderator run-sheet](w5/moderator-run-sheet.md) during the call.

## Follow-Up: The Retention Signal

Send D+1 about 24 hours after the session and D+7 about 7 days after the session.

If local activity data is available, log the actual return. If not, log self-report and
mark it `(self-reported)`. Do not blend these sources.

Use the exact follow-up copy in [followup-messages.md](w5/followup-messages.md).

## Capture Template: One Row Per Participant

```md
| ID | Segment | Install method | TT saved phrase | TT first review | Explain-back pass? | Native audio noticed? | Mistake drill noticed? | Differentiator | Differentiator source | Keep using? | Paid pain | D+1 return | D+1 source | D+7 return | D+7 source | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W5-01 | anki / own-source / bundled-only | moderator-installed / clean test machine |  |  | Y/N | Y/N | Y/N |  | unprompted / prompted / none |  | managed-cloud / review-anywhere / curated-content / none / other | Y/N/declined | activity-log / self-reported | Y/N/declined | activity-log / self-reported |  |
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
- Mixed signal: run 3-5 more sessions before deciding.
