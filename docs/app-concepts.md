# PhraseLoop — App Concepts

This is the concise, unified reference for PhraseLoop: what it is, how its learning
loop works, the principles behind it, and what is deliberately not yet part of the
launch product. For implementation detail, use [README.md](README.md); for product
decisions and current priorities, use [product.md](product.md).

## 1. Product in one sentence

PhraseLoop helps Brazilian A2–B1 English self-learners turn real English and their own
mistakes into a calm daily review habit with source-native audio, on a Mac.

The core promise is not “another flashcard app.” It removes the work between material a
learner already cares about and useful practice:

```text
real English or personal output
        ↓
useful phrase / identified mistake
        ↓
active-recall review card with audio
        ↓
spaced review, performance history, and targeted reinforcement
```

The launch wedge is Portuguese-speaking, serious A2–B1 self-learners who already use
YouTube, articles, PDFs, Anki, or a similar process. The product is desktop-first,
local-first, and English-first (PT → EN).

## 2. The learning thesis

PhraseLoop is designed as a closed learning cycle:

```text
capture → study → produce → reinforce
```

- **Capture:** bring real material into the app or save a correction from personal output.
- **Study:** use active recall and spaced repetition rather than passive rereading.
- **Produce:** write or speak using the language; this creates meaningful evidence of gaps.
- **Reinforce:** turn recurrent, source-grounded gaps into focused review and new card variants.

The long-term idea is a personal tutor with memory. Its defensible asset is not merely
generated cards: it is the learner’s longitudinal history of chosen phrases, mistakes,
reviews, contexts, and outcomes.

## 3. Two inputs, one learning system

There are two ingestion paths that intentionally converge.

| Path | Learner starts with | Stored source | Result |
| --- | --- | --- | --- |
| **Discover** | YouTube, article URL, or PDF | `PhraseCandidate` | Useful phrases from real content become cards. |
| **Correct** | A sentence or spoken/written mistake | `ErrorEvent` | The learner’s own error becomes a corrective card. |

Both paths use the same card contract, quality checks, local store, SRS scheduling,
analytics, and export options. Cards are derived data; `PhraseCandidate`s and
`ErrorEvent`s are the durable source of truth.

## 4. Discover: learn from real material

Discover takes a source through three deliberate stages:

```text
extract → curate → review → generate
```

1. **Extract.** YouTube audio is transcribed with Whisper; article and PDF text is
   extracted and split into sentences. YouTube segments retain timestamps.
2. **Curate.** A chosen provider selects promising phrases, optionally using a focus such
   as phrasal verbs or business vocabulary. Local selection is available as a fallback.
3. **Review.** The learner accepts, rejects, or edits suggestions. Only accepted phrases
   proceed to card generation.
4. **Generate.** The system creates one or two active-recall cards per accepted source,
   evaluates them for quality and grounding, and removes duplicates.

The native-audio differentiator applies when the source has timestamps: PhraseLoop slices
the exact original clip and embeds it in the card. Text-only sources fall back to Kokoro
TTS for answer audio.

## 5. Correct: learn from personal mistakes

Correct turns a learner’s original and corrected sentence—plus optional error type and
rationale—into an `ErrorEvent`. The same generation pipeline creates cards that contrast
what the learner said with the natural/correct alternative.

This makes mistakes productive rather than disposable:

```text
learner writes or speaks → correction → ErrorEvent → review card → SRS history → weak spot → drill
```

Conversation practice can feed this same route at the end of a session, tagged with a
situational context such as `job-interview` or `restaurant`.

## 6. Card intelligence and quality

A generated card has more than a front and back. It preserves the concept being tested,
error type, optional context, source link, and answer audio. This supports active recall,
traceability, and later analysis.

The provider-independent quality pipeline is:

```text
generate → attach source grounding → critique (keep/rewrite/drop) → semantic deduplication
```

- **Grounding:** the source pointer is set and checked by application code, not trusted to
  the language model.
