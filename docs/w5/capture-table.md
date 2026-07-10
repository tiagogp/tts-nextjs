# W5 Capture Table

One row per participant. Do not average smoke-test and decision-round results together.

| ID | Segment | Activation source | Install method | Consent | D+1 ok | D+7 ok | TT saved phrase | TT first loop | Unaided loop? | Explain-back pass? | Native audio noticed? | Mistake drill noticed? | Differentiator | Differentiator source | Current workflow | Own-source started? | Own-source completed? | 7-day replacement? | Uninstall risk | Paid today | Paid pain | D+1 return | D+1 source | D+7 return | D+7 source | Dropoff step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W5-01 | self-study/Anki / guided beginner | bundled_lesson / own_source | moderator-installed / clean test machine | Y/N | Y/N | Y/N |  |  | Y/N | Y/N | Y/N | Y/N |  | unprompted / prompted / none |  | Y/N | Y/N | Y/N |  |  | managed-cloud / review-anywhere / curated-content / none / other | Y/N/declined | activity-log / self-reported | Y/N/declined | activity-log / self-reported | clip / save_phrase / review / mistake / correction / own_source |  |

## Segment Labels

Use exactly one primary segment per row:

- `self-study/Anki`
- `guided beginner`
- `own-source heavy`

## Scoring Notes

- Explain-back passes only when the participant says, without being led, that PhraseLoop turns
  real English and/or their mistakes into review practice.
- Differentiator source is `unprompted` only if mentioned before the moderator names native
  audio, mistake drills, or lower-friction card creation.
- Own-source completion means the participant successfully reaches saved phrases/cards from
  their own source, not merely pasting a URL.
- For paid pain, use exactly `managed-cloud`, `review-anywhere`, `curated-content`, `none`, or
  `other: short-label`. Plain `other` does not pass the paid-pain gate because Phase 3 needs the
  same concrete answer from at least 3/10 users.
- After the 10-session decision round is complete, run:

```sh
yarn w5:score docs/w5/capture-table.md --waitlist path/to/waitlist-export.json --write-product docs/product.md
```

The scorer ignores the template row above, applies the 7 gates from
[w5-validation-protocol.md](../w5-validation-protocol.md), records the waitlist platform mix, and
replaces the W5 Decision Record in [product.md](../product.md).
