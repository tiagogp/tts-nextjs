# Learning-efficacy experiment

Status: protocol ready; recruitment and longitudinal data collection have not started.

## Claim under test

For Brazilian A2-B1 independent learners who already use real English content, PhraseLoop
improves delayed, unaided English production and cross-context transfer more than an
activity-matched recognition-card workflow.

## Design

- Randomized, parallel, 12-week study plus a 4-week no-training follow-up.
- Target: 60 completers (30 per arm); recruit 76 to allow about 20% attrition.
- Stratify randomization by A2/B1, prior Anki use, and baseline production score.
- PhraseLoop arm: the complete guided loop, productive cards, FSRS, evaluated transfer.
- Active control: the same source phrases, audio exposure, session budget, and reminders,
  but English-front recognition cards and no feedback/retry loop.
- Evaluators receive anonymized answers and remain blind to arm and measurement occasion.

## Outcomes

Primary outcome: proportion of predeclared target meanings produced acceptably in English at
D30, before any answer or scaffold is shown, on prompts not seen since the preceding test.

Secondary outcomes:

- D7 and D60 observed production.
- Near transfer: new situation, same target pattern.
- Cold transfer: new topic and prompt wording, with no displayed model phrase.
- Novel listening comprehension using held-out human recordings and speakers absent from
  training; score main idea and details separately.
- Error rate per elicited opportunity for each predeclared pattern.
- Four-week maintenance after training stops.
- Time on task, attrition, and scaffold use as process measures, never learning outcomes.

## Measurement contract

- Capture the response and latency before reveal.
- `responseCorrect` is evaluator/local-check evidence, not a self grade.
- Report D7 at 5-10 days, D30 at 24-38 days, and D60 at 50-75 days.
- A transfer success requires `evaluated !== false`, task completion, and no blocking issue.
- Count errors over elicited opportunities, not raw error totals.
- CEFR is measured only by a separate standardized assessment; in-app activity cannot raise it.

## Analysis

- Intention-to-treat is primary; multiple imputation and complete-case analyses are sensitivity
  checks.
- Compare D30 proportions with a mixed-effects logistic model (participant and item random
  intercepts; arm, baseline, level, and prior Anki use fixed effects).
- Publish absolute difference, odds ratio, 95% confidence interval, and item/participant counts.
- Control false discovery rate across secondary outcomes. Do not replace missing D30 evidence
  with FSRS predictions or self grades.

## Decision rules

- Continue the learning claim only if the D30 interval excludes zero in PhraseLoop's favor and
  no serious usability harm appears.
- Revise the method if D7 improves but D30/D60 or cold transfer does not.
- Treat better retention with materially higher time-on-task as inconclusive until efficiency
  is tested.
- Remove level/proficiency language if the standardized assessment does not corroborate it.

## Execution checklist

1. Freeze protocol and analysis before viewing outcomes.
2. Obtain consent and a data-retention policy for recordings/transcripts.
3. Prepare held-out human audio and an item bank with parallel forms.
4. Run a five-person instrumentation pilot; do not include it in the confirmatory sample.
5. Register randomization, exclusions, and analysis code.
6. Recruit, run 12 weeks, complete D60/follow-up, then analyze.