- **Critique:** cards that are weak, misleading, or unsupported are rewritten or dropped.
- **Deduplication:** semantic embeddings are used when available; lexical similarity is the
  offline fallback.
- **Provider choice:** local/Ollama, OpenRouter, Claude, and OpenAI can use the same
  provider contract. Cloud processing occurs only when the learner explicitly selects it.

Export remains an optional depth feature: cards can be studied in PhraseLoop or exported as
`.apkg`, CSV, or text; AnkiConnect can reduce import friction.

## 7. Study: the daily review habit

Study is the primary destination after capture. Cards are scheduled with FSRS, begin due
immediately, and are answered using Again, Hard, Good, or Easy. The learner sees the next
interval before grading.

Every review adds a `ReviewRecord`, including the card’s concept, error type, and context.
This denormalized record keeps historical analysis intact even if a card is deleted.

Study provides:

- Due-card review and active recall.
- Accuracy, lapses, daily activity, streaks, and review trends.
- Optional scaffolds such as hints, slower audio, and listen-and-repeat.
- Calm/light sessions when fatigue or overload is likely.
- A session end state that separates current-session accuracy from predicted retention.

The product favors retrieval practice and spacing. Difficulty is useful only when it helps
learning; immediate performance is not treated as proof of retention.

## 8. Weaknesses and reinforcement: the tutor loop

PhraseLoop analyses review history by concept, error type, and context. A weakness is ranked
by struggle rate, after a minimum amount of evidence, and can show whether it is improving,
worsening, or stable.

Weaknesses lead to action rather than a passive dashboard:

```text
review evidence → weakness detected → focused drill or fresh variants → more review evidence
```

- **Reforçar:** brings all relevant cards into a focused session, regardless of normal due
  date.
- **Gerar +:** finds the original phrases/errors for a weakness and produces new, grounded
  variants that test the same idea from another angle.

This is the core “tutor” concept: adapt what is practiced using genuine learner evidence,
not an abstract level label alone.

## 9. First-run experience

The visible first session is intentionally smaller than the full product. It must prove the
value without an AI key, Ollama setup, or Anki knowledge:

```text
hear a curated clip → save a phrase → review it → write a sentence →
receive a correction → save the correction for tomorrow
```

At the end, the learner should understand that they created two review cards: one from real
English and one from their own mistake. Only then should PhraseLoop invite them to import a
personal source.

The desired first-loop time is under two minutes. Advanced terms—including provider, model,
deck, APKG, and curation—must remain out of the initial path.

Bundled lessons and local correction support a zero-setup loop. However, real native clips
for the bundled first lesson are still a launch blocker: Kokoro is acceptable as a fallback
but must not be presented as native-source audio.

## 10. Local-first trust model

Learning data lives in browser IndexedDB by default:

```text
phraseCandidates, errorEvents, cards, srs, reviews,
conversations, activityLog, learningPlan, effortHistory,
pronunciationAttempts, progressAssessments
```

The desktop application runs in Electron with a local Next server. Server-side local services
handle native audio, Whisper, Kokoro, yt-dlp, card packaging, and provider runtime. The public
landing page is a separate Vercel application.

Trust commitments:

- Nothing leaves the device unless the learner chooses a cloud provider.
- Settings disclose the real local-data location and can wipe personal local data.
- Backup supports dry-run validation and restore; restore merges by ID rather than deleting
  newer records.
- Imported source-audio cache is not part of the backup; cards without it can fall back to TTS
  until the source is re-imported.

## 11. Supporting product concepts

These capabilities exist, but are secondary during validation.

| Concept | Role |
| --- | --- |
| **Home / Today** | Presents one clear next action, a gentle return moment, and current progress. |
| **Guided lessons** | Provides a dependable no-setup first loop before a learner brings a source. |
| **Conversation** | Spoken or typed practice in a chosen scenario; end-of-session corrections can become context-tagged cards. |
| **90-day plan** | LLM-generated daily tasks linked to Discover, Study, Converse, and Correct; adapts using observable activity and effort. |
| **Activity log** | Records actual actions, allowing plans and weekly effort to reflect behavior rather than self-report. |
| **Adaptive cycle** | Uses review signals, fatigue, and scaffolds to balance challenge, consolidation, and lighter sessions. |
| **Pronunciation / progress** | Supporting assessment surfaces; not the primary launch promise. |

