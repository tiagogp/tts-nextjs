# PhraseLoop Pedagogy & OSS Audit — Consolidated

Merges [`docs/pedagogy-oss-review.md`](./pedagogy-oss-review.md) (English, undated, code-only review) and [`plans/learning-product-audit.md`](../plans/learning-product-audit.md) (Portuguese, 2026-07-30, code review + pedagogy literature + user-validation plan). Both are independent audits of the same repository state. This document preserves the material findings from each, reconciles overlaps, and flags the one place where their recommendations differ. Claims about learning effectiveness are additionally checked against primary and authoritative research listed in §5.

Legend used below: **[both]** = cross-validated by both audits independently. **[EN]** / **[PT]** = appears in only one source. **[tension]** = the two audits recommend different things.

## 0. Snapshot the two audits agree on

- **App**: PhraseLoop, Electron desktop. The audited setup and native dependencies are verified for Apple Silicon Mac; the repository evidence does not by itself prove that other platforms are technically impossible. Core loop: hear a clip → save a phrase → FSRS flashcard review → correct your own attempt → correction becomes a future drill.
- **ICP**: Brazilian A2–B1 self-learners who already consume real English content and find manual Anki card-creation too much friction. Both audits explicitly warn against widening the target to "everyone learning English."
- **Motivation design**: no XP/points/badges/leaderboards, no loss-framed streaks, no notifications. Both confirm this by reading the schema/code, not just the README's claims — a genuine, verified differentiator.
- **OSS gaps**: no `LICENSE` file, no `CONTRIBUTING.md`, no issue/PR templates, no "good first issue" path. Native-binary + Apple Silicon setup (Kokoro TTS, whisper.cpp, `yt-dlp`) adds real friction beyond license paperwork.
- **Biggest open risk**: nobody has proven the app produces real learning outside the app. Every mechanism (FSRS, grounding, correction) is well-built, but there's no cold-transfer or pre/post user data in the repo.
- **What not to touch**: the audio-grounded, source-to-drill loop (learner's own clip → phrase → error → future drill) is the sharpest differentiator vs. Anki/ChatGPT/Duolingo. Neither audit wants this diluted for cheaper generation.

## 1. Reconciled executive verdict

PhraseLoop contains several mechanisms supported by learning and second-language research: retrieval practice, spaced review, meaning-focused input, learner output, corrective feedback, retry, and practice tied to personally meaningful source material. That is stronger evidence for **pedagogical plausibility** than for demonstrated effectiveness. The repository can show that the mechanisms exist; it cannot yet show that users retain or transfer English outside the practiced items.

The PT audit adds a materiality update the EN audit did not have: **100 lessons / 804 phrases shipped, 64 with authored dialogue+comprehension, 64 with a `productionPrompt`, and 59 with `pronunciationFocus`**. These counts should not be collapsed into one universal “64% complete” figure because the sets may differ. What can be stated safely is that at least 36 lessons lack authored dialogue+comprehension and 41 lack `pronunciationFocus`; the overlap should be measured before assigning a single curriculum-completeness percentage.

Both audits therefore land on the same bottom line: PhraseLoop is a **research-aligned, unvalidated teaching hypothesis**, not yet a validated teaching tool. The PT audit is more precise about *why* it is unproven (no external usage data, no pre/post comparison, no interviews) and provides an operational validation plan (§9 below); the EN audit is more precise about *where the current design still has a ceiling* (sentence-level practice, conversation under-trained, self-graded recall).

Governance verdict is identical in both: "open source" today describes the code's visibility, not its governance. No license, no contribution path, single-author history.

## 2. Where the audits add unique ground

| Topic | EN audit | PT audit |
|---|---|---|
| Pronunciation/speaking evaluation | Not analyzed | **[PT]** Full section: scoring is transcript/text-alignment based, not phonemic — useful signal, not a real pronunciation assessment. Flagged as a technical-pedagogical risk. |
| Ollama `skipCritique` | Not mentioned | **[PT]** Ollama path can skip card critique, weakening quality guarantees exactly on the local/private path that's part of the product's differentiator. Roadmap item P1. |
| Product scope breadth | Not raised as a named risk | **[PT]** Names "escopo amplo" (Lessons, Discover, Study, Correct, Speak, Plan, Progress, LevelUp, C1, export) as a risk of diluting the core loop. |
| Mobile/sync | Not mentioned | **[PT]** Notes no evidence of mobile/sync, recommends deferring rather than building until the core loop is validated. |
| Granular per-criterion pedagogy scorecard (0-5 per SLA criterion) | **[EN]** `pedagogy-oss-review.md` §3 | Not present in this form |
| Skill-by-skill breakdown (reading/listening/speaking/writing/vocab/grammar/pronunciation/fluency) | Not present in this form | **[PT]** §6, with per-skill evidence and fix |
| 15-method pedagogy table (comprehensible input, shadowing, interleaving, deliberate practice, etc.) | Not present in this form | **[PT]** §6, richest single table in either doc |
| Full user-validation protocol (participant criteria, tasks, before/after metrics, interview script, decision rules) | **[EN]** only 3 short "cheap experiments" | **[PT]** §16, a ready-to-run protocol |
| Primary/secondary learning metrics definitions | Not present in this form | **[PT]** §15 (D+30 unaided production, transfer success rate, retry-resolved rate, etc.) with an explicit rule that secondary metrics (cards created, streak) must never substitute for a primary one |
| Ideal daily/weekly session model, with/without AI | Not present | **[PT]** §14 |
| README repositioning copy | Implicit (praises existing table) | **[PT]** §5 and §18 offer drop-in tagline + subtext |
| Pedagogy literature citations (Roediger & Karpicke, Cepeda et al., Swain & Lapkin, Lyster & Saito, Rohrer, CEFR Companion Volume, ACTFL, Nation) | Not cited | **[PT]** grounds every method-table row in a specific source |

### **[tension]** Conversation: promote or hold back?

- **EN audit** (top-5 problem #3): conversation is "the feature most likely to build real fluency" and is under-trained as a side tab. Fix proposed: surface it as a *recommended recurring step* inside the plan/reinforcement loop — i.e., promote it now.
- **PT audit** (§13, "funcionalidades que devem ser removidas ou adiadas"): "Conversa livre longa: adiar destaque até garantir fechamento em feedback, retry e revisão" — defer prominence *until* the conversation loop reliably closes into feedback/retry/review, otherwise it risks becoming entertainment without a learning close-out.

These aren't actually incompatible — both agree conversation is currently under-leveraged and currently doesn't close the loop — but they diverge on sequencing. Read together: **build the feedback→retry→review close-out for conversation first, then promote it**, rather than promoting a conversation tab that still dead-ends after the chat.

## 3. Merged top problems, ranked

1. **No proof of real learning outside the app.** **[both, PT most concrete]** The design contains research-aligned mechanisms, but there is no delayed-retention, cold-transfer, pre/post, comparison-group, or interview evidence. §9 defines the minimum validation protocol.
2. **No LICENSE file.** **[both]** This is the largest OSS-readiness blocker, although not the largest product-learning risk. Before selecting MIT or GPL-3.0, check compatibility for code dependencies, bundled audio, models, datasets, and generated content.
3. **Zero contribution infrastructure, compounded by real setup friction.** **[both]** No CONTRIBUTING.md, no templates, no "good first issue" path, plus Apple Silicon + native binaries + `yt-dlp` as a floor for any contributor.
4. **At least 36 lessons still lack authored dialogue+comprehension.** **[PT, precise version of EN #5]** These lessons use the synthesized 3-option listening fallback, which the code itself treats as discrimination-testing rather than full comprehension-testing. Separately, 41 lessons lack `pronunciationFocus`. Verify overlap before reporting a single incomplete-curriculum percentage.
5. **No "felt progress" moment — activity metrics can pass for competence.** **[both, independently]** EN proposes a "then vs. now" resurfacing of an early saved clip against current comprehension. PT proposes the same idea from the motivation angle: recordings before/after, "your preposition error dropped from 5 to 1," "you spoke 40s about work with no script." Both flag that reviews/cards-completed counts must never stand in for this.
6. **Conversation doesn't close the loop into feedback/retry/review.** **[tension, see §2]** — resolve sequencing before promoting it.
7. **Ollama `skipCritique` weakens quality exactly on the local/private path.** **[PT only]** That path is part of the stated differentiator (no cloud dependency); a cheap deterministic local critique (reject empty translation, front==back, source-less cards) is proposed.
8. **Self-graded recall may inflate perceived performance.** **[EN]** Production cards are self-graded (flip, then self-report), no typed-and-diffed check. PT independently flags `computeUnaidedProduction` as an existing metric designed to resist this inflation, but notes (roadmap item, P0) that it isn't yet surfaced anywhere in the UI — so the safeguard exists in code but isn't validated or visible.
9. **Pronunciation scoring is transcript-alignment, not phonemic.** **[PT only]** Useful coarse signal (word approximation, rhythm), not a substitute for real phonetic assessment. Should be presented to the learner with that ceiling explicit.
10. **Scope breadth risk.** **[PT only]** Lessons, Discover, Study, Correct, Speak, Plan, Progress, LevelUp, C1, export all already exist. Risk of diluting the core loop rather than deepening it.

## 4. What research supports — and what it does not prove

The research supports PhraseLoop's **learning architecture**, but not a product-level claim that PhraseLoop has already been shown to teach English.

| Research finding | Product implication | Evidence level in PhraseLoop today |
|---|---|---|
| Retrieval practice can improve delayed retention more than repeated study. | Production-before-reveal and delayed review are justified; recognition-only accuracy should not be the headline metric. | Mechanism implemented; user-level delayed-retention effect not yet measured. |
| The benefit of spacing depends on the relationship between study interval and desired retention interval. | FSRS is directionally appropriate, but its scheduling behavior still needs tests for new cards, overdue cards, timezone changes, rescheduling, and log integrity. | Algorithm present; end-to-end scheduling validity not independently established. |
| Comprehensible input supports comprehension and exposure, but immediate comprehension does not automatically equal acquisition. | Listening tasks need delayed recall and new-audio transfer checks, not only same-session multiple choice. | Input exists; acquisition and transfer remain unproven. |
| Output can promote noticing and learning under some task conditions, especially when followed by another attempt or model. | The strongest loop is production → targeted feedback → retry, not conversation or correction without a required second attempt. | Present in parts of the app; not yet consistent across Lesson, Correct, and Converse. |
| Corrective feedback can support L2 development, but effects depend on feedback type, target, task, learner, and measurement quality. | Feedback should prioritize one or two communicatively important errors, explain the issue, require retry, and later test the same issue in a new context. | Structured feedback exists; comparative effectiveness and transfer are untested. |
| A balanced language course includes meaning-focused input, meaning-focused output, language-focused learning, and fluency development. | PhraseLoop should not let flashcards dominate the whole method; it needs new listening, meaningful production, focused correction, and repeated fluent use. | All four appear, but their balance and dosage are not measured. |
| CEFR describes communicative activities and proficiency; it is not a validation seal for generated content or automatic scoring. | “CEFR-tuned” should mean content was designed against descriptors, not that learner level or lesson quality has been externally validated. | Useful design framework; calibration still needed. |

### Evidence ladder for any “does it teach?” claim

1. **Implemented mechanism** — the feature exists in code.
2. **Behavioral completion** — users can complete the intended loop without assistance.
3. **Immediate learning** — performance improves on the practiced item after feedback/retry.
4. **Delayed retention** — improvement remains after 7–30 days without hints.
5. **Near transfer** — the same phrase or error is handled in a new sentence or topic.
6. **Far/cold transfer** — performance improves on unseen audio, writing, or speaking tasks not generated from the practiced item.
7. **Comparative effectiveness** — improvement exceeds a baseline, current routine, or comparison condition.

PhraseLoop currently has strong evidence at level 1, partial repository evidence for level 2, and no external evidence yet for levels 3–7. Therefore, the defensible wording is **“research-aligned and designed to teach”**, not **“proven to teach better.”**

### Research references

- Roediger, H. L., & Karpicke, J. D. (2006). *Test-enhanced learning: Taking memory tests improves long-term retention*. Psychological Science. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). *Spacing effects in learning: A temporal ridgeline of optimal retention*. Psychological Science. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Loschky, L. (1994). *Comprehensible input and second language acquisition: What is the relationship?* Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263100013103
- Izumi, S., Bigelow, M., Fujiwara, M., & Fearnow, S. (1999). *Testing the output hypothesis: Effects of output on noticing and second-language acquisition*. Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263199003034
- Izumi, S. (2002). *Output, input enhancement, and the noticing hypothesis*. Studies in Second Language Acquisition. https://doi.org/10.1017/S0272263102004023
- Pica, T., Holliday, L., Lewis, N., & Morgenthaler, L. (1989). *Comprehensible output as an outcome of linguistic demands on the learner*. Studies in Second Language Acquisition. https://doi.org/10.1017/S027226310000830X
- Nation, I. S. P. (2007). *The Four Strands*. Innovation in Language Learning and Teaching. https://doi.org/10.2167/illt039.0
- Council of Europe (2020). *Common European Framework of Reference for Languages: Companion Volume*. https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume

## 5. Merged pedagogical scorecard

### 4a. SLA criteria (0–5), from the EN audit

| Criterion | Verdict | Score | Evidence |
|---|---|---|---|
| Meaning-focused/comprehensible input | Research-aligned, with a gap | 4/5 | CEFR-informed complexity, grounded content, and authored listening exist. Immediate comprehension must not be treated as acquisition; the app still needs unseen-audio and delayed-retention measures. |
| Active recall vs. recognition | Mixed | 3/5 | Production cards require recall-before-reveal but grading is self-reported; listening checks are MCQ and self-flagged in code as discrimination, not comprehension. |
| Spaced repetition | Strong architecture, unvalidated behavior | 4/5 | FSRS and a 4-grade scale are implemented. Research supports spacing, but the product still needs end-to-end scheduling tests and delayed user-retention evidence. |
| Real output | Right, underused | 4/5 | `MistakeStep` and `conversation/route.ts` are genuine production, but both are secondary to the flashcard loop. |
| Transfer to real use | Partial | 3/5 | Grounding in learner-chosen material is the strongest transfer mechanism, but nothing closes the loop back to source; everything stays sentence-level. |
| Feedback quality | Strong design, effectiveness unproven | 4/5 | Structured error tagging, rationale, prioritization, and deterministic fallback are present. Research supports corrective feedback conditionally; PhraseLoop still needs retry and transfer outcomes by feedback type. |
| Personalization | Right | 4/5 | Reinforcement from the learner's own errors, plan adapts from effort history, weakness list shows trend. |

### 4b. Skill-by-skill state, from the PT audit

| Skill | State | Evidence | Diagnosis |
|---|---|---|---|
| Reading | Implemented | Articles/PDF in Discover, phrase/prompt reading | More a source/support role than an independently assessed skill. |
| Listening | Partially implemented | `buildListeningChallenge`, saved attempts, transcript-free audio | Strong when dialogue is authored; weak on the synthesized fallback. |
| Speaking | Partially implemented | `GuidedSpeaking`, `ConverseTab`, `PronunciationCoach`, `ProductionAttempt` | Real oral practice exists, but free-speech semantic evaluation depends on a provider and needs human validation. |
| Writing | Implemented | `CorrectTab`, `MistakeStep`, local/AI feedback, retry | Strong for short production + correction; needs more free-writing tasks over time. |
| Vocabulary | Implemented | `PhraseCandidate`, cards, FSRS | Strong, especially phrase/chunk-level. |
| Grammar | Partially implemented | `ErrorType`, `localCorrection`, weak spots | Good for captured errors; local coverage is limited and explicitly not a grammar checker. |
| Pronunciation | Partially implemented | Transcript-based scoring, recording comparison, tips | Useful as practice and a coarse signal; not a substitute for real phonetic assessment. |
| Fluency | Partially implemented | `scoreFluency`, conversations, WPM | Promising metric; needs longer, comparable samples. |

### 4c. Method coverage (selected rows), from the PT audit — grounded in SLA literature

| Method | Presence | How to improve | Measure |
|---|---|---|---|
| Comprehensible input | Partial | Calibrate by accuracy rate, duration, known vocabulary; simplify without losing naturalness | Accuracy on new audio, time-to-response, replay count |
| Active recall | Strong | Make unaided production the headline progress metric, not accuracy % | D+7/D+30 unaided production |
| Spaced repetition | Strong | Separate "activity" dashboards from "retention" dashboards | Lapses, stability, recall after rest |
| Deliberate practice | Partial | Define a per-session target and clear success criterion | Recurring error reappears less in a new task |
| Feedback (immediate/delayed) | Partial | Distinguish form, meaning, naturalness, and pronunciation feedback | Retry-resolved rate |
| Shadowing | Partial | Turn into an explicit sequence: listen, shadow, record, compare, use freely | Old vs. current recording; listener rating |
| Accents/speeds | Weak/partial | Curate sources with real accents/speeds; tag speaker familiarity | Accuracy on unfamiliar audio |
| Real transfer | Partial, promising | Make weekly transfer tasks mandatory, not optional | Success rate in a novel scenario |

*(Full 15-row table with all methods, evidence, and citations lives in [`plans/learning-product-audit.md`](../plans/learning-product-audit.md) §6.)*

## 6. UX & motivation (merged)

**Confirmed absent** (both, code-verified, not just README claims): XP/points/badges, loss-framed streaks, notifications, push/service-worker code. `streakDays` is computed in `src/lib/srs/analytics.ts` but never rendered. The Electron dock badge carries an explicit anti-manipulation comment: *"One calm re-engagement pull... No notifications, no framework — just a quiet number the learner can ignore."*

**Strengths** (PT): `HojeHome` reduces the day to one primary action; the weekly method allows flexible days and no-punishment recovery; `SessionSummary` avoids guilt/loss framing; the app logs useful signals (hints used, scaffold level, listening/production/pronunciation attempts).

**Risks** (PT): "cards saved" / "reviews done" could still dominate perceived progress if they're more visible than transferred production; the first-session flow (listen, answer, save, repeat, pronounce, write, correct, review) is pedagogically sound but could feel heavy if not paced; users may not understand why certain tasks are deliberately hard; free conversation risks becoming entertainment if it doesn't end in retry/error-becomes-review (ties to §2 tension above).

**Recommended motivation mechanic** (both, same idea from two angles): self-comparison over time. EN: "then vs. now" resurfacing of an early clip against current comprehension. PT: "14 days ago you needed a hint on this phrase; today you produced it unaided," "your preposition error dropped from 5 to 1," "you spoke 40 seconds about work with no script."

## 7. Technical diagnosis (merged)

**Strong** (both): provider abstraction reduces lock-in; `generateVettedCards` does structural grounding + critique when the provider allows it; IndexedDB stores rich learning data, not just settings; backup/restore has validation; `localCorrection.ts` prevents predictable PT→EN errors from being silently accepted without a provider; `StudyCard` correctly hides answer audio until reveal in the production direction; `computeUnaidedProduction` is a metric designed to resist self-report inflation.

**Weak points**:
- **[PT]** Ollama can skip critique (`skipCritique`), reducing quality guarantees exactly on the local/private path.
- **[PT]** Pronunciation scoring is transcript/alignment-based — useful, but not phonemic, prosodic, or a real intelligibility measure.
- **[PT]** The level test uses an LLM to both generate and grade part of the test; without external validation it can miscalibrate.
- **[PT]** No evidence of mobile sync / review-anywhere.
- **[both]** No `LICENSE`, `CONTRIBUTING`, or beginner-facing issue guide at the repo root.

## 8. Open-source assessment (merged)

| Criterion | EN score (/5) | PT verdict |
|---|---|---|
| Clear differentiator | 5/5 | Confirmed — source audio + own errors + local-first + SRS is a real niche vs. Duolingo/Anki/ChatGPT/ELSA |
| License | 0/5 | Not found — same conclusion |
| 30-min contribution readiness | 1/5 | Not found — same conclusion; Apple Silicon + native binaries + `yt-dlp` adds friction beyond docs |
| Sustainability without revenue | 1/5 | 134 commits, single author, no contribution funnel — same conclusion |
| Content-contribution architecture | 3/5 | `lessons.json` is flat, validated, editable JSON (good); everything else (generation, correction, conversation prompts) lives in TypeScript, unreachable by a non-engineer pedagogical reviewer |

Recommendation on license (both): **MIT**, unless preventing a closed commercial fork specifically matters — a solo hobby-scale project rarely faces that risk yet, and MIT removes friction for contributors and packagers.

## 9. Consolidated validation plan

EN's 3 "cheap experiments" are a subset of PT's full protocol — presenting the merged version, PT's as the operative plan with EN's framing folded in:

**Participants**: 8–12 Brazilian A2–B1 self-learners; ≥5 with prior Anki/flashcard experience; ≥3 who consume English YouTube/podcasts/articles; avoid close friends as the majority of the sample.

**Duration**: 2 weeks for initial validation; 4 weeks if the goal includes a partial D+30 retention read.

**Tasks**: onboarding → complete first lesson with no provider configured → import one own short source → save 1–3 phrases → review same-day and next-day → write or speak an own sentence → correct and retry → complete one transfer task with a different theme.

**Before/after measures**: 30–60s recording on a simple topic; comprehension of a short new unsubtitled audio; 5–8-sentence free writing sample; active vocabulary used correctly; translation dependency; time-to-formulate-response. *(This directly operationalizes EN's "cold-transfer test" experiment: never-seen clip + free-writing prompt, scored blind against a no-app baseline.)*

**Interview questions**: What do you think the app is trying to improve? What felt useful enough to come back tomorrow? What felt like too much work? Did it feel like you learned, or just completed a task? What error/phrase do you remember without opening the app? Would you use this alongside Anki/ChatGPT, or instead of some part of your current flow? Would you pay to remove which pain, if any?

**Decision rules**: Keep — user completes the loop and improves on at least one predeclared primary metric. Change — user likes it but cannot explain the gain, needs excessive assistance, or improves only on practiced items. Remove/defer — user engages with the surface but it does not produce production, feedback, retry, delayed retention, or transfer.

**Minimum research-quality controls**:
- Predefine the primary outcome before collecting data.
- Use equivalent but unseen pre/post tasks rather than repeating the exact same prompt.
- Score samples blind when possible, using a small rubric for comprehensibility, accuracy, lexical range, and task completion.
- Report individual results as well as averages; 8–12 users are suitable for product discovery, not for broad causal claims.
- Include at least one comparison: the learner's previous routine, a wait-list period, or a simple alternative workflow.
- Separate same-item improvement, delayed retention, near transfer, and cold transfer in the results.

*(EN's other two experiments — the "self-grading audit," forcing a typed-answer check on a self-graded sample to quantify inflation, and the "felt-progress pilot," manually building the then-vs-now resurfacing for 5 users — remain useful smaller-scale probes to run alongside or before the full protocol.)*

## 10. Metrics for real learning **[PT, unique]**

**Primary** — never let secondary metrics substitute for these:
- D+7 and D+30 unaided-production rate (no hint; report exact delay since last exposure)
- Near-transfer success rate (same target phrase/error in a novel sentence or topic)
- Cold-transfer score (unseen audio, writing, or speaking task not generated from the studied item)
- Retry-resolved rate (errors corrected on second attempt)
- Listening no-subtitle accuracy (main idea vs. detail, on new audio)
- Spoken output duration (comprehensible unscripted speech time)
- Recurring-error reduction (drop in errors per type/context over 14/30-day windows)
- Pronunciation longitudinal signal (initial vs. current recording, with an explicit low-automatic-precision disclaimer)

**Secondary** (activity, not competence): cards created, reviews completed, minutes per area, flexible streak/active days, due count, provider success/failure rate.

## 11. Ideal session model **[PT, unique]**

**Daily (15–30 min)**: 2 min warm-up (2–4 due cards, prefer PT→EN production) → 5–8 min input (short unsubtitled clip, answer main idea/detail) → 3–5 min noticing (reveal transcript, pick 1–3 useful phrases) → 5–8 min production (use a phrase in your own spoken/written response) → 3–5 min feedback (correct the single most important error, explain why it matters) → 2–4 min retry (without copying the correction) → save cards/error event for future review.

**Weekly**: review competence metrics (not just volume); compare an old recording to a new one; do one transfer task on a new theme; review 1–2 recurring errors; adjust the week's plan by the actual deficit (listening/speaking/reading-writing/review).

**Without AI**: bundled lessons, limited local correction, FSRS, transcript-based pronunciation, cards from authored phrases, backup/progress.
**With Ollama/local**: mine/generate/correct/converse with a quality-caveat shown; prefer low-risk tasks (user-reviewed suggestions, not definitive level assessment).
**With cloud LLM**: free feedback, conversation, advanced review, card generation/critique, adaptive plan — with an explicit privacy notice that cloud is an opt-in choice.

## 12. README positioning **[PT, unique — two draft taglines]**

From §5 (value proposition):
> PhraseLoop ajuda brasileiros A2-B1 a transformar vídeos, textos e erros próprios em prática diária de produção em inglês: ouvir, salvar, produzir, corrigir, tentar de novo e revisar no momento certo.

From §18 (README rewrite):
> PhraseLoop é um app local-first para brasileiros A2-B1 que querem transformar inglês real e erros próprios em prática diária de produção. Em vez de recompensar presença, ele fecha um loop simples: ouvir uma fonte curta, salvar uma frase útil, produzir inglês sem ajuda, receber feedback, tentar novamente e revisar no momento certo.

Recommended subtext: "Not a substitute for a class, teacher, or immersion." "Doesn't promise fluency through streaks." "Works without AI for the first loop; AI improves curation, correction, and conversation." "The differentiator is keeping sources and errors local so they come back as practice."

## 13. Features to keep / improve / remove-defer (merged)

**Keep** (union of EN §5 "one thing not to break" and PT §11):
- The audio-grounded, mistake-becomes-drill loop tied to learner-chosen source material — the sharpest differentiator vs. Anki/ChatGPT.
- Bidirectional cards with production-first grading and independent FSRS.
- Hidden answer audio before response on production cards.
- `ErrorEvent` and `PhraseCandidate` as sources of truth.
- Limited local correction for the no-AI first loop; retry after feedback.
- `computeUnaidedProduction` as the primary durable-learning metric.
- `buildTransferActivities` and cross-context tasks.
- YouTube/article/PDF import with human segment review.
- Provider abstraction (Ollama/OpenRouter/Claude/OpenAI); local backup/restore.
- `HojeHome`'s single-primary-action design.

**Improve** (PT §12, folding in EN's #4/#5/#8):
- Make unaided production and transfer more visible than review/card counts (addresses EN #5 and #8).
- Finish dialogue/comprehension/production/pronunciation for the remaining ~36% of lessons (addresses EN #5 / merged #4).
- Build listening tasks on genuinely new audio, not just recently-studied phrases.
- Calibrate the level test against a fixed sample with transparent criteria.
- Give pronunciation feedback explicit limits plus longitudinal comparison.
- Make weak-spots generate varied activities automatically, not just card reinforcement.
- Turn Plan into a competence plan, not a time-distribution plan.
- Add OSS docs: license, contributing, provider architecture, demo data/fixtures (addresses merged #1/#3).

**Remove or defer** (PT §13, folding in the §2 conversation tension):
- C1 diagnosis as a primary surface — keep experimental/hidden until the A2–B1 loop is validated (consistent with the existing product decision that C1 is a deliberate ladder ceiling, not a gap — this is about UI prominence, not the ceiling itself).
- Advanced Anki export as a primary narrative — it's depth, not the initial promise.
- Billing/monetization — defer until there's interview evidence of repeated paid pain.
- Long free conversation — defer prominence until it reliably closes into feedback/retry/review (see §2 tension).
- Rigid streaks, coins, cosmetic badges — do not implement without a clear pedagogical hypothesis.
- Mobile/sync expansion — defer if it competes with core-loop validation.

## 14. Final scores — two different scoring systems, same conclusion

EN uses per-criterion 0–5 scores (§5a/§5c above). PT uses holistic 0–10 scores across broader dimensions — not directly comparable, but shown together because they converge:

| PT dimension | Score |
|---|---|
| Research alignment of the teaching design | 8/10 |
| Demonstrated learning effectiveness | 3/10 |
| Learning-experience quality | 7/10 |
| Healthy motivation | 8/10 |
| Differentiation | 8/10 |
| Open-source potential | 7/10 |
| Portfolio-piece quality | 9/10 |
| Technical sustainability | 7/10 |

Both audits converge on strong motivation design and differentiation. The revised research reading separates two questions that the previous score blended together: the teaching design is research-aligned, but demonstrated learning effectiveness remains low-confidence until delayed retention, transfer, and comparison data exist.

## 15. Actionable backlog (from the PT audit's task table, P0→P2)

| Task | Priority | Areas affected |
|---|---|---|
| Create a fillable validation log for 8–12 users (task, metric, decision per row) | P0 | `docs/` or `plans/` |
| Define blind-scoring rubrics, equivalent unseen pre/post tasks, and one comparison condition | P0 | `docs/` or `plans/` |
| Surface D+30 unaided production in the progress UI (already computed, just not shown; must distinguish "not enough data" from "low rate") | P0 | `src/features/progress`, `src/features/activation` |
| Author dialogue/comprehension/production/pronunciation for 10 more A1–A2 lessons | P0 | `src/features/learn/lessons.json`, `public/learn/audio`, `scripts` |
| Add a weekly cross-context transfer task suggestion to Home (max 1×/week, doesn't block due reviews) | P1 | `src/features/home`, `src/features/study`, `src/features/method` |
| Build a local, no-AI onboarding level check (short listening + cloze + self-assessed writing) | P1 | `src/features/settings`, `src/features/levelup`, `src/features/learn` |
| Add a deterministic critique gate for Ollama-generated cards (reject empty translation, front==back, no source text) | P1 | `src/lib/cards/shared`, `src/lib/cards/provider`, `src/lib/cards/providers/ollama.ts` |
| Unify retry contract across Lesson/Correct/Converse (max 1–2 errors, communicative priority, mandatory second attempt) | P1 | `src/features/correct`, `src/features/converse`, `src/features/learn` |
| Add baseline OSS docs and complete a dependency/content license compatibility check | P0-OSS | repo root, `docs/` |
| Show old vs. recent recording for the same phrase/theme, framed cautiously (not as definitive proof) | P2 | `src/features/pronunciation`, `src/features/progress`, `src/lib/store` |
| Build a small licensed native-audio source pack (5–10 clips, varied accents, authored comprehension questions) | P2 | `native-audio`, `src/features/learn`, `docs` |
