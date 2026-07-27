# Adversarial Audit — Implementation Record

Date: 2026-07-25
Scope: what was changed in response to [adversarial-audit.md](adversarial-audit.md), what was
deliberately left, and what is not a code problem at all.

The audit is not edited by this document. It stays as written, including the parts this record
does not resolve.

---

## Done

### §2.1 Review cards trained recognition, not production — **fixed**

`Card` now carries an explicit `direction` (`src/lib/cards/schema.ts`), and
`buildDeckFromPhrases()` emits **both** halves of every kept phrase as independent cards:

| | front | back | audio |
| --- | --- | --- | --- |
| `production` (new, first in the deck) | `phrase.pt` | `phrase.en` | plays **after** the reveal |
| `recognition` (pre-existing id, so old SRS state survives) | `phrase.en` | `phrase.pt` | plays on the prompt |

FSRS schedules them separately because they are separate card ids. Consequences worth knowing:

- **Deck size and daily load double.** 8 kept phrases now create 16 cards, all due immediately.
  This is the trade the audit proposed ("let FSRS schedule them independently"); the intervals
  diverge from the second review onward, since production will be graded worse than recognition.
- Both siblings are due on day 1, so a learner can meet the same phrase twice in one session.
  Burying siblings would mean changing the queue builders in `src/features/study/sessionMode.ts` /
  `bandQueue.ts`, which are frozen under `AGENTS.md`. Left alone deliberately — see *Open*.
- `orientCardsForTargetFront()` no longer touches a card that declares a direction. Without that
  guard the read-time heuristic silently flipped every production card back to English-front.
- Anything that speaks or scores a card now reads the English side through `targetTextOfCard()`
  instead of assuming `front`.
- `MistakeStep`'s own-sentence card is untouched. Its back is the *lesson phrase's* translation,
  not a translation of the learner's sentence, so a PT-front prompt there would not match its
  answer. Listed under *Open* rather than quietly changed.

### §2.2 The comprehension check did not check comprehension — **partly fixed, and now honest**

The content problem is unchanged: **36 of 36** bundled lessons still have empty `dialogue` and
`comprehension`. What the code no longer does is present the fallback as listening comprehension.

- The `"What is the main situation?"` question is **deleted**. Its answer was `lesson.topic`,
  readable off the lesson title without playing a clip; it inflated the pass rate.
- Answer position is re-placed per attempt (`buildListeningChallenge(…, { seed })`, bumped on each
  failed check) instead of being fixed by a hash of the lesson id.