## 12. Design language

The interface takes inspiration from Intercom’s warm, editorial clarity:

- Warm off-white surfaces, off-black text, warm oat borders, and a single orange accent.
- Sharp geometry: 4px-radius buttons and restrained 8px cards, with almost no shadows.
- Tight, negatively tracked display headings; simple readable body text.
- Clear, calm hierarchy rather than dense dashboards or gamification.

The product should feel focused and reassuring: a learner sees the next useful action rather
than every available tool.

## 13. What W5 is validating

W5 is the pre-launch decision gate. It tests whether fresh users can complete and understand
the first loop without coaching, then return.

For a ten-person ICP decision round, the gate requires:

| Signal | Threshold |
| --- | --- |
| Unaided first-loop completion | 6/10 |
| Median time to complete first loop | Under 2 minutes |
| Explain-back of the value | 7/10 |
| Return | D+1 ≥ 40%; D+7 ≥ 25% |
| Unprompted differentiator | 3/10 |
| Same concrete paid pain | 3/10 |
| Would replace current card-making flow for seven days | 3/10 |

The differentiators participants should discover on their own are original/native source
audio and personal mistakes becoming drills. The own-source funnel—complete the guided loop,
then begin and complete an import of personal material—is the key conversion after activation.

The current W5 decision record is **pending**: no decision-round participants have yet been
scored. Until that evidence exists, a friendly response or a large feature list does not change
the roadmap.

## 14. Current constraints and next decisions

The app is in a validation phase, not broad-launch mode. New feature work is frozen on Speak/
Converse, the 90-day plan, adaptive-band/cycle research, theme generation, AnkiConnect, and
per-task provider overrides, except crash fixes.

Before recruiting, the material outstanding work is:

1. Produce a signed and notarized macOS build.
2. Complete a moderator dry run on a wiped clean install.

The W5 outcome decides the next move:

- Activation or comprehension fails: simplify the front door, then re-test.
- Differentiation fails: correct the positioning and visible proof first.
- Replacement fails: keep it a research build; do not launch broadly.
- Paid pain is scattered: billing stays frozen.
- A clear pass plus retention: advance through trust proof, focused positioning, and only then
  reopen deeper tutor work.

Future expansion—mobile sync, broad multi-language support, billing, school/B2B features,
public “AI teacher” positioning, advanced C1 naturalness feedback, and new adaptive-difficulty
work—remains conditional on this validation.

## 15. Concept status at a glance

| Status | Meaning | Examples |
| --- | --- | --- |
| **Shipped foundation** | Exists and supports the core learning loop. | Discover, Correct, card quality pipeline, FSRS Study, local store, reinforcement. |
| **Visible validation wedge** | The small experience being tested now. | Guided native-audio lesson → review → correction → own-source bridge. |
| **Secondary / hidden depth** | Built, but should not distract from the wedge. | Export, provider setup, Converse, 90-day plan, advanced speech tools, C1 diagnosis MVP (experimental, pre-W5 exception — see [c1-phase-proposal.md](c1-phase-proposal.md)). |
| **Blocked / gated** | Cannot drive scope until W5 evidence permits it. | Billing, mobile sync, the rest of the C1 phase (content ladder, multi-domain builder, skill/fluency dashboards), broad multi-language, tutor expansion. |

## Source documents

- [Product direction and roadmap](product.md)
- [100-lesson content roadmap](100-lesson-roadmap.md)
- [Architecture and build record](README.md)
- [Validation action plan](validation-action-plan.md)
- [W5 validation protocol](w5-validation-protocol.md)
- [Project structure](project-structure.md)
- [Design system](design-system.md)
- [C1 phase proposal](c1-phase-proposal.md)
- [W5 materials](w5/)
