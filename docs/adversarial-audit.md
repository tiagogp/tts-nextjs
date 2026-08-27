# Adversarial Audit — Method and Commercial Position

Date: 2026-07-25
Reviewer stance: skeptical product strategist + SLA researcher, instructed to find the weakest
points before the market does.
Evidence available at time of writing: **none**. The W5 decision round stands at 0/10 rows. No
waitlist signups, no interviews, no unmoderated use by anyone outside the project. Every judgement
below is therefore about the *design* and the *position*, not about observed learner behaviour.

This document is deliberately hostile. It is not a status report and it does not balance criticism
with reassurance. Where the project is right, it says so briefly and moves on.

---

## 0. The biggest concern, stated once

**You have built a validation apparatus instead of running it.**

[w5-validation-protocol.md](w5-validation-protocol.md) reads "Status: ready to run." The decision
record in [product.md](product.md) was generated on **2026-07-03** — twenty-two days ago. Rows
scored: **0/10**. Every one of the seven gates reads `Pending`. Every count reads `0`.

Meanwhile the supporting apparatus is complete and unused: a recruiting message, a consent script,
a moderator run sheet, a capture table with 28 columns, follow-up message templates, a
backup/restore validation protocol, a demo video script, and a scoring CLI (`yarn w5:score`) with
its own test suite. In the same twenty-two-day window the repository gained a lesson-deck
expansion, a learning-loop balance tracker, landing-page SEO with sitemap and OG image, and a
refreshed knowledge graph.

You have written more infrastructure for measuring users than most projects write for having them.

This is not a scheduling problem, and treating it as one is the mistake. A protocol this complete,
this old, and this untouched is doing emotional work. It lets the project feel rigorous — genuinely
rigorous, the W5 design is better than most funded teams manage — without ever exposing the work to
a stranger's indifference. The gate has become a place to stand rather than a door to walk through.

Nothing else in this audit matters until row `W5-01` exists. Every section below is written on the
assumption that you will fix that first.

---

## 1. Ratings

**Pedagogical soundness: 5/10.**

The split matters more than the number. *Principle selection* is an 8–9: retrieval practice,
spaced repetition, pushed output, focused corrective feedback, and learner-chosen real input is a
better-chosen stack than almost anything on the market, and the "Pesquisa Aplicada" section of
`product.md` is unusually literate — it correctly separates performance from learning, treats
desirable difficulties as conditional rather than universal, and flags interleaving as selective
rather than a blanket good. Very few consumer language products understand any of that.

*Execution* is a 3–4, for four specific reasons set out in section 2. Net: 5.

**Commercial viability: 2/10.**

Not because the product is bad. Because the addressable set is the intersection of `Brazilian` ×
`A2-B1` × `studies alone` × `has tried Anki` × `feels card creation as a pain` × `owns an Apple
Silicon Mac` × `will pay R$19–39/month`, and every direct substitute in that person's life is free.
The macOS constraint is the binding one, and it is the assumption that has never been tested.

The two scores are independent on purpose. A pedagogically excellent product can be commercially
dead, and this one is closer to that than to the reverse.

---

## 2. Method audit

Four findings. Each is verified against the code, not inferred from the documentation.

### 2.1 Your review card trains recognition, not production

**Evidence: strong, and against you.**