- The challenge reports `synthesized: true` when it was generated from the phrases just taught.
  The lesson UI now says so in plain Portuguese ("this is a recall check on the phrases you just
  studied — not a test of understanding new speech"), and
  [100-lesson-roadmap.md](100-lesson-roadmap.md) records that the 35–85% listening-accuracy gate
  does not apply to synthesized checks.

The remaining fix is authoring dialogue and comprehension items for the existing 36 lessons. That
is content work; it is not attempted here.

### §2.3 "Your mistakes become drills" was mostly typos — **fixed**

New module `src/features/learn/transferErrors.ts`: 21 deterministic, on-device rules for the
predictable PT→EN transfer errors, wired into `correctSentenceLocally()` as **blocking** `grammar`
issues, so the retry gate will not accept a sentence that still carries one.

Covered: age with *have*, article omission before a role, *depend of*, *arrive to*, *people is*,
*married with*, *explain me*, *say me*, *I am agree*, *in Monday*, *good in*, *listen music*,
*make a question*, uncountable plurals, *more good*, present tense with *since* (three rules,
covering the verb, *have*, and *be*), purpose *for* + verb (two rules, one gated on a motion verb),
and the existential *tem* pattern.

Design constraint, enforced by tests: **precision over recall.** A false positive blocks a correct
sentence and teaches the learner something untrue, so every pattern is one where the English is
wrong essentially every time it matches. Three guards in
`src/features/learn/transferErrors.test.ts`:

1. each canonical error rewrites to the expected English;
2. a list of correct sentences — including the legal noun readings *for study*, *for work*,
   *I have no doubt*, *there are many parks* — must pass untouched;
3. **none of the 292 bundled lesson phrases may trigger any rule.**

`existential-have` flags without rewriting: "In my city has many parks" needs restructuring, which
is the retry's job, not a substitution's. This is a transfer-error checker, not a grammar checker,
and the README now says exactly that.

### §2.4 `learningLoop.ts` invented its measurements and its targets — **removed**

Deleted: `src/features/method/learningLoop.ts`, its test, and
`src/features/study/components/MethodBalance.tsx`. `HojeHome` no longer routes the learner's next
action through `weakestArea()`, and Study no longer renders target-vs-actual percentage bars.

Home falls through to the branches that were already there and are all observable: due cards →
Study, saved mistakes → Correct, caught up → practice a phrase, no phrases yet → first lesson.
Nothing that was measured is lost, because nothing it reported was measured.

### §3.1 The provenance claim — **copy corrected everywhere**

`native-audio/manifest.json` is `[]`; all 292 bundled clips are Kokoro TTS. Changed:

- **Landing** hero eyebrow: "Áudio original" → "O áudio da sua fonte". The audio feature body now
  adds "As lições que já vêm no app usam áudio gerado no seu Mac." The own-source claims
  ("trechos de vídeos mantêm o áudio original") were already true and are untouched.
- **README**: the five-second promise, the differentiator bullet, and the head-to-head row no
  longer say "native-audio" unconditionally, and the bullet states outright that nothing shipped
  in the box is native-source audio, naming `scripts/generate-learn-audio.mjs`.
- **In-app**: the lesson listening step discloses provenance where the audio actually plays.
- **[w5/demo-video-script.md](w5/demo-video-script.md)**: the honesty gate is now stated at the
  top, and shot 2's line is replaced with a true one.
- **[w5/capture-table.md](w5/capture-table.md)**: "Native audio noticed?" → "Audio noticed?",
  with a note that a participant praising native audio in a bundled session has been misled.

Recording or licensing real audio for the first three lessons is the other half of the audit's
recommendation and is not code work.

### §7 Metrics — **the two missing ones now exist**

| Metric | Where |
| --- | --- |
| **D+30 unaided production rate** | `src/features/activation/outcomeMetrics.ts`, surfaced in the moderator readout (`?w5=1` → Settings → W5 validation) |
| **D+7 unprompted return** | already existed (`returnedDay7`) |
| **Own-source completion rate** | reported by `yarn w5:score`, from the capture table's own-source columns |

`computeUnaidedProduction()` counts a review only when it is a **production** card, answered with
**no scaffold** (`scaffoldLevel` 0 and `hintUsed` false), at least **7 days** after the learner's
previous review of that same card, inside a 30-day window; correct means Good or Easy. It returns
`rate: null` — never `0` — when nothing qualifies, because "not measured" and "measured and bad"
are different facts. `ReviewRecord.direction` is denormalized at record time so the metric
survives card deletion, and reviews from before directions existed never count (they are all
receptive).

Own-source completion is **reported, not gated**: the audit sets no threshold for it, and adding an
eighth gate would change the decision routing, which is not a code decision.

---

## Open — deliberately not done

Each of these is either the user's call or not a code problem.

1. **§0 and §10 — run the protocol, or delete it.** The audit's central claim is that the
   apparatus exists and has never been run: 0/10 rows, every gate `Pending`. Nothing in this
   changeset addresses that, and nothing in it can. Row `W5-01` is still the only thing that
   matters.
2. **E1 / E2 / E3.** Recruiting, the demo video, and the timed manual-card-creation study are
   fieldwork. E2 is now unblocked in the sense that the script no longer requires a false claim.
3. **Kill criteria (§8).** Pre-committing to thresholds is a decision, not an implementation.
   Note that the D+30 production kill criterion ("under 40% → the problem is content selection and
   level calibration") is now computable — the moderator readout marks 40% as the boundary.
4. **Authoring dialogue + comprehension for the 36 existing lessons.** The blocker behind §2.2.
   `scripts/validate-lesson-content.mjs` already enforces this for roadmap lessons.
5. **Real audio for the first lessons.** Recording or licensing; `native-audio/` is the intake.
6. **Sibling burying for the new card pairs.** Would need frozen queue code
   (`sessionMode.ts` / `bandQueue.ts`). Worth revisiting if day-1 load reads as heavy in a session.
7. **`MistakeStep`'s own-sentence card direction.** Making it a production card needs a Portuguese
   prompt for the learner's *own* sentence, which the provider-free path does not have. A cloze of
   their corrected sentence is the obvious candidate; it is a design change, not a fix.
8. **§5's moat direction** — "you have made this mistake fourteen times across three months, in
   these four contexts, and here is the pattern underneath them." Untouched, and still nowhere on
   the roadmap.
9. **The macOS constraint (§4, risk 1).** Not a code change. E1 settles it.

---

## Verification

- `npx tsc --noEmit` — clean.
- `yarn lint` — clean.
- `yarn build` — succeeds.
- `yarn vitest run` — 362 passing; **1 pre-existing failure**, confirmed against a clean tree
  before this work: `apps/landing/…/landingLanguage.test.ts > keeps Portuguese as the W5 default`.
  (`lessonDeck.test.ts > points every bundled phrase clip at a shipped file` also failed until
  `yarn build` ran its `prebuild` → `yarn learn:audio` step and generated the 292 clips into the
  git-ignored `public/learn/audio/`. It passes now.)
- `yarn dev` serves `/app` with status 200 and no runtime errors.
- No browser-driven verification: this machine has no Chromium and no Playwright, so the guided
  lesson and the Study card were not driven by hand. The behaviour changed here is covered by unit
  tests (`lessonDeck`, `lessonFlow`, `transferErrors`, `localCorrection`, `orientation`,
  `outcomeMetrics`) plus the production build; the audio-placement branch in `StudyCard` and the
  new lesson copy have no test and should be eyeballed once on a machine with a browser.
- `graphify update .` was **not** run — the CLI is not installed here, so `graphify-out/` still
  describes the deleted `learningLoop.ts`.
