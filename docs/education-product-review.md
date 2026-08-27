# PhraseLoop — Product & Educational Review

Scope: the whole app as it exists on `chore/finish-honest-gaps-firstrun-w5` — architecture, screens,
learning flow, exercises, LLM prompts, and the 100-lesson bundle. Every claim below is checked
against code or content, with file references. This document is a proposal; it changes nothing.

Related canonical docs: [README.md](../README.md), [docs/product.md](product.md),
[docs/adversarial-audit.md](adversarial-audit.md). Where the July 2026 adversarial audit found
something and the fix shipped, this review says so instead of re-litigating it.

---

## 1. Executive summary

PhraseLoop is much further along pedagogically than a review of this kind usually finds. The
learning-model layer — evidence-gated progression, prioritized feedback, bidirectional cards, a
deliberately hard outcome metric, a working no-LLM path — is better than almost anything in the
consumer market, and several things this review was asked to propose (feedback prioritization,
practical placement, anti-gamification guardrails) **already exist in code**.

The gap is no longer "build the learning engine". It is that **the engine is more advanced than the
content and the task design it runs on**. Three findings dominate:

1. **The first lesson every B1, B2, C1 and C2 learner sees is one of the 19 unfinished ones.**
   `nextLessonFor()` picks the first uncompleted lesson at the learner's level in file order
   ([lessonDeck.ts:154-176](../src/features/learn/lessonDeck.ts#L154-L176)), and the first B1 entry
   in `lessons.json` is `b1-opinions` — no `objective`, no `dialogue`, no `comprehension`, no
   `productionPrompt`, no `pronunciationFocus`. Same for `b2-arguments`, `c1-nuance`,
   `c2-precision`. A2 and A1 learners get complete lessons; everyone above B1 gets the weakest
   content in the bundle as their first impression. This is a content-ordering defect with a
   one-line-plus-authoring fix and the highest impact of anything here.

2. **The AI never sees the task.** `buildCorrectRequest()`
   ([shared.ts](../src/lib/cards/shared.ts)) receives `(text, learnerLang, targetLang, level)` — not
   the lesson's `productionPrompt`. So the model grades sentences, not communication. A learner who
   answers "What is your main strength?" with a flawless sentence about their weekend gets "no
   errors found". The request's requirement that feedback judge *whether the learner communicated
   the intended meaning* is structurally impossible today. The sharpest version of this: at
   [MistakeStep.tsx:196](../src/features/learn/components/MistakeStep.tsx#L196) the lesson's
   `productionPrompt` is in scope and is written into the telemetry event — then
   `evaluateCorrectionText()` is called without it. The task is logged for analytics and withheld
   from the tutor.

3. **The listening ladder promises input the audio bank cannot deliver.**
   `supportForProgression()` ([progression.ts:365-395](../src/features/method/progression.ts#L365-L395))
   escalates to `connectedSpeech: true`, `speakerFamiliarity: "unfamiliar"`, `playbackRate: 1.2`.
   All 1,268 clips are Kokoro TTS at a fixed per-level WPM
   ([generate-learn-audio.mjs:89](../scripts/generate-learn-audio.mjs#L89)). Speeding up clean
   synthetic speech by 20% is not connected speech, and one TTS engine is not accent variation. The
   top two listening stages are currently unreachable in substance.

Everything else is ranked below these.

---

## 2. Current product strengths

These are real and should be protected in any refactor.

| Strength | Evidence |
| --- | --- |
| **Evidence-gated progression, not level-by-completion** | [progression.ts](../src/features/method/progression.ts) — three independent ladders (listening 5 stages, speaking 6, reading/writing 4), promotion requires `minSamples` + `minScore`, and regression restores scaffolding at score < 45. Scaffolding withdrawal is concrete: playback 0.8→1.2, monologue 15s→300s, conversation turns 4→12, follow-up depth `single`→`layered`→`counterpoint`. |
| **Feedback prioritization already implemented** | [feedbackContract.ts](../src/features/correct/feedbackContract.ts) — 7 learner-facing categories, `communicationImpact` weighting, recurrence weighting (×4), `focusFeedback(limit = 2)`. The request's section 6 is ~70% shipped. |
| **An honest outcome metric** | [outcomeMetrics.ts](../src/features/activation/outcomeMetrics.ts) — D+30 unaided production: production direction only, no hint, no scaffold, ≥7 days rest, `Hard` counts as attempt not success, returns `null` (not 0) when unmeasured. This is a better metric than most funded ed-tech ships. |
| **Bidirectional cards, production-first** | [lessonDeck.ts:90-118](../src/features/learn/lessonDeck.ts#L90-L118) — PT→EN and EN→PT scheduled independently by FSRS, with the comment explaining exactly why recognition-only decks lie. Fixes audit §2.1. |
| **A genuine no-LLM path** | [localCorrection.ts](../src/features/learn/localCorrection.ts) + [transferErrors.ts](../src/features/learn/transferErrors.ts) — deterministic PT→EN transfer-error detection (article omission, *I have 30 years*, *depend of*, *people is*, present-with-*since*), plus [placement.ts](../src/features/levelup/placement.ts), which returns `"insufficient"` rather than guessing and excludes self-assessed writing from the level estimate. |
| **Self-critical content code** | [lessonFlow.ts:29-34](../src/features/learn/lessonFlow.ts#L29-L34) labels synthesized listening checks as recall checks and forbids counting them as listening accuracy; `placeAnswer` re-randomizes option position per attempt so "always pick the top option" fails. |
| **Grounding on generated content** | `isTextGrounded()` in [shared.ts](../src/lib/cards/shared.ts) — 70% word-overlap check that a mined phrase actually appears in its claimed segment, plus a critique pass that drops ungrounded cards. |
| **Anti-gamification written into the contract** | [CONTRIBUTING.md](../CONTRIBUTING.md): "Do not add XP, coins, badges, loss-framed streaks, or notification pressure without a written learning hypothesis." |
| **Audio provenance is honest** | Every clip records `provenance: "Kokoro local synthesis; not native input"`, per-role voices are validated distinct, and README states the bundled audio is not native. |

---

## 3. Main product weaknesses

**W1 — Surface sprawl contradicts the one-loop promise.** Five tabs
([homeTabs.ts](../src/components/app/homeTabs.ts)) plus Settings, Plan, C1 diagnosis, Speech/TTS,
Anki export, level test, placement, Discover. There are **two onboardings**
([OnboardingDialog](../src/features/settings/components/OnboardingDialog.tsx),
[PlanOnboarding](../src/features/plan/components/PlanOnboarding.tsx)), **two placement systems**
(local `placement.ts`, LLM `testModel.ts`), **two feedback surfaces** (`CorrectTab`,
`MistakeStep`), and **two plan sources** (`defaultPlans` from `a1-b1.json`/`b2-c1.json`, and the LLM
generator). Progressive disclosure via `useUnlockedTabs` mitigates the first session but not the
tenth.

**W2 — Onboarding under-collects.** It asks native language, level (with an optional 5-min local
check — good), and one goal. It does not ask available time per session, self-rated weak skill,
comfort speaking aloud, or whether the learner needs interview/professional English. `objective`
then drives a *time-distribution* target (`TARGETS` in
[learningLoop.ts](../src/features/method/learningLoop.ts)) but never changes *which* lessons are
selected — `nextLessonFor()` filters on level only.

**W3 — The plan prompt is the weakest LLM call in the codebase.**
[plan/prompts.ts](../src/features/plan/prompts.ts) asks for 90 days × 1–3 tasks in a single JSON
response, passes `currentLevel`/`targetLevel` as bare strings with **no `cefrLanguageLine()`
anchoring** (unlike [levelup/prompts.ts](../src/features/levelup/prompts.ts), which does it
correctly), and constrains instructions by character count. It generates a schedule, not a
curriculum.

**W4 — `readWrite` is a task type with no home.** It exists in the plan schema, `objectivePolicy`,
and `transfer.ts` (`reading_to_meaning`), but `TodayPlanCard` routes it to the **Correct** tab, and
the longest thing a learner ever reads is one sentence. Reading is effectively absent.

**W5 — Pronunciation is intelligibility, labelled as pronunciation.**
[scoring.ts](../src/lib/pronunciation/scoring.ts) is Whisper transcript alignment with
Levenshtein + a two-rule `simpleSoundKey` (`ue`/`ew` only). It detects *word substitution*, not
phoneme or stress accuracy. Meanwhile every authored `pronunciationFocus` is about **stress and
intonation** ("Use a firm fall for verified facts…", "HEL-lo, good MOR-ning") — which nothing
measures.

**W6 — Progress is skill bars without trend.** `ProgressOverview` shows current scores and
milestones. The excellent `computeUnaidedProduction` exists but there is no
before/after-a-unit comparison, no listening-accuracy trend, no speaking-duration trend, and no
"errors you stopped making" view — despite `recurrenceCounts()` making the last one nearly free.

**W7 — Documentation drift inside code.**
[speakingDrill.ts:33-37](../src/features/pronunciation/speakingDrill.ts#L33-L37) states "only 64 of
the 100 lessons have [a productionPrompt]" and that `a1-greetings` is not among them. Both are now
false (81 lessons have one; `a1-greetings` has one). Small, but this is a codebase whose comments
are load-bearing.

---

## 4. Main educational weaknesses

**E1 — Two-tier content.** 81 of 100 lessons carry `objective`, `dialogue`, `comprehension`,
`productionPrompt`, `retryHint`, `pronunciationFocus`. **19 carry none of it** — and they are
disproportionately the upper bands:

| Level | Complete | Bare phrase list |
| --- | ---: | ---: |
| A1 | 15 | 0 |
| A2 | 22 | 0 |
| B1 | 17 | 8 |
| B2 | 13 | 5 |
| C1 | 9 | 3 |
| C2 | 5 | 3 |

(A further 5 lessons — all C2: `c2-implicit-assumptions`, `c2-analogy-metaphor`,
`c2-high-stakes-negotiation`, `c2-editorial-argument`, `c2-debate-synthesis` — are complete except
that they carry no `pronunciationFocus`, so 76/100 lessons are fully populated.)

The 19: `b1-opinions`, `b1-experiences`, `b1-future`, `b1-work`, `b1-problems`, `b1-phone`,
`b1-everyday-demo`, `b1-learning-habits`, `b2-arguments`, `b2-conditionals`, `b2-negotiation`,
`b2-trends`, `b2-decisions`, `c1-nuance`, `c1-register`, `c1-leading-meetings`, `c2-precision`,
`c2-rhetoric`, `c2-critical-synthesis`. Combined with file-order selection, these are the *entry*
lessons for every band above A2.

**E2 — Comprehension is 3-option MCQ and nothing else.** `LessonComprehensionKind` is
`mainIdea | detail | sequence`, max 3 questions, 3 options. There is no inference, no
summarization, no dictation, no sentence reconstruction from audio. Guessing baseline is 33%.

**E3 — Vocabulary is encountered once, then only ever retrieved.** A lesson teaches 8 phrases;
FSRS then schedules them. Nothing re-uses a phrase *in a different context* by design.
`transfer.ts` does cross-context work, but from saved cards and error events — not from lesson
design. The request's "practice the same vocabulary in multiple contexts" is unimplemented at the
content layer.

**E4 — Grammar is a label, not a syllabus.** `concept` strings ("present perfect continuous",
"cleft sentence") are per-phrase annotations. No lesson declares a grammar target, nothing tracks
which structures a learner has met, and nothing sequences them. A learner can reach C1 lessons
without the app ever knowing whether they control the present perfect.

**E5 — Listening difficulty is one dial (WPM) on one voice engine.** `speedWpm` A1 100 → C2 175 is
a good start, but level differentiation in listening should also move: utterance length, lexical
density, number of speakers, overlap/interruption, redundancy, accent, and reduction. Today only
speed and authored text vary.

**E6 — Speaking has no unrehearsed-response task.** The ladder tops out at `timed_monologue` /
`simulated_conversation`, but the concrete drill
([speakingDrill.ts](../src/features/pronunciation/speakingDrill.ts)) is *repeat ×2 → one original
sentence*. There is no "respond to an unexpected question", no role-play with a turn the learner
could not prepare for outside `ConverseTab` (which is gated behind provider setup).

**E7 — Feedback never rewards success.** `buildCorrectRequest` returns `errors` only. Only
`buildAdvancedReviewRequest` (B2–C2 path) returns `overall.strengths`. The A2–B1 learner — the ICP —
receives a pure error list.

---

## 5. Recommended product positioning

**Keep the current wedge. Sharpen the sentence, and widen the band honestly.**

> PhraseLoop turns the English you actually meet — a clip, an article, a lesson, your own mistakes —
> into daily speaking and review practice that runs on your machine, and shows you evidence you are
> improving instead of a streak.

Three positioning decisions this review recommends:

1. **Lead with the closed loop (input → production → feedback → retry → scheduled review), not with
   "faster card creation."** Card-creation speed is a workflow claim competing with Migaku/Anki on
   their turf. The loop is the defensible claim and the one the codebase actually implements best.
2. **State the supported band as A2–C1, and make C2 explicitly experimental.** The app ships C2
   content and C2 CEFR descriptors, but the C2 tier is 8 lessons of which 4 are bare. Either finish
   it or label it.
3. **Position the open-source project as "the learning engine", not "the app".** The reusable,
   genuinely rare assets are `progression.ts`, `feedbackContract.ts`, `outcomeMetrics.ts`,
   `transferErrors.ts`, `placement.ts`. That is what a portfolio reviewer or a contributor would
   want, and it is what no competitor publishes.

**Essential features:** Today (one next action), lesson flow, review with production cards, spoken
production + feedback + retry, Discover (own source), Mistakes.
**Distracting features:** Standalone TTS/Speech tab, Anki export as a visible surface, LLM plan
generation, the separate C1 diagnosis tab, the LLM level test as a second placement path.

---

## 6. Target learner profiles

| Profile | Level | Situation | Primary need | Success looks like |
| --- | --- | --- | --- | --- |
| **P1 — The stalled self-learner** (current ICP) | A2–B1 | Consumes English content, understands more than they can say, has tried Anki | Production practice with correction, not more input | Says three connected sentences about their day unaided; unaided-production rate rising |
| **P2 — The professional under pressure** | B1–B2 | Works in English (meetings, PRs, standups), fears speaking | Rehearsal for real recurring situations + register | Completes a simulated standup/interview without preparing a script |
| **P3 — The plateaued advanced learner** | B2–C1 | Fluent but "sounds foreign"; errors are fossilized | Naturalness, collocation, register — and *noticing* their own recurring errors | Recurring error types drop measurably; refinement dimensions shift |
| **P4 — The tech learner** (explicit in the request) | B1–C1 | Needs to explain technical work in simple English | Explaining complexity plainly, handling questions | Explains a system to a non-expert in 90 seconds |

P4 is currently served only incidentally (`b1-processes`, `b2-project-management`). It is the
highest-leverage *new* profile because it matches the author's own domain, is underserved by every
competitor, and produces content that is cheap to author authentically.

Out of scope, and should stay out: A1 absolute beginners as a *narrative* (keep the content, drop
the marketing), mobile-only users, exam-prep candidates (IELTS/TOEFL scoring is a different product).

---

## 7. Proposed learning methodology

The existing eight-stage loop (`learn → listen → notice → repeat → speak → feedback → retry →
review`) is sound and should not be replaced. Three additions close the real gaps:

**Add stage 0 — Task framing.** Every lesson opens by stating the communicative task the learner
will have to perform at the end. This is what makes feedback able to judge task completion (see
§11) and what turns a phrase list into a goal.

**Add "notice-in-new-context" to Review.** Currently Review = FSRS retrieval. One item per session
should be a re-use item: the phrase appears in a *different* situation and the learner must produce
it. `transfer.ts` already builds these — they should be part of the scheduled session, not a
separate suggestion surface.

**Split feedback into two channels, always.** Channel A: *did you complete the task?* (communication
success — currently missing entirely). Channel B: *how was the language?* (already excellent via
`feedbackContract`). A learner should never see B without A.

Coverage after these changes, against the request's checklist:

| Skill | Today | After proposals |
| --- | --- | --- |
| Comprehensible input | Partial (synthetic only) | Partial → good with real audio (§18 C3) |
| Listening practice | Partial (19 lessons have none) | Complete |
| Speaking practice | Yes | Yes + unrehearsed response |
| Pronunciation awareness | Weak (word-level ASR only) | Adds stress/rhythm feedback |
| Vocabulary acquisition | Yes (SRS, bidirectional) | + planned multi-context recycling |
| Grammar in context | Implicit only | Explicit per-lesson target + tracking |
| Sentence construction | Yes (write step) | + reconstruction-from-audio |
| Reading | Effectively absent | Short graded texts per lesson |
| Writing | Yes (one sentence) | + one paragraph task at B1+ |
| Review & repetition | Excellent | Excellent |
| Real-life communication | Partial (Converse, gated) | Final task per lesson |
| Correction & feedback | Good | + task completion, + strengths |

---

## 8. Content architecture by CEFR level

Proposed `Lesson` schema extension (additive; existing fields unchanged, so
`validate-lesson-content.mjs` can gate new fields per-level without invalidating the bundle):

```jsonc
{
  "id": "b1-work-meetings",
  "level": "B1",
  "objective": "…",                 // exists
  "communicationGoal": "Give a status update and flag one blocker",  // NEW: the task, learner-facing
  "grammarTarget": {                // NEW
    "id": "present-perfect-progress",
    "label": "Present perfect for progress so far",
    "recycledFrom": ["b1-experiences"]
  },
  "vocabularyTarget": {             // NEW
    "coreItems": ["blocker", "on track", "follow up", "hold off"],
    "recycles": ["b1-problems:sort out", "a2-appointments:reschedule"]
  },
  "reading": {                      // NEW — 60-140 words, level-graded
    "text": "…", "glossary": [{ "en": "blocker", "pt": "impedimento" }]
  },
  "listening": {                    // formalizes today's `dialogue`
    "speakers": 2, "wpm": 130, "accent": "us-general",
    "connectedSpeech": false, "lines": [ … ]
  },
  "comprehension": [ … ],           // exists; add "inference" and "summary" kinds
  "guidedSpeaking": { "frames": ["We're on track with ___, but ___"] },  // NEW
  "productionPrompt": "…",          // exists
  "unexpectedFollowUp": "Why did that take longer than planned?",       // NEW
  "finalTask": "Record a 60-second status update for your real project", // NEW
  "reviewItems": ["b1-work-meetings:3", "b1-problems:1"]                 // NEW: cross-lesson
}
```

Per-level specification:

| Dimension | A2 | B1 | B2 | C1 |
| --- | --- | --- | --- | --- |
| Lesson vocabulary target | 6–8 concrete, high-frequency | 8–10, incl. 2 phrasal verbs | 8–10, incl. collocations & hedges | 8–10, incl. register-marked & low-frequency |
| Cumulative range | ~1,500 words | ~2,500 | ~4,000 | ~8,000 |
| Sentence complexity | 1 clause, `and/but/because` | 2 clauses, relative + `if/when/although` | Multi-clause, passive, nominalization | Cleft, inversion, embedded hedging |
| Reading length | 40–70 words | 70–120 | 120–200 | 200–300, incl. one implied stance |
| Audio speed | 115 wpm | 130 | 145 | 160 |
| Speakers / audio | 2, alternating cleanly | 2, one interruption | 2–3, overlap allowed | 3, interruption + repair |
| Accent | 1 (US general) | 2 (US, UK) | 3 (+ one L2 speaker) | 4 (+ regional) |
| Grammar expectation | Present/past simple, `going to` | Present perfect, conditionals 1–2, modals of advice | Conditionals 3, passive, reported speech, hedging | Nuanced modality, inversion, discourse markers |
| Speaking duration | 15–30 s | 30–60 s | 60–120 s | 120–180 s |
| Preparation allowed | Full frame + model | Frame only | 30 s think time | None; one unexpected follow-up |
| Feedback language | PT-BR | PT-BR | Mixed (`isMonolingualLevel` already handles this) | English only |
| Independence | Complete the frame | Adapt the frame | Build own structure | Choose register and stance |

Note: `isMonolingualLevel()` in `shared.ts` already implements the feedback-language ladder. The
rest of this table is currently only expressed through `CEFR_LANGUAGE_PROFILE` prose in prompts —
it should become structured data the content validator can enforce.

Topic coverage against the request's suggested categories — the bundle already covers *all fifteen*
(introducing yourself `a1-introductions`, routines `a1-routine`, work/study `b1-work`, travel
`a2-travel`/`b1-travel-problems`, shopping/restaurants `a2-shopping`/`a2-food`, opinions
`b1-opinions`, problems `b1-problems`, clarification `a2-clarification`, meetings `b1-work-meetings`,
interviews `b1-job-interviews`, storytelling `b1-storytelling`, news `b1-news-media`, argument
`b2-arguments`, professional communication `b1-email-messages`). **Technology and programming is the
only gap** — `a2-technology` is consumer devices, not technical explanation. That is the P4 content
wedge.

---

## 9. Recommended lesson structure

Mapped to the request's 11 required elements and to the existing eight stages. Timings are for a
25-minute session; the 8-minute variant is in §16 of this file's session design (§ below).

| # | Element | Stage | Time | Exists today? | What changes |
| 1 | Communication goal | *(new stage 0)* | 20 s | `objective` on 81/100 | Becomes learner-facing and mandatory; feeds feedback |
| 2 | Short introductory content | `learn` | 2 min | Phrase list | Add 60–140 word graded reading |
| 3 | Vocabulary in context | `learn` | 3 min | Phrase + PT + note | Add second context sentence per item |
| 4 | Natural example sentences | `learn` | — | Yes (dialogue, in 81) | Fill the 19 gaps |
| 5 | Listening practice | `listen` | 3 min | 81/100 authored | Fill 19; add speaker/accent variation |
| 6 | Comprehension | `listen` | 2 min | 3× MCQ | Add inference + one summary item at B1+ |
| 7 | Guided speaking | `repeat` | 3 min | Repeat ×2 | Add sentence frames, not just imitation |
| 8 | Independent speaking | `speak` | 3 min | 1 sentence | Duration by stage (already in `monologueSeconds`) |
| 9 | Personalized feedback | `feedback` | 2 min | Strong (error side) | Add task completion + strengths |
| 10 | Review activity | `review` | 3 min | FSRS | Add one cross-context re-use item |
| 11 | Practical final task | *(new)* | 3 min | Absent | Real-world task, marked done by the learner |

`retry` sits between 9 and 10 and already works well — `focusFeedback(limit = 2)` is exactly right.

---

## 10. Exercise catalog

Ten exercises, ordered by value-per-implementation-cost. Each is specified as requested.

### X1 — Sentence reconstruction from audio (dictogloss)
- **Skill:** listening → parsing → sentence construction. Trains the hardest gap: hearing structure, not just words.
- **Instructions (learner):** "Listen twice. Then write what you heard. It does not have to be word-for-word — keep the meaning."
- **Example input:** audio of *"We're still establishing whether customer data was exposed."*
- **Expected response:** any rendering preserving the proposition + hedge.
- **Evaluation:** content-word recall % + whether the hedge/tense survived. Deterministic: reuse `normalizePronunciationWords()` + the alignment in `scoring.ts` on text instead of speech.
- **Feedback:** diff view — words recovered / missed / added, with missed function words highlighted separately from content words.
- **Progression:** A2 6–8 words, one clause → C1 20+ words, two clauses + a discourse marker.
- **LLM:** **No.** Fully deterministic with existing code.

### X2 — Listen and summarize
- **Skill:** main-idea extraction under load; the check `mainIdea` MCQ only pretends to do.
- **Instructions:** "Listen to the whole conversation once. In one sentence, what did they decide?"
- **Example input:** the 6-line `b1-work-meetings` dialogue.
- **Expected response:** free text, 1–2 sentences.
- **Evaluation:** keyword coverage against an authored `expectedPoints: string[]` (no LLM), or LLM judgement of whether the gist is present (better).
- **Feedback:** "You got the decision. You missed the condition — replay from 0:12."
- **Progression:** A2 not used → B1 one sentence → B2 gist + one supporting reason → C1 gist + speaker stance.
- **LLM:** Optional. Keyword fallback needs `expectedPoints` authored per lesson.

### X3 — Respond to an unexpected question
- **Skill:** unrehearsed production — the single missing speaking mode.
- **Instructions:** "You have 10 seconds to think. Then answer in 30 seconds. You cannot see the question in advance."
- **Example input:** after the `b1-job-interviews` production prompt, `unexpectedFollowUp`: *"That's a strength. When has it caused you a problem?"*
- **Expected response:** spoken, 20–60 s, addresses the actual question.
- **Evaluation:** duration (`durationMs`, already captured), whether the response addresses the question (LLM), then the standard `feedbackContract` pass.
- **Feedback:** task completion first, then one priority correction.
- **Progression:** B1 one follow-up → B2 two, one challenging a claim → C1 counterpoint requiring concession.
- **LLM:** **Yes** for relevance judgement; the prompt itself is authored (no generation needed).

### X4 — Explain it simply (P4 wedge)
- **Skill:** paraphrase, definition, audience adaptation.
- **Instructions:** "Explain what a database index is to someone with no technical background. 60 seconds. No jargon."
- **Expected response:** spoken monologue; success = a non-expert would understand.
- **Evaluation:** jargon-term detection (deterministic word list per topic) + LLM check for a working analogy.
- **Feedback:** "You used three technical terms without explaining them: *B-tree*, *cardinality*, *query planner*." — deterministic and unusually actionable.
- **Progression:** B1 one concept, 45 s → C1 concept + trade-off + handling a follow-up.
- **LLM:** Optional (jargon list is deterministic; analogy quality needs a model).

### X5 — Compare your answer with a stronger version
- **Skill:** noticing — the mechanism that turns feedback into acquisition.
- **Instructions:** "Here is your sentence and a stronger version. Find the three differences before revealing them."
- **Example input:** learner: *"I am working here since 2019."* / model: *"I've been working here since 2019."*
- **Expected response:** learner marks differences, then re-records.
- **Evaluation:** differences identified; then a retry attempt.
- **Feedback:** reveal with one rule per difference — from `transferErrors.ts` where it matches (deterministic, no hallucination risk).
- **Progression:** A2 one difference → C1 three differences including register.
- **LLM:** **No** when the correction came from `localCorrection`/`transferErrors`; reuses whatever produced the correction.

### X6 — Same phrase, three contexts
- **Skill:** vocabulary depth and transfer — fixes E3.
- **Instructions:** "Use *hold off* in three different situations: at work, with a friend, and with a service provider."
- **Expected response:** three sentences, written or spoken.
- **Evaluation:** phrase present in all three (deterministic, `localCorrection`'s phrase matcher already does fuzzy match); contexts distinct (LLM or simple lexical-overlap heuristic).
- **Feedback:** "Two of your three are the same situation."
- **Progression:** A2 two contexts with frames → C1 three, one requiring a register shift.
- **LLM:** Optional.

### X7 — Shadowing with stress feedback
- **Skill:** rhythm, stress, connected speech — currently unmeasured (W5).
- **Instructions:** "Speak along with the audio. Match the rhythm, not every sound."
- **Evaluation:** compare syllable-timing envelope of the learner's recording against the reference clip's. Stress position and pause placement are extractable from the audio you already generate; this does not require a phoneme model.
- **Feedback:** one observation only: "You stressed *CONfirm*; native stress is *conFIRM*."
- **Progression:** A2 word stress → B1 phrase stress → B2 sentence rhythm → C1 intonation for stance (which `c1-crisis-communication`'s `pronunciationFocus` already authors).
- **LLM:** **No.** Signal processing, on-device.

### X8 — Informal → professional rewrite
- **Skill:** register — the C1 gap `c1/model.ts` already diagnoses but never trains.
- **Instructions:** "Rewrite this message so you could send it to a client."
- **Example input:** *"hey cant do the meeting tmrw, somethings come up, lets do it another time"*
- **Expected response:** *"Hi — I'm afraid I need to reschedule tomorrow's meeting. Would Thursday work?"*
- **Evaluation:** register-marker checklist (greeting, hedge, proposal, closing) — deterministic; plus optional LLM refinement pass through `buildAdvancedReviewRequest`, which already returns a `register` dimension.
- **Feedback:** which of the four moves were present.
- **Progression:** B1 4 markers → C1 tone adaptation across three audiences.
- **LLM:** Optional.

### X9 — Continue the conversation
- **Skill:** turn-taking, follow-up questions.
- **Instructions:** "Ask two follow-up questions that would make this person keep talking."
- **Example input:** *"I moved here about three years ago for work."*
- **Expected response:** two open questions (not yes/no).
- **Evaluation:** deterministic — question mark present, opens with a wh-word or auxiliary inversion, and is not a repeat.
- **Feedback:** "Both of your questions can be answered with yes or no. Try *What…* or *How…*."
- **Progression:** A2 one question → C1 questions that probe a stated assumption.
- **LLM:** **No** for the check; optional for a natural reply.

### X10 — Simulated meeting / interview
- **Skill:** sustained multi-turn production under mild pressure.
- **Instructions:** "You have a 5-minute standup. Give your update, then answer what comes."
- **Evaluation:** turns completed, total speaking time, task completion, then the standard feedback contract.
- **Feedback:** at the end only — mid-conversation correction is already correctly forbidden in `buildConverseSystem`.
- **Progression:** governed by the existing `conversation.maxTurns` 4→12 and `followUpDepth` ladder.
- **LLM:** **Yes.** This is genuinely generative; keep it gated.

**Exercises to remove or merge:** the synthesized listening check (`buildListeningChallenge`
fallback) should be *replaced* by X1 rather than kept as a labelled-honest recall check — a
deterministic reconstruction task is strictly better and needs no authored dialogue. The `sequence`
comprehension kind adds little over `detail` and can be merged.

---

## 11. AI feedback system

The prioritization layer is already right. Four changes make the *content* of the feedback right.

**F1 — Pass the task into the prompt.** `buildCorrectRequest(text, learnerLang, targetLang, level)`
becomes `buildCorrectRequest({ text, task, learnerLang, targetLang, level })` where `task` is the
lesson's `communicationGoal` + `productionPrompt`. Then add to the system prompt:

```
First decide whether the learner completed the task: "{task}".
Task completion is judged on meaning, not accuracy. A response with grammar mistakes that
achieves the goal is a success with corrections. A flawless response that does not answer the
task is a task failure, and you must say so before anything else.
```

**F2 — Return the success channel.** Extend the schema:

```jsonc
{
  "taskCompleted": true,
  "communicated": "You made the schedule risk clear and proposed a concrete alternative.",
  "errors": [ … ],           // unchanged, still max 3
  "naturalVersion": "…",     // the whole response, once, as a model — not a rewrite lecture
  "followUpChallenge": "Now say the same thing to a client instead of your team."
}
```

`communicated` must be specific — the existing "no praise without information" instinct in the
codebase should be an explicit constraint: *"Name what they actually conveyed. 'Good job' and 'nice
sentence' are forbidden."*

**F3 — Anti-hallucination safeguards.** Current prompts already say "never invent text the learner
didn't write" — good. Add, and enforce in the normalizer:
- **Verbatim check.** `normalizeCorrected` drops non-corrections (`original === corrected`); extend
  it to drop any error whose `original` does not appear verbatim in the learner's text. This is the
  same idea as `isTextGrounded()` applied to feedback, and it kills fabricated quotes deterministically.
- **Rule grounding.** When a correction matches a `transferErrors.ts` pattern, use *that* module's
  explanation instead of the model's. Curated rules beat generated grammar claims.
- **Repetition guard.** Suppress an error explanation the learner has already seen twice
  (`recurrenceCounts` already computes this); replace it with a drill, not a third explanation.
- **Ceiling on advancement.** Add to the prompt: *"The suggested version must stay within CEFR
  {level}. Do not upgrade the learner's sentence into language they cannot yet produce."* This is
  currently missing and is why advanced suggestions leak into A2 feedback.
- **Style is not error.** Already present ("not style preferences"). Keep, and route
  correct-but-improvable items into `refinements` (already implemented for B2+), never into `errors`.

**F4 — Cap the feedback surface, per category.** At most: 1 task-completion line, 1 success line,
2 priority errors (`focusFeedback` default — correct), 1 natural version, 1 pronunciation note, 1
vocabulary note, 1 follow-up. Anything else goes into an expandable "other notes" that never blocks
retry. This is close to today's behaviour but should be a schema-level constraint rather than a UI
decision.

**Category coverage** — the request's nine categories map onto the existing seven plus two:

| Requested | Today | Action |
| --- | --- | --- |
| Grammar | `grammar` | — |
| Vocabulary | `vocabulary` | — |
| Word order | `wordOrder` | — |
| Naturalness | `naturalness` | — |
| Pronunciation | `pronunciation` | — |
| Fluency | — | **Add** — derive from `durationMs` + pause count, not from the LLM |
| Clarity | `messageClarity` | — |
| Tone | folded into `naturalness` (`register`) | **Split out** — `c1/model.ts` already tracks `register` as a refinement dimension |
| Task completion | — | **Add** as F1/F2, above the category list |

---

## 12. Non-LLM learning strategy

The project is already the strongest example of this I have reviewed. Making the boundary explicit
is what remains.

**Tier 1 — Core, works fully offline, no provider ever:**
lesson flow (learn/listen/notice/repeat/speak/review), FSRS scheduling
([fsrs.ts](../src/lib/srs/fsrs.ts)), bidirectional cards, authored comprehension checks, Kokoro TTS,
Whisper transcription, `localCorrection` + `transferErrors`, `placement.ts`, progression ladders
(pure functions over local events), progress metrics, backup/restore. **Plus, after this review:**
X1 dictogloss, X5 comparison, X7 shadowing, X9 follow-up questions — all deterministic.

**Tier 2 — AI-enhanced, degrades gracefully:**
free-text correction beyond transfer rules, phrase mining from own sources, card generation +
critique, X2 summarization scoring (falls back to keyword coverage), X4 analogy quality (falls back
to jargon detection), X6 context distinctness.

**Tier 3 — Genuinely requires generative AI:**
open conversation (X10), the LLM level test, advanced review/refinements for B2+, plan generation
(which §17 argues should be deleted anyway).

**Where an LLM is currently used but shouldn't be:**
- **Plan generation.** A 90-day schedule is a scheduling problem with hard constraints
  ("study 5–6 days/week", "discover 2–3×/week", "check-in every 14 days"). Those constraints are
  already written in the prompt as *rules for the model to follow* — they should be code. The two
  static plans (`a1-b1.json`, `b2-c1.json`) plus the `objectivePolicy` shaping already produce a
  better, testable result at zero cost and zero latency.
- **Level test authoring.** `placement.ts` produces a defensible band estimate from bundled content
  with an explicit "insufficient" state. The LLM test adds a promotion gate whose items are
  unvalidated and unreproducible. Keep LLM grading of the *writing sample*; author the objective
  items from the bundle.

**Rule to adopt:** *If the task has a correct answer that bundled content already defines, it must
not call a model.*

---

## 13. Motivation and progress system

Current state is already principled (no streaks/XP, `CONTRIBUTING.md` forbids adding them, and the
"garden" concept remains unbuilt). What is missing is not motivation *mechanics* — it is **visible
evidence**. Five surfaces, all derived from data already stored:

1. **"You can say this now" wall.** Phrases with an unaided production review passed after ≥7 days
   rest — `computeUnaidedProduction` already identifies exactly these reviews; it currently only
   returns a rate. Show the *items*. This is the single most motivating artifact available and it
   costs a query.
2. **Speaking-time trend.** Sum `durationMs` per week from `production_attempt` events. "In January
   you spoke 4 minutes a week unaided. Last week: 11."
3. **Errors you stopped making.** `recurrenceCounts()` over `ErrorEvent`s, windowed: error types
   that appeared 3+ times before a date and 0 times since. Named specifically: "*depend of* — last
   seen 24 days ago."
4. **Before/after recordings.** Keep the first recording of each lesson's production prompt and let
   the learner re-record it 30 days later, played back-to-back. `RecordingComparison.tsx` already
   exists — it compares within an attempt; extend it across time.
5. **Weekly learning summary** (not engagement): tasks completed, new phrases held, one error class
   improved, one still recurring, one recommendation. Explicitly *not* days active or minutes.

Explicitly avoid, as already decided: streaks, loss framing, notifications, leaderboards, points,
energy. Note the one existing risk: `weeklyGoal` (`goal: 3`) is a days-per-week target. Keep it
framed as a plan, never as a streak to protect — and never show a broken-goal state in red.

---

## 14. UX and navigation improvements

Against the request's eight comprehension questions:

| The learner should know… | Today | Fix |
| --- | --- | --- |
| What to study next | **Good** — `HojeHome` resolves one CTA | — |
| Why this exercise matters | **Weak** — `objective` isn't shown | Show `communicationGoal` at stage 0 |
| What skill I'm training | Partial — `MethodCoach`/`ExposureMeter` show it in Review only | One skill chip on every practice screen |
| What I did wrong | **Good** | — |
| How to improve | **Good** — retry is well designed | — |
| What I've mastered | **Absent** | §13 item 1 |
| What needs review | **Good** — due badge | — |
| How close to my goal | **Absent** — no goal is captured beyond `objective` | Capture a concrete goal in onboarding ("give a standup in English by March") and show progress against its component skills |

**Navigation:** collapse five tabs to three permanent + one contextual.

```
Today   |   Practice   |   Progress          [Settings]
                ↑
   Review · Lesson · Speak · My sources · My mistakes  (segmented inside Practice)
```

Rationale: "Review", "Speak", "Phrases", "Mistakes" are not *destinations* — they are modes of the
same loop, and `HojeHome` already decides which one you need. Making them tabs asks the learner to
make a routing decision the app is better at making. Keep `useUnlockedTabs`'s progressive disclosure
for the segmented control.

**Terminology:** "Phrases" for a *source import* tab is the least clear label in the app (the
phrases are also in lessons, in review, and in mistakes). Suggest "My sources". "Mistakes" is
honest but heavy — "My corrections" reframes without softening.

**Steps to remove:** the second onboarding (`PlanOnboarding`) — merge the two questions it adds
(availability, target date) into the main onboarding; the separate C1 tab — fold the register
diagnosis into Progress as an advanced panel.

---

## 15. Technical and architectural recommendations

1. **`lessons.json` is at its scaling limit.** 100 lessons, 1,280 clip references, one file, loaded
   whole. Split to `src/content/lessons/<level>/<id>.json` with an index, and make the content
   validator per-file. This is also the precondition for community lesson packs (§17).
2. **Make the CEFR ladder structured data, not prose.** `CEFR_LANGUAGE_PROFILE` is six prose strings
   interpolated into prompts. Add a parallel typed `CEFR_SPEC` (wpm, sentence length, speakers,
   accents, speaking seconds, preparation, feedback language) that *both* the prompts and
   `validate-lesson-content.mjs` consume. Today a lesson can claim B2 and contain A2 language, and
   nothing catches it.
3. **Extract the learning engine as a workspace package.** `features/method`, `features/correct/feedbackContract`,
   `lib/srs`, `features/activation/outcomeMetrics`, `features/learn/transferErrors` have no React and
   almost no I/O dependencies. As `@phraseloop/engine` they become the portfolio artifact and the
   contribution surface. The repo already has `workspaces: ["apps/*"]`.
4. **Split `ConverseTab.tsx` (1,352 lines).** Already on the tracker in `product.md`; it is the one
   file where the "hooks + presentational" pattern used elsewhere broke down.
5. **Add a content-quality gate to CI.** `validate-lesson-content.mjs` checks structure. Add: every
   lesson must have `objective`, `dialogue`, `comprehension`, `productionPrompt`, `pronunciationFocus`;
   fail the build otherwise. This turns finding E1 into something that cannot regress.
6. **Store `taskCompleted` on `ProductionAttempt`.** `progression.ts` currently derives speaking
   score from `issueCount` alone — i.e. accuracy. Once F1 ships, task completion should carry more
   weight than issue count in `productionScore()`, or the ladder keeps promoting accurate
   non-communication.
7. **Windows/Linux honesty.** README requires Apple Silicon; `electron/build-windows.sh` and
   `build-linux.sh` exist and recent commits touch Windows. State the real support matrix — this is
   the binding constraint the adversarial audit named for adoption, and for an open-source project
   it matters more than for a commercial one.

---

## 16. Session design

**25–40 minute session** (the request's target):

| Stage | Min | Why it exists |
| --- | --- | --- |
| Due review | 5 | Retrieval before new input; FSRS decides the set. Production cards first. |
| New input (read + listen) | 6 | Comprehensible input with a stated goal; reading before audio lowers load at A2–B1. |
| Comprehension check | 3 | Verifies input landed; produces the listening evidence `deriveListeningStage` needs. |
| Guided speaking | 4 | Frames reduce cognitive load so attention goes to form. |
| Independent speaking | 4 | Pushed output — the mechanism that turns comprehension into production. |
| Feedback | 3 | Task completion, then ≤2 priority issues. |
| Retry | 3 | The retry is where learning happens; without it feedback is just information. |
| Final task | 3 | Transfer out of the app. Marked done by the learner, not scored. |
| Scheduling | 1 | Show what returns tomorrow — closes the loop visibly. |

**8-minute session** — not a reduced version; a *different complete* loop:

| Stage | Min |
| --- | --- |
| Due review (production cards only) | 3 |
| One listening reconstruction (X1) | 2 |
| One 30-second spoken response to a previous correction | 2 |
| One priority feedback item + retry | 1 |

This keeps input → output → feedback → review intact at one-third the length, which is the
difference between a short session and a micro-exercise. What it deliberately omits is *new*
material — a short session should consolidate, not open new debt.

---

## 17. Open-source strategy

**Positioning:** *"A local-first English tutor, and the learning engine behind it — spaced
repetition, evidence-gated progression, and prioritized feedback, with the pedagogy written down."*

The engine is the differentiator. No competing open-source project publishes a defensible CEFR
progression model, a transfer-error rule set for a specific L1, or an outcome metric this honest.

**README rewrite (opening paragraph):**

> PhraseLoop is a local-first English tutor for Portuguese speakers (A2–C1). It runs speech
> recognition and synthesis on your machine, never requires an API key, and closes a full learning
> loop: listen → produce → get prioritized feedback → retry → review on schedule. It measures
> whether you can *produce* English after 30 days, not how many days in a row you opened the app.

**Contribution formats to define:**
1. **Lesson packs** — a JSON schema + validator (`npm run learn:content:validate` already exists) so
   a teacher can ship `packs/business-english-b2/` without touching TypeScript. Publish the schema
   and one exemplary pack.
2. **L1 transfer rules** — `transferErrors.ts` is Portuguese-specific and generalizes. A
   `transferRules/<lang>.ts` interface would let Spanish, French, and Japanese speakers contribute
   the errors *they* make. This is the highest-value, lowest-risk contribution surface in the repo.
3. **Voice/audio packs** — with a provenance and licence field already modelled in the manifest.

**Good first issues (concrete, from this review):**
- Author `dialogue` + `comprehension` for `b1-opinions` (one lesson, template exists in 81 others).
- Add the `inference` comprehension kind + one item per B1 lesson.
- Fix the stale comment in `speakingDrill.ts:33-37`.
- Add `expectedPoints` to five B1 lessons to enable no-LLM summarization scoring.
- Add a jargon word list for X4 in one technical topic.

**What makes the repo technically impressive** (lead with these): on-device Whisper + Kokoro through
native addons with no Python; a provider abstraction where four LLMs are genuinely interchangeable
behind one JSON contract; FSRS with per-direction scheduling; grounding checks that reject
hallucinated cards; and a codebase whose comments document *why the easy version would have been
dishonest*. That last one is rare and worth surfacing in the README.

**What demonstrates educational value:** publish `docs/learning-rubrics.md`, the outcome-metric
definition, and the adversarial audit itself. Publishing a hostile review of your own product is a
stronger credibility signal than any feature list.

**Roadmap:** publish §18 as `ROADMAP.md` with the Critical/High/Medium/Optional labels intact.

---

## 18. Features to remove or simplify

| Feature | Verdict | Why |
| --- | --- | --- |
| LLM plan generation (`/api/plan`, `plan/prompts.ts`) | **Remove** | 90-day schedules from one JSON call, unanchored to CEFR; static plans + `objectivePolicy` are better, testable, free, instant. Keep `PlanOnboarding`'s two questions, delete the generator. |
| LLM level test (`levelup/testModel`, `/api/level-test/*`) | **Simplify** | Author objective items from the bundle; keep LLM grading for the writing sample only. Removes an unvalidated item generator from a promotion gate. |
| Standalone Speech/TTS tab | **Remove from navigation** | It is a developer tool for the Kokoro runtime. Keep the runtime; drop the surface. |
| Anki export | **Keep, demote** | Genuine trust-builder ("your data is yours"), wrong as a visible tab. Move to Settings → Data. |
| C1 diagnosis tab | **Merge** | Fold `groupRefinementsByDimension` into Progress as an advanced panel. It is one good analysis, not a destination. |
| Synthesized listening fallback | **Replace** | Honestly labelled today, but X1 (dictogloss) is deterministic, better, and needs no authored dialogue. |
| `sequence` comprehension kind | **Merge into `detail`** | Adds no distinct measurement. |
| Second onboarding (`PlanOnboarding`) | **Merge** | Two questions do not justify a second flow. |

---

## 19. Prioritized roadmap

### CRITICAL

**C1 — Fix upper-band lesson entry points**
- *Problem:* every B1/B2/C1/C2 learner's first lesson is a bare phrase list (E1 + `nextLessonFor` file-order selection).
- *Solution:* (a) immediately, order-sort so complete lessons are selected first — one predicate in `nextLessonFor`; (b) then author the missing material for all 19.
- *Why it improves learning:* those learners currently get no listening, no comprehension check, no production prompt, and no pronunciation focus — four of the eight stages silently vanish.
- *Complexity:* Low (ordering, ~1 day) + Medium (authoring, ~19 × 2 h with the existing template).
- *LLM:* No (drafting may use one; every line needs human review).
- *Example:* `b1-opinions` gains a 6-line disagreement dialogue, 3 comprehension items, `productionPrompt: "State an opinion about remote work, then respond to someone who disagrees."`, and `pronunciationFocus` on contrastive stress in *I see your POINT, but…*.

**C2 — Feed the task into feedback (F1 + F2)**
- *Problem:* the model grades sentences, not communication; correct-but-off-task answers pass.
- *Solution:* extend `buildCorrectRequest` with `task`; add `taskCompleted` + `communicated` to the schema; render task completion above corrections; store it on `ProductionAttempt`.
- *Why:* communicative success is the actual goal, and learners systematically over-weight grammar when only grammar is reported.
- *Complexity:* Low — one prompt, one schema, one component, one field.
- *LLM:* Yes (already in the LLM path). The local path gets a keyword-coverage fallback against `communicationGoal`.
- *Example:* Prompt *"Answer 'What is your main strength?' with one strength and one concrete result."* Learner: *"I am very organized person."* → **Task: incomplete** — "You named a strength but no result." Then the article correction. Today: only the article correction.

**C3 — Make listening difficulty real**
- *Problem:* `supportForProgression` promises unfamiliar speakers and connected speech; the bank has one TTS engine, per-level WPM, and rate manipulation.
- *Solution:* (a) use Kokoro's full voice set for level-appropriate speaker variety and mark `speakerFamiliarity` honestly; (b) author `listening.connectedSpeech` variants with real reductions written into the text (*"whaddaya think"*, *"I'm gonna"*) at B2+; (c) stop using playbackRate > 1.0 as a difficulty lever — vary authored WPM instead; (d) longer-term, source CC-licensed native audio for B2–C1.
- *Why:* the ability to parse fast, reduced, unfamiliar speech is the number-one complaint of B1–B2 learners and is exactly what clean TTS never trains.
- *Complexity:* Medium (a, b, c) / High (d, plus licensing).
- *LLM:* No.
- *Example:* `b2-remote-work` ships two audio variants — `clean` (145 wpm, articulated) and `natural` (145 wpm, with *gonna*, *kinda*, elision) — and the ladder switches at `functional_comprehension` instead of speeding the clean one up.

### HIGH IMPACT

**H1 — Sentence reconstruction (X1) replaces the synthesized check.** Deterministic, no authoring, trains parsing. *Complexity: Low. LLM: No.*

**H2 — "You can say this now" + errors-you-stopped-making.** Two queries over data you already store; the strongest non-manipulative motivation available. *Complexity: Low. LLM: No.*

**H3 — Grammar targets per lesson + coverage tracking.** Add `grammarTarget`; show which structures have production evidence. Turns "100 lessons" into a syllabus. *Complexity: Medium. LLM: No.*

**H4 — Unexpected follow-up question (X3).** The missing speaking mode; one authored line per lesson. *Complexity: Low (authoring) + Low (UI). LLM: Yes for relevance.*

**H5 — Navigation collapse to Today / Practice / Progress.** *Complexity: Medium. LLM: No.*

**H6 — Onboarding: add available time, weakest skill, speaking comfort, and one concrete goal.** Four questions; they feed session length, ladder starting stage, and the goal display. *Complexity: Low. LLM: No.*

**H7 — Anti-hallucination hardening (F3).** Verbatim-quote enforcement in `normalizeCorrected`, curated rules preferred over model explanations, level ceiling on suggestions, repetition guard. *Complexity: Low. LLM: n/a (constrains it).*

### MEDIUM IMPACT

**M1 — Reading per lesson** (60–300 words by level) — closes the one wholly absent skill. *Medium. No LLM.*
**M2 — Stress/rhythm feedback (X7)** — makes `pronunciationFocus` measurable. *High complexity, no LLM.*
**M3 — Multi-context vocabulary recycling (X6 + `vocabularyTarget.recycles`)** — *Medium. Optional LLM.*
**M4 — Technology/programming content track (P4)** — 8–10 lessons, `b1-processes` as the template. *Medium. No LLM.*
**M5 — Split `lessons.json` + typed `CEFR_SPEC` + CI content gate.** *Medium. No LLM.*
**M6 — Register rewrite exercise (X8)** and folding the C1 tab into Progress. *Medium. Optional LLM.*
**M7 — Extract `@phraseloop/engine`.** *Medium. No LLM.*

### OPTIONAL

**O1** — Community lesson-pack format and one exemplary pack.
**O2** — L1 transfer-rule interface for languages beyond Portuguese.
**O3** — Native CC-licensed audio sourcing pipeline.
**O4** — Before/after recording playback across 30 days.
**O5** — Simulated meeting mode (X10) as a distinct scenario type in Converse.

---

## 20. Quick wins

Each is under a day and independently valuable:

1. **Sort complete lessons first in `nextLessonFor`** — one predicate; fixes the worst first-impression bug in the app for every learner above A2.
2. **Show `objective` at the top of every lesson** — 81 lessons already have one, and none of them is displayed as the goal.
3. **Fix the stale comment in `speakingDrill.ts:33-37`** — 64 → 81, and `a1-greetings` does have a `productionPrompt`.
4. **Add `communicated` (a specific success line) to the feedback response** — half of C2, and the half learners feel most.
5. **Add the level ceiling sentence to correction prompts** — one line, stops advanced suggestions leaking into A2 feedback.
6. **Enforce verbatim `original` in `normalizeCorrected`** — deterministic anti-hallucination, ~10 lines.
7. **Surface "errors you stopped making"** — `recurrenceCounts()` windowed; one component.
8. **Rename "Phrases" → "My sources"** — the least clear label in the navigation.
9. **Add `expectedPoints` to five B1 lessons** — unlocks no-LLM summarization scoring (X2).
10. **Publish `docs/adversarial-audit.md` and the outcome-metric definition in the README** — the strongest credibility signals the project owns and currently hides.

---

## Long-term opportunities

- **The engine as the product.** `@phraseloop/engine` with a documented pedagogy is a more durable open-source contribution than another language app, and it is what makes this repo a portfolio piece rather than a portfolio project.
- **L1-specific transfer rules as a community asset.** "The app that knows the mistakes *your* language makes you make" is a positioning no competitor can copy quickly, and it scales through contribution rather than through authoring.
- **Evidence-based placement as a public standard.** `placement.ts`'s refusal to guess, plus the D+30 unaided-production metric, could be published as a small open specification for honest level assessment. Nobody owns that space.
- **Real native audio with provenance.** The manifest already models licence and provenance per clip. A CC-licensed native-audio corpus with per-phrase attribution would resolve C3 permanently and is a genuinely reusable public good.
- **Teacher mode.** Not a school product — a single teacher assigning a lesson pack and reviewing the *evidence* (recordings, error trends, unaided production) rather than scores. The data model already supports it; only export and a read-only view are missing.