`buildDeckFromPhrases()` in [lessonDeck.ts:82-94](../src/features/learn/lessonDeck.ts#L82-L94)
constructs every card as `front: phrase.en`, `back: phrase.pt`, with `audioClipPath` attached to
the front. The learner sees and hears English, and retrieves Portuguese.

That is the receptive direction, and it is the wrong one for your stated goal. Receptive recall is
substantially easier than productive recall, transfers to production only weakly, and is the
canonical mechanism behind the illusion of fluency: the learner retrieves the meaning without
effort, grades the card "Good," accumulates a satisfying streak of correct answers, and then cannot
produce the phrase when they need it. The direction asymmetry in vocabulary learning is one of the
better-replicated findings in the field — productive practice yields receptive knowledge as a
by-product far more reliably than the reverse.

Your product's entire promise is *using* English. Your spaced-repetition engine trains
*understanding* it.

The audio placement compounds this. With the clip on the front, a learner can clear a card from
acoustic familiarity — "I've heard this one" — without retrieving anything at all. FSRS will
faithfully schedule that non-event as a successful review and extend the interval accordingly.

This is the single highest-leverage change available to you, and it is roughly a day of work:
either flip the card direction to PT→EN, or generate both directions and let FSRS schedule them
independently. Everything else in this audit is strategy. This one is a bug in the learning model.

### 2.2 Your comprehension check does not check comprehension

**Evidence: contradicted.**

All **36 of 36** lessons in `lessons.json` have empty `dialogue` and `comprehension` arrays. The
`LessonMaterial` interface that would carry real listening material is designed correctly and is
entirely unpopulated. Consequently, *every* lesson falls through to the synthesized fallback in
[lessonFlow.ts:79-135](../src/features/learn/lessonFlow.ts#L79-L135), which produces:

- A "What is the main situation?" question whose answer is literally `lesson.topic`, with
  distractors drawn from other lessons' topics. **This is answerable from the lesson title without
  playing any audio.**
- "Which meaning matches clip N?" questions whose two distractors are other Portuguese translations
  *from the same lesson the learner studied thirty seconds earlier* — and whose answer position is
  fixed by a hash of the lesson id (`placeAnswer`), so it does not vary between attempts.

The clips themselves come from `learningPhrases()`, which returns the same first five phrases just
taught in the Learn step. So the listening stage plays back language the learner has just read, and
asks them to discriminate it from two alternatives they also just read. Baseline guessing is 33%.

This is short-term discrimination among primed items. It is not listening comprehension, it does
not require parsing connected speech, and it will not transfer to a YouTube video. Worse, it will
*look* healthy: your roadmap's content gate specifies "first-attempt listening accuracy 35–85%,"
and this task will land comfortably inside that band while measuring nothing.

The fix is not a code fix. The 36 lessons need real dialogue and real comprehension items, which is
content work — which is precisely why the 100-lesson roadmap should not begin until the existing
36 have material.

### 2.3 In the zero-setup path, "your mistakes become drills" is mostly "your typos become drills"

**Evidence: contradicted.**

[localCorrection.ts](../src/features/learn/localCorrection.ts) is admirably honest in its own header
comment: it corrects "spelling of the lesson phrase, capitalization of 'I', sentence casing and
terminal punctuation," plus a check that the lesson phrase or its reusable frame was actually used.
Without a configured AI provider, that is the entire feedback surface — and the W5 loop is defined
to complete without a provider.

The real error profile of a Brazilian A2-B1 learner is not typos. It is article omission (*I am
student*), L1 transfer on state verbs (*I have 30 years*), preposition transfer (*depend of*,
*arrive in*), present-perfect misuse, subject-verb agreement on collective nouns (*people is*), and
false cognates. Every one of these passes through `correctSentenceLocally()` untouched, is declared
corrected, and is saved as a review card.

You will therefore generate cards containing the learner's own uncorrected errors and schedule them
for spaced repetition. That is worse than giving no feedback at all: spaced repetition of an error
is spaced *acquisition* of an error, and it arrives wearing the authority of a correction the
learner believes was checked.

The engineering here is careful and the `mergeEvaluatedCorrection()` design — apply model
corrections, then re-run the deterministic pass — is right. The problem is structural: the good
feedback path requires an API key, and the activation path is defined to avoid one. You have
optimized the first run for frictionlessness at the cost of the differentiator that first run is
supposed to demonstrate.

Two honest options: ship a small bundled grammar-check for the ~15 highest-frequency PT→EN transfer
errors (deterministic, on-device, no provider), or accept a provider requirement at the correction
step and pay the activation cost. Do not keep claiming the third thing.

### 2.4 `learningLoop.ts` invents both its measurements and its targets

**Evidence: weak.**

[learningLoop.ts:72-84](../src/features/method/learningLoop.ts#L72-L84) defines skill-area target
ratios — `structured: 0.4, listening: 0.3, speaking: 0.2, readingWriting: 0.1`, plus four
goal-conditioned variants — with no cited basis anywhere in the repository.
[learningLoop.ts:114-173](../src/features/method/learningLoop.ts#L114-L173) then derives the
learner's actual "minutes" by assigning fixed constants to events: a completed review is 1 minute,
a conversation turn is 2, a submitted mistake is 3, a progress check-in is 5, a level test is 10.

`weakestArea()` then steers the learner's next recommended action by the deficit between a
fabricated measurement and a fabricated target.

There is no finding in the SLA literature that prescribes a 40/30/20/10 split. Skill-balance
prescriptions are goal-dependent, level-dependent, and largely untested at this granularity. I am
*not* claiming to know better ratios — I don't, and neither does anyone else with confidence. The
criticism is narrower and harder to escape: the module presents invented numbers as derived ones,
and then acts on them.

It also sits outside the Phase 0 allowed-work list in
[validation-action-plan.md](validation-action-plan.md). It is not on the frozen-path table in
`AGENTS.md`, so this is not a literal violation — but it is new adaptive logic built during a
feature freeze whose stated purpose is to stop exactly this, and `product.md`'s own Definition of
Done #4 ("avoid new surface if the same journey can be solved with Home → Discover → Study →
Correct") argues against it. That it was built at all is a symptom of section 0.

### 2.5 What the method gets right

So the criticism above is calibrated rather than reflexive:

- FSRS over SM-2 is the correct call and is implemented, not aspirational.
- `SessionSummary` separating "accuracy now" from "predicted stability" is a genuinely rare piece
  of intellectual honesty. Most products would show the flattering number alone.
- Opt-in, removable scaffolding (hint, 0.75× audio, listen-and-repeat fallback) matches the
  scaffolding-then-fading principle properly.
- Light-session and cooldown modes take the motivational literature seriously instead of
  punishing bad days with streak loss.
- The explicit refusal of XP, leagues, and aggressive notifications is the right trade and costs
  you real engagement metrics. Hold that line.
- The capture-and-reuse skeleton — source → phrase → production → correction → review — is a sound
  closed loop, and closing the loop is the part most competitors never do.

The skeleton is right. Four of its joints are wrong.

---

## 3. The gap between promise and outcome

### 3.1 The provenance gap is live right now

The landing hero reads *"Inglês real. Áudio original. Pronto para revisar."* The README's
five-second promise is *"turn real English and your mistakes into **native-audio** review cards in 2
minutes,"* and the first-run description is *"hear a curated **native** clip."*

`native-audio/manifest.json` contains `[]`. `public/learn/audio/` does not exist in the repository;
the 292 bundled clips are generated at setup time by `scripts/generate-learn-audio.mjs` from
**Kokoro TTS**, voice `af_heart`, speed 1.15.

Your own [100-lesson-roadmap.md](100-lesson-roadmap.md) states the rule you are currently breaking:
*"Kokoro remains a development fallback, never a claim of native-source audio."*

Native audio appears only when a learner brings their own timestamped source — and your launch plan
explicitly defers own-source until *after* activation, on the sound reasoning that imports can fail.
So in the first session, and in every bundled lesson, the differentiator you lead with does not
exist.

Fix this before the demo video reaches a single stranger. Either record or license real audio for
the first three lessons, or change the copy to something true ("áudio claro e consistente" is not a
worse promise, it is just a smaller one). Shipping as-is is the kind of thing a skeptical early
adopter finds in ninety seconds and posts about, and it would poison the one asset you cannot
rebuild cheaply: being the honest tool.

### 3.2 Six months, followed exactly

Assume the target learner gives 20–30 minutes most days for six months and completes the program as
designed. Concretely, they will have worked through roughly 292 bundled phrases across 36 lessons
(~8 per lesson), reviewed in the receptive direction, plus whatever they generated from their own
sources and corrections.

They will be able to: recognize those phrases in audio, understand their meanings reliably, and
produce a subset in writing when prompted with the phrase's own frame. They will have a genuine
study habit and a well-retained, modest phrase inventory.

They will **not** move a CEFR band on this alone. An A2→B1 transition needs roughly an order of
magnitude more lexical coverage than 292 items, and — more importantly — it needs spontaneous
production under time pressure, which your loop never demands. Every production step is scaffolded
by the phrase just taught; `correctSentenceLocally()` even penalizes *not* reusing the target
frame. That is correct pedagogy for a first lesson and insufficient as a whole method: at some
point the scaffold has to come off, and nothing in the current design removes it.

**The named gap:** you over-claim on *provenance* (native audio you do not have), not on *outcome*.
"Pronto para revisar" is honest copy. This is worth saying plainly — most products in this category
have the opposite problem, promising fluency and delivering a streak. Your outcome copy is
defensible. Your sourcing copy is not.

---

## 4. Riskiest assumptions

Ordered by likelihood-of-being-wrong × damage-if-wrong.

**1. [Business] The launch ICP exists in reachable numbers.**
`Brazilian` × `A2-B1` × `self-study` × `has tried Anki` × `feels card-creation pain` × `Apple
Silicon Mac` × `pays R$19–39/month`. I will not invent a market-size figure; I do not have reliable
Mac-penetration data for this segment and fabricating one would be worse than useless. But the
direction is not in doubt: Macs are import-taxed luxury hardware in Brazil, and you have stacked
five further filters on top of that base. The macOS constraint is doing more damage to this project
than any pedagogical decision in the repository, and it is the only major assumption that can be
falsified without writing a line of code.

**2. [Business] Card creation is a pain worth switching for.**
The wedge is "under 2 minutes versus doing it by hand." Nobody has ever measured the "by hand."
If the honest manual number is three minutes, the wedge is a rounding error. If your target user
simply *doesn't put audio on their cards* — which is true of most Anki users — the wedge collapses
to text extraction, which ChatGPT does for free.

**3. [Pedagogical] Recognition-direction review produces usable English.** See 2.1. Likely wrong.
Damage: six months of diligent use produces passive knowledge, the learner concludes "it didn't
work," and you never see the attribution because the engagement metrics looked fine throughout.

**4. [Business] Local-first is a purchase reason.**
You list it first among differentiators. Privacy is a strongly stated preference and a weakly
revealed one almost everywhere. For this segment it is more plausibly a *cost*: local-first is why
there is no phone review, and a phone is where a 20–30-minute-a-day learner actually studies — on a
bus, in a queue, between meetings. You have traded the highest-frequency study context for a
property users say they want and rarely pay for.

**5. [Pedagogical] Provider-free feedback is good enough to activate on.** See 2.3. The zero-setup
path exists to protect activation, but it makes "mistakes become drills" demonstrably shallow at
exactly the moment W5 measures whether users notice that differentiator unprompted.

---

## 5. Competitive reality check

The competitive table in `product.md` is the most clear-eyed I have seen in a repository of this
kind, and it already concedes most of the correct ground. So this section only adds what it does
not say.

**Why someone would use this instead of the alternatives — honestly.** For a learner with 20–30
minutes a day: ChatGPT gives better correction than your provider-free path; YouTube gives input
for free; Anki schedules better and syncs to their phone; an italki tutor gives production practice
with a human who reacts. Your one real answer is *the automation of the seams between those steps*
— and it is a genuine answer. Nobody has made source → phrase → audio card → correction → review a
single continuous motion. That is a real product insight and it is why this project is worth
finishing.

**Is it a moat? No. It is a feature.** Migaku already owns the browser-capture half and could bolt
on correction in a sprint. LingQ owns import and context. Any of them can add "turn your mistakes
into cards" as a checkbox, and they have distribution you do not.

**Local-first is not a moat.** It is a constraint you have labelled a virtue. It is copyable in the
only sense that matters — a competitor doesn't need to copy it, they need to make it irrelevant,
and cloud sync already does.

**Where the actual moat is, if there is one.** You named it yourself in `product.md`: *"Cards são
derivação; fontes e histórico de erros são os ativos."* A learner's multi-month personal error
history genuinely cannot be copied — a competitor starting today has none of it, and cannot
retroactively acquire it. But an asset is not a moat until it does something. Today that history
feeds a weakness list, which is table stakes.

It becomes a moat the day the product can say: *"You have made this same mistake fourteen times
across three months, in these four contexts, and here is the pattern underneath them."* No
competitor can produce that sentence for your user, at any price, without three months of that
user's history. That is your one defensible direction, it is the natural extension of the
architecture you have already built, and it is nowhere on the roadmap.

---

## 6. Three falsifying experiments

All runnable solo, each under two weeks, designed to prove you wrong rather than confirm you.
Ordered — do not run E2 or E3 before E1 resolves.

### E1 — Does the ICP exist, and can you reach it?

- **Hypothesis:** ten qualified Brazilian A2-B1 self-learners with Apple Silicon Macs can be
  recruited in fourteen days.
- **Method:** post `docs/w5/recruiting-message.md` to r/ingles, r/brasil, Anki-BR Telegram and
  Discord groups, English-study Instagram and TikTok comment sections, and LinkedIn. Screen against
  all ICP filters. Count *scheduled sessions*, not expressions of interest.
- **Sample:** 10 scheduled qualified participants.
- **Proves you wrong:** fewer than 10 scheduled after fourteen days of active posting. More
  diagnostic still: track how many otherwise-perfect candidates fail *only* the Mac filter. If that
  ratio is high, the platform is the problem and web is the pivot — and you will have learned the
  single most important fact about this project for free.
- **Cost:** zero. This is a precondition for W5 regardless, so running it costs nothing you were
  not already committed to.
- **Time:** 14 days.

### E2 — Is the promise compelling before anyone installs anything?

- **Hypothesis:** the five-second promise converts qualified attention into signups, and people
  name the differentiator without being prompted.
- **Method:** record the 60–90 second video from `docs/w5/demo-video-script.md` — **with the audio
  claim corrected to match reality first** (section 3.1) — and post to the same communities, plus
  one small paid test. Measure waitlist conversion, and read every comment.
- **Sample:** 500+ qualified views, ~20 comments.
- **Proves you wrong:** under 2% view→waitlist conversion, **or** zero unprompted mentions of
  native audio, mistakes-becoming-practice, or faster-than-Anki in the comments. Either result
  kills the differentiation gate before you spend a single moderated session on it.
- **Cost:** a few hours; optional R$100–200 ad spend.
- **Time:** 7 days.

### E3 — Is the manual pain real?

- **Hypothesis:** making one audio flashcard from a real source takes an Anki user long enough to
  hurt.
- **Method:** six Anki-using learners, screen-shared and timed. Task: "make one flashcard from this
  30-second YouTube clip, exactly the way you normally would." Then time the same task in
  PhraseLoop. Ask afterwards whether they would switch.
- **Sample:** 6. You are looking for an order of magnitude, not a p-value.
- **Proves you wrong:** median manual time under 4 minutes — **or**, the likelier and more damaging
  result, four or more of the six saying "I don't put audio on my cards at all." That kills the
  audio differentiator directly and reduces the wedge to text extraction.
- **Cost:** your time.
- **Time:** 7 days.

---

## 7. Metrics

Three. Two of them do not exist yet.

| Type | Metric | Definition |
| --- | --- | --- |
| **Learning outcome** | **D+30 unaided production rate** | Percentage of saved phrases the learner produces correctly PT→EN, from memory, with no options shown, on items unseen for at least 7 days. Requires fixing 2.1 first. This is the only number that distinguishes learning from familiarity. |
| **Habit** | **D+7 unprompted return rate** | From the local activity log, never self-report. Your existing W5 threshold of 25% is well chosen. |
| **Wedge** | **Own-source completion rate** | `own_source_started → own_source_completed`. Bundled lessons prove nothing about your differentiator; only a learner's own material does. |

### Where engagement metrics will lie to you, specifically

- **Cards created, lesson completion, weekly minutes** are activity, not acquisition. Your own
  roadmap already warns "do not use lesson completion alone as evidence of learning." Hold that
  line hardest against `learningLoop.ts`'s `weeklyMinutes`, which is the most seductive number in
  the codebase precisely because it is synthetic but *looks* measured (section 2.4).
- **FSRS predicted stability and retention** are model outputs, not observations.
  `validation-action-plan.md` already says "do not treat predicted SRS retention as observed user
  retention" — good. But the code makes violating this trivial: the number is right there in
  `SessionSummary`, it is always encouraging, and it is generated by the same model whose
  assumptions you would be trying to test.
- **"Good" grade rate in Study** is the worst of them. With EN→PT cards and audio on the front, it
  measures recognition confidence. It will be high, it will trend upward, and it will mean nothing
  about whether the learner can speak.

---

## 8. Kill criteria

Numeric. Framed in attempts rather than months, because a solo project with no deadline and no
money at risk cannot be disciplined by a burn rate — only by pre-committed thresholds.

- **E1 fails** — fewer than 10 scheduled qualified ICP participants after 14 days of active
  recruiting → the Mac-only Brazilian ICP is not reachable. Pivot the platform to web, or pivot the
  segment. Produce zero further lesson content until this resolves.
- **E3 shows** median manual card-creation time under 4 minutes, **or** ≥4 of 6 participants don't
  put audio on cards → the wedge is not a pain. Reposition on the error-history asset (section 5)
  or stop.
- **W5 unaided completion < 6/10** → do not touch the 100-lesson roadmap. Not one lesson. Fix the
  first blocking step and re-run.
- **W5 explain-back < 7/10 after two full revision cycles** (30 sessions total) → the wedge story
  does not exist in users' heads, and more copy revisions will not put it there.
- **D+7 return < 25% across two consecutive 10-person cohorts** → the habit does not form. Spaced
  repetition alone is not carrying it, and every remaining roadmap item is decoration on a product
  people do not come back to.
- **Paid pain: fewer than 3/10 name the same non-`none` pain across two cohorts** → there is no
  business here. This is a legitimate endpoint rather than a failure. Make it free, open-source it,
  keep it as craft. But then *delete* the billing hypothesis, the R$19–39 willingness-to-pay
  questions, and the 100-lesson roadmap — because they are consuming real hours in service of a
  business you will have decided not to run.
- **Method-level:** after fixing 2.1, if D+30 unaided production is under 40%, the problem is
  content selection and level calibration, not scheduling. Do not respond by building more adaptive
  logic.

---

## 9. Where I am genuinely uncertain

Stated explicitly so you can discount these claims appropriately.

- I have no reliable data on Apple Silicon Mac ownership among Brazilian English self-learners. My
  argument about ICP size is directional, not quantified. E1 exists to settle it cheaply, and it
  should be run before you weight my commercial score heavily.
- Optimal skill-area balance ratios are genuinely under-determined in the literature. My criticism
  of `learningLoop.ts` is that it presents invented numbers as derived ones — **not** that I know
  better ratios. I don't.
- Whether desirable-difficulty effects survive in low-motivation self-study contexts is contested.
  Your scaffold and cooldown design hedges this sensibly, and I am not going to second-guess it
  without your own D+1/D+7 data.
- Productive-direction review is well supported for production outcomes, but the *size* of the
  transfer advantage varies considerably across studies. My claim in 2.1 is directional. It is
  nevertheless decisive in your case, because the receptive direction is currently the only one
  you ship.

---

## 10. The question you should be asking and probably aren't

> **Am I building PhraseLoop because I want Brazilian A2-B1 learners to have it, or because
> building it is the part I enjoy and handing it to an indifferent stranger is the part I'm
> avoiding?**

Twenty-two days between a finished recruiting script and zero recruited participants, with three
feature commits in the intervening week, is already an answer. The question is whether it is the
answer you want.

If the honest answer is "I'm doing this for the craft" — that is genuinely fine. Given no deadline,
no team, and no money at risk, it may be the correct answer, and the codebase is good enough to
justify it on those terms alone. But in that case the W5 gate, the 100-lesson roadmap, and the
monetization hypothesis are theatre, and they are costing you hours the craft version does not
need.

Pick one. Then delete the scaffolding for the other.
