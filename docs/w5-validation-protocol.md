# W5 Validation Protocol

Status: ready to run; decision round is **0/10 complete sessions**.

W5 is a moderated evidence gate, not a product milestone that can be closed from telemetry alone.
Do not change the decision record in [product.md](product.md) until ten complete ICP rows have been
captured and scored.

## Decision cohort

- Ten Brazilian A2-B1 self-learners who already use, or have tried, Anki/flashcards and consume
  real English content.
- macOS 14+ on Apple Silicon for this round.
- Fresh local data for each session; smoke tests and team members do not count.
- The participant must consent to the session and to D+1/D+7 follow-up.

Recruit and prepare participants with the materials in [`docs/w5/`](w5/). Use one row in
[`capture-table.md`](w5/capture-table.md) per participant.

## Unaided task

Hand over the app at its first screen and give no navigation instructions. The required loop is:

```text
play curated clip -> save at least one chosen phrase -> complete one review ->
write a sentence -> receive correction -> submit a clear retry -> save it
```

The order of review and correction may vary in the interface, but both must be complete. Starting
an own-source import, pronunciation practice, or another surface does not complete the loop.

Mark `Unaided loop?` as `N` as soon as the participant asks where to click or receives navigation
help. A neutral reminder to think aloud is allowed.

## Timing and instrumentation

- Start the moderator stopwatch at handover.
- Use Settings -> W5 validation (`?w5=1`) as the local activity-log readout.
- `TT first loop` runs from `first_run_started` until both a saved correction and a completed
  review exist for that first run.
- Record the first missing step shown by the readout. Telemetry can establish actions and timing;
  it cannot establish that the run was unaided.
- Retention is a return on local-calendar D+1 and on or after D+7. Record whether each result came
  from the activity log or self-report.

## Explain-back

After the task, ask: “Me explica com suas palavras para que serve o PhraseLoop.” Do not name the
features first. Pass only when the participant independently communicates both ideas:

1. English from something they watch or read becomes future practice.
2. Their own sentence or mistake also becomes future practice.

The words “card,” “review,” and “loop” are not required. This result is moderator-scored and must
not be inferred from clicks.

Continue with the questions in [`moderator-run-sheet.md`](w5/moderator-run-sheet.md), including
unprompted differentiation, current replacement workflow, seven-day replacement intent, and paid
pain.

## Decision gates

| Gate | Pass threshold |
| --- | --- |
| Unaided completion | at least 6/10 |
| Median time to first complete loop | under 2 minutes |
| Explain-back | at least 7/10 |
| Retention | D+1 at least 40% and D+7 at least 25% |
| Unprompted differentiation | at least 3/10 |
| Same concrete paid pain | at least 3/10; `none` cannot pass |
| Seven-day workflow replacement | at least 3/10 |

After all ten rows and follow-ups are complete, run:

```sh
yarn w5:score docs/w5/capture-table.md --waitlist path/to/waitlist-export.json --write-product docs/product.md
```

Archive the scored table with the research notes. A failed gate routes the next product cycle; it
does not permit editing the observations after the fact.
