# PhraseLoop Roadmap to 100 Lessons

Status: pre-production foundation implemented; lesson production remains subordinate to the W5
decision gate in [product.md](product.md).

## Outcome

Grow the bundled English curriculum from **36 lessons / 292 phrases** to **100 lessons / about
804 phrases**, while keeping the launch focus on Brazilian A2-B1 self-learners and preserving the
input-to-output loop:

```text
Learn five targets -> hear two clips -> answer for meaning -> notice useful language ->
produce -> receive focused feedback -> retry -> review
```

The goal is not lesson count by itself. A lesson counts only when its language, listening,
production, feedback, retry, review, PT-BR copy, and audio assets pass the definition of done below.

## Current baseline

| Level | Current lessons | Current role |
| --- | ---: | --- |
| A1 | 9 | Zero-setup support for guided beginners |
| A2 | 8 | Lower half of the launch ICP |
| B1 | 8 | Upper half of the launch ICP |
| B2 | 5 | Post-ICP progression and professional depth |
| C1 | 3 | Advanced precision and workplace depth |
| C2 | 3 | Advanced synthesis and rhetorical control |
| **Total** | **36** | **292 bundled phrases** |

The current source of truth is
[`src/features/learn/lessons.json`](../src/features/learn/lessons.json). Lesson selection already
prefers unfinished content at the learner's level, so new data-driven lessons enter progression
without extending the frozen 90-day Plan surface.

## Target distribution

The final distribution deliberately puts **47 lessons at A2-B1**, the current launch segment,
while retaining a complete path from A1 through C2.

| Level | Current | Target | Add | Final share |
| --- | ---: | ---: | ---: | ---: |
| A1 | 9 | 15 | 6 | 15% |
| A2 | 8 | 22 | 14 | 22% |
| B1 | 8 | 25 | 17 | 25% |
| B2 | 5 | 18 | 13 | 18% |
| C1 | 3 | 12 | 9 | 12% |
| C2 | 3 | 8 | 5 | 8% |
| **Total** | **36** | **100** | **64** | **100%** |

## Release gates and waves

### Gate 0 — validate the current wedge (36 lessons)

Do not mass-produce the remaining curriculum before W5 resolves the launch route.

- Run the 10-session W5 round and record the decision in `docs/product.md`.
- Verify that bundled audio is present, decodes cleanly, and is understandable in the first A1,
  A2, and B1 lessons; synthetic audio is acceptable.
- Confirm that the expanded Learn/Listen steps do not push median first-loop time beyond the W5
  threshold.
- Use participant explain-backs to revise lesson terminology before applying it to 64 more lessons.

Exit gate: W5 has a recorded pass/fail and a clear segment route. If W5 fails, fix the first loop
before producing Wave 1.

### Wave 1 — ICP core (36 -> 50)

Add 14 lessons: **A2 +6, B1 +8**.

Purpose: close the most obvious real-world gaps for the launch user—work, travel friction,
clarification, messages, and personal routines.

Exit gate: three content batches pass technical QA; at least one moderated A2 group and one B1
group complete the new lessons without coaching.

### Wave 2 — everyday breadth (50 -> 70)

Add 20 lessons: **A1 +4, A2 +5, B1 +6, B2 +5**.

Purpose: make the library useful for sustained daily study rather than only first-run activation.

Exit gate: no level has a major communicative-function gap in the A1-B2 coverage matrix, and the
review queue remains manageable after a five-lesson sample path.

### Wave 3 — bridge to independence (70 -> 85)

Add 15 lessons: **A1 +2, A2 +3, B1 +3, B2 +4, C1 +3**.

Purpose: complete beginner coverage, deepen independent conversation, and establish the B2-C1
bridge.

Exit gate: level progression and content ordering are validated with real review histories; the
learner is not advanced merely for completing lessons.

### Wave 4 — advanced depth (85 -> 100)

Add 15 lessons: **B2 +4, C1 +6, C2 +5**.

