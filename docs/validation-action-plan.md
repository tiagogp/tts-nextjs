# Validation Action Plan

This plan keeps product work subordinate to the W5 decision gate in
[w5-validation-protocol.md](w5-validation-protocol.md).

## Phase 0 — freeze and prepare

Status: active until the ten-session W5 round passes or fails.

Only crash fixes are allowed on Speak/Converse, the 90-day Plan, adaptive-band research, the theme
generator, AnkiConnect, and per-task provider overrides. The exact path-level freeze is maintained
in [`AGENTS.md`](../AGENTS.md).

Normal work remains open on the validation wedge and the infrastructure it requires:

- the guided first-run lesson;
- Discover -> Study -> Correct;
- activation/drop-off and W5 moderator instrumentation;
- PT-BR copy and accessibility on the first-run route;
- local persistence, backup/restore, and plain `.apkg` export;
- crash fixes anywhere.

Exit when the capture table has ten complete ICP rows, D+1/D+7 follow-ups have been resolved or
explicitly declined, and `yarn w5:score` has written the decision record.

## Phase 1 — fix only the observed wedge

Use the scored rows and verbatim observations to choose the smallest next cycle:

- If unaided completion or time-to-value fails, fix the first blocking step before adding scope.
- If explain-back fails, revise the visible story and terminology using participant language.
- If correction/retry fails, improve feedback quality without making provider setup a first-run
  requirement.
- If D+1/D+7 fails, test the return moment and review handoff before adaptive research.
- If differentiation or replacement fails, revisit the wedge before billing or launch expansion.

Do not average smoke tests into the decision round and do not treat predicted SRS retention as
observed user retention.

## Later phases

Reopen frozen surfaces only after Phase 1 has an evidence-backed route. Billing needs one repeated
paid pain; broad curriculum production follows the gates in
[100-lesson-roadmap.md](100-lesson-roadmap.md); platform expansion follows the observed waitlist and
W5 device evidence.
