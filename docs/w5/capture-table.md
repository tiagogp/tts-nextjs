# W5 Capture Table

One row per participant. Do not average smoke-test and decision-round results together.

| ID | Segment | Activation source | Install method | Consent | D+1 ok | D+7 ok | TT saved phrase | TT first loop | Unaided loop? | Explain-back pass? | Audio noticed? | Mistake drill noticed? | Differentiator | Differentiator source | Current workflow | Own-source started? | Own-source completed? | 7-day replacement? | Uninstall risk | Paid today | Paid pain | D+1 return | D+1 source | D+7 return | D+7 source | Dropoff step | D+30 unaided production | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W5-01 | self-study/Anki / guided beginner | bundled_lesson / own_source | moderator-installed / clean test machine | Y/N | Y/N | Y/N |  |  | Y/N | Y/N | Y/N | Y/N |  | unprompted / prompted / none |  | Y/N | Y/N | Y/N |  |  | managed-cloud / review-anywhere / curated-content / none / other | Y/N/declined | activity-log / self-reported | Y/N/declined | activity-log / self-reported | clip / save_phrase / review / mistake / correction / own_source | n/m or NN% of N |  |

## Segment Labels

Use exactly one primary segment per row:

- `self-study/Anki`
- `guided beginner`
- `own-source heavy`

## Scoring Notes

- Unaided completion passes only when all six required actions are completed before any navigation
  hint or moderator takeover. A request for help is `N`, even if the participant later finishes.
- Explain-back passes only when the participant says, without being led, that both material they
  watch/read and their own sentence or mistake become something they can practise again later.
  Product terms such as “card,” “review,” or “loop” are not required.
- Differentiator source is `unprompted` only if mentioned before the moderator names the audio,
  mistake drills, or lower-friction card creation.
- `Audio noticed?` is about the audio the participant actually heard. Every bundled lesson clip is
  generated on-device, so a participant praising "native audio" in a bundled session has been
  misled, not impressed — record what they said in Notes and score the column on whether the audio
  registered at all. A native-source claim only counts in a session that imported own material.
- Own-source completion means the participant successfully reaches saved phrases/cards from
  their own source, not merely pasting a URL.
- For paid pain, use exactly `managed-cloud`, `review-anywhere`, `curated-content`, `none`, or
  `other: short-label`. Plain `other` does not pass the paid-pain gate because Phase 3 needs the
  same concrete answer from at least 3/10 users.
- For D+1/D+7, blank, declined, and unverified answers score as `N`. Keep `(self-reported)` in the
  source column when no local activity record is available.
- Replacement is `Y` only for an unqualified commitment to replace the current workflow for seven
  days. Record conditional or “alongside it” answers verbatim in Notes and score them `N`.
- `D+30 unaided production` is not a session field. Fill it at the D+30 follow-up from the
  moderator readout (`?w5=1` → Settings → W5 validation → "D+30 unaided production"), which counts
  PT→EN cards answered with no hint, no replay and no reveal at least 7 days after the participant
  last saw them. Write `n/m` when no attempt qualifies yet — never `0%`, which claims a measurement
  that did not happen. It is the only column here that separates learning from familiarity;
  activation times and "Good" rates do not.
- After the 10-session decision round is complete, run:

```sh
yarn w5:score docs/w5/capture-table.md --waitlist path/to/waitlist-export.json --write-product docs/product.md
```

The scorer ignores the template row above, applies the 7 gates from
[w5-validation-protocol.md](../w5-validation-protocol.md), records the waitlist platform mix, and
replaces the W5 Decision Record in [product.md](../product.md).