Purpose: complete the professional, analytical, and rhetorical ladder after the launch wedge is
proven.

Exit gate: all 100 lessons pass the definition of done, native-audio provenance is recorded, and
the final coverage audit has no duplicate lesson purpose.

## Exact 64-lesson backlog

### A1 — add 6 (9 -> 15)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 2 | `a1-classroom` | Classroom objects and simple instructions |
| 2 | `a1-time-dates` | Clock time, days, dates, and schedules |
| 2 | `a1-likes` | Likes, dislikes, and simple reasons |
| 2 | `a1-abilities` | What I can and cannot do |
| 3 | `a1-errands` | Simple errands and everyday requests |
| 3 | `a1-feelings` | Feelings, preferences, and immediate needs |

### A2 — add 14 (8 -> 22)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 1 | `a2-cooking` | Ingredients, quantities, and cooking instructions |
| 1 | `a2-hobbies` | Free-time activities and frequency |
| 1 | `a2-hotel` | Checking in, room needs, and simple complaints |
| 1 | `a2-airport` | Check-in, security, gates, and delays |
| 1 | `a2-appointments` | Booking and changing appointments |
| 1 | `a2-clarification` | Asking someone to repeat, slow down, or explain |
| 2 | `a2-responsibilities` | Chores, responsibilities, and routine obligations |
| 2 | `a2-technology` | Devices, messages, passwords, and basic problems |
| 2 | `a2-comparisons` | Comparing people, places, and products |
| 2 | `a2-childhood` | Childhood routines and simple memories |
| 2 | `a2-obligations` | Rules with have to, must, and can |
| 3 | `a2-home-problems` | Repairs and common problems at home |
| 3 | `a2-celebrations` | Invitations, birthdays, and celebrations |
| 3 | `a2-social-plans` | Hosting, joining, confirming, and declining social events |

### B1 — add 17 (8 -> 25)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 1 | `b1-job-interviews` | Experience, strengths, and interview follow-ups |
| 1 | `b1-work-meetings` | Updates, questions, and action items |
| 1 | `b1-email-messages` | Clear professional email and chat tone |
| 1 | `b1-travel-problems` | Missed connections, lost items, and alternatives |
| 1 | `b1-personal-finance` | Budgets, bills, saving, and everyday money decisions |
| 1 | `b1-storytelling` | Sequencing and adding detail to personal stories |
| 1 | `b1-recommendations` | Reviews, recommendations, and supporting reasons |
| 1 | `b1-apologies` | Apologizing, taking responsibility, and repairing a situation |
| 2 | `b1-reasons-examples` | Explaining a point with reasons and examples |
| 2 | `b1-news-media` | Summarizing news and distinguishing fact from opinion |
| 2 | `b1-health-fitness` | Exercise, wellbeing, and sustainable routines |
| 2 | `b1-habits-change` | Describing change, setbacks, and progress |
| 2 | `b1-processes` | Explaining how a familiar process works |
| 2 | `b1-goals-progress` | Setting goals and reflecting on progress |
| 3 | `b1-cultural-differences` | Comparing customs without overgeneralizing |
| 3 | `b1-community-services` | Public services, local issues, and asking for support |
| 3 | `b1-relationships-boundaries` | Expectations, boundaries, and respectful disagreement |

### B2 — add 13 (5 -> 18)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 2 | `b2-cause-effect` | Explaining causes, consequences, and contributing factors |
| 2 | `b2-persuasion` | Persuading without overstating a claim |
| 2 | `b2-project-management` | Scope, deadlines, dependencies, and risks |
| 2 | `b2-feedback-leadership` | Giving balanced feedback and setting expectations |
| 2 | `b2-data-interpretation` | Interpreting charts, changes, and uncertainty |
| 3 | `b2-ethical-dilemmas` | Weighing principles and practical consequences |
| 3 | `b2-remote-work` | Collaboration, autonomy, and communication trade-offs |
| 3 | `b2-media-bias` | Framing, evidence selection, and source reliability |
| 3 | `b2-uncertainty` | Speculation, probability, and calibrated confidence |
| 4 | `b2-proposals` | Presenting and defending a structured proposal |
| 4 | `b2-professional-disagreement` | Disagreeing clearly while preserving cooperation |
| 4 | `b2-root-causes` | Diagnosing problems beyond immediate symptoms |
| 4 | `b2-competing-views` | Summarizing and comparing competing positions |

### C1 — add 9 (3 -> 12)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 3 | `c1-diplomatic-disagreement` | Challenging assumptions with diplomatic precision |
| 3 | `c1-presentations-q-and-a` | Handling difficult questions after a presentation |
| 3 | `c1-stakeholders` | Aligning stakeholders with conflicting priorities |
| 4 | `c1-crisis-communication` | Communicating uncertainty and action under pressure |
| 4 | `c1-policy-analysis` | Evaluating policy aims, mechanisms, and side effects |
| 4 | `c1-research-discussion` | Discussing evidence, limitations, and implications |
| 4 | `c1-mentoring` | Coaching, reframing, and asking productive questions |
| 4 | `c1-strategic-priorities` | Distinguishing urgent work from strategically important work |
| 4 | `c1-nuanced-narratives` | Telling complex stories with shifts in stance and perspective |

### C2 — add 5 (3 -> 8)

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 4 | `c2-implicit-assumptions` | Exposing assumptions and expressing epistemic caution |
| 4 | `c2-analogy-metaphor` | Using and critiquing analogy, metaphor, and framing |
| 4 | `c2-high-stakes-negotiation` | Strategic ambiguity and precise concessions |
| 4 | `c2-editorial-argument` | Building a concise, rhetorically controlled editorial argument |
| 4 | `c2-debate-synthesis` | Synthesizing dense debate without flattening disagreement |

## Lesson definition of done

Starting with Wave 1, each lesson must include the following.

### Content

- One communicative objective and one real-world situation.
- At least eight useful target phrases; five are introduced explicitly in Learn.
- PT-BR translation, reusable concept/pattern, and usage note for every phrase.
- One short dialogue or monologue containing the target language plus limited unfamiliar language.
- One main-idea question and at least two detail/meaning checks before transcript reveal.
- One original production prompt appropriate to the CEFR level.
- A feedback/retry path that accepts legitimate personalization rather than literal model copying.
- Review cards grounded in the same language used during Learn and Listen.

### Audio

- Release audio recorded or licensed from proficient speakers; Kokoro remains a development
  fallback, never a claim of native-source audio.
- Clip text and audio match exactly.
- Natural but level-appropriate delivery; do not make every A1/A2 clip artificially slow.
- Speaker diversity across each five-lesson batch.
- Provenance, speaker consent/license, recording date, and normalization status recorded in the
  native-audio manifest.

### Pedagogy and language quality

- Phrase usefulness and frequency reviewed by a proficient English editor.
- PT-BR translations reviewed for meaning, register, and Brazilian usage.
- CEFR difficulty reviewed for vocabulary load, syntax, speech rate, and production demand.
- No duplicate communicative purpose within the same level.
- Feedback prioritizes communication and lesson language before mechanics.
- Failure to understand every word is never presented as failure.

### Technical acceptance

- Unique lesson, phrase, card, and audio identifiers.
- Every referenced clip exists and passes audio decode validation.
- Listening options contain one unambiguous answer and distinct distractors.
- Lesson progression still selects unfinished content at the learner's level.
- PT-BR strings exist for titles, topics, instructions, and feedback.
- Unit tests, full Vitest suite, TypeScript, lint, production build, and `graphify update .` pass.

## Required content-model evolution

The existing `Lesson` shape contains `id`, `level`, `title`, `topic`, and `phrases`. Before Wave 1,
extend it with optional data-driven fields, then make them mandatory for new lessons:

```ts
interface LessonMaterial {
  objective: string;
  pronunciationFocus?: string;
  dialogue: Array<{ speaker: string; en: string; pt: string; clip: string }>;
  comprehension: Array<{
    kind: "mainIdea" | "detail" | "sequence";
    prompt: string;
    options: string[];
    answer: string;
  }>;
  productionPrompt: string;
  retryHint: string;
}
```

Keep backward-compatible fallbacks until the original 36 lessons are migrated. This work belongs
to the guided Learn/Listen loop, not `src/features/plan/`; the 90-day Plan stays frozen until W5.

## Production workflow

Produce the 64 lessons in **13 batches**: twelve batches of five and one batch of four.

1. **Coverage brief:** confirm the lesson fills a real matrix gap and does not duplicate an
   existing lesson.
2. **Language draft:** write objective, phrases, dialogue, questions, production prompt, and retry
   support together so they form one loop.
3. **English review:** check naturalness, usefulness, CEFR load, and distractor ambiguity.
4. **PT-BR review:** check translation, UI copy, and culturally natural examples.
5. **Audio session:** record full dialogue and phrase clips; store provenance and licenses.
6. **Integration:** add lesson data, translations, audio, and stable identifiers.
7. **Automated QA:** run schema, duplicate, audio, test, type, lint, and build checks.
8. **Learner pilot:** observe completion, comprehension, production, retry, and review behavior.
9. **Batch decision:** ship, revise, or remove; do not carry known ambiguity into the next batch.

## Measurement and batch gates

Use these as provisional content-quality gates and recalibrate them after the first two Wave 1
batches.

| Signal | Why it matters | Initial gate |
| --- | --- | --- |
| Lesson completion | Detects length, clarity, and technical friction | >= 80% of starts |
| First-attempt listening accuracy | Detects clips that are trivial or inaccessible | 35-85% |
| Retry completion | Confirms feedback is actually applied | >= 70% after feedback |
| Phrase saved rate | Shows whether the content feels useful | >= 2 phrases per completed lesson |
| Next-review return | Connects lesson consumption to the real habit | Measured at D+1 and D+7 |
| Clip/text mismatch | Basic trust requirement | 0 known mismatches |
| Unambiguous question review | Prevents false failure | 100% editor-approved |

Do not use lesson completion alone as evidence of learning. Review outcomes, corrected mistakes,
reuse in original production, and later listening recognition remain the meaningful signals.

## Automation backlog

Complete these before production exceeds five lessons per batch:

- [x] Add a lesson schema validator for objectives, phrase counts, dialogue, comprehension, and prompts.
- [x] Detect duplicate English phrases and near-duplicate lesson purposes across levels.
- [x] Verify audio duration, decodability, silence, clipping, and declared provenance.
- [x] Generate a coverage report by CEFR level, communicative function, grammar pattern, and domain.
- [x] Add deterministic tests ensuring all comprehension questions have exactly one answer.
- [x] Add a content manifest that reports synthetic versus native audio coverage per lesson.
- [x] Add a roadmap check that derives current counts from `lessons.json` rather than maintaining a
  second hand-edited count.

Run `yarn learn:content:validate` for the release gate or `yarn learn:content:report` for the JSON
coverage/provenance manifest. Roadmap lesson ids are parsed from this document, so every one of the
64 additions must include the expanded material fields before it can pass validation.

## Progress ledger

| Milestone | Lessons | Added | Status |
| --- | ---: | ---: | --- |
| Baseline | 36 | — | Complete in working tree |
| W5 gate | 36 | 0 | Pending decision round |
| Wave 1 | 50 | 14 | Not started |
| Wave 2 | 70 | 20 | Not started |
| Wave 3 | 85 | 15 | Not started |
| Wave 4 | 100 | 15 | Not started |

Update this ledger only when lessons meet the definition of done; drafts and synthetic-only release
assets do not count as shipped lessons.
