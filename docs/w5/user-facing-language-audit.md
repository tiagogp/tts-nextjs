# W5 User-Facing Language Audit

This audit covers everything a W5 participant can see or hear before the decision is recorded:
first-run Home, the bundled lesson, sentence correction, the review handoff, consent, moderator-spoken
questions, and D+1/D+7 messages. Internal event names and capture labels may remain technical when
they are not read aloud.

Public landing-page, demo-video, recruiting, waitlist, influencer, and marketing copy is deliberately
not being revised before the W5 result. Findings for those surfaces are recorded below so the work
does not silently turn into pre-validation positioning.

## Language Rule

Before the participant completes the first task, prefer a visible action and outcome over a product
abstraction.

| Avoid | Say instead |
| --- | --- |
| loop / learning cycle | listen, save, review, write, correct |
| activation / funnel / dropoff / TTFR | first task, time to finish, where the person stopped |
| source / source-native audio | video, article, PDF / original audio from the video |
| card / deck | phrase to review; use “card” only when the participant already uses that word |
| provider / model / APKG / curation | name the concrete choice or omit it from first run |
| setup / sync / managed generation | install or configure / progress kept up to date / phrases and audio prepared for you |
| native clip | original audio from the material; never use “native” for Kokoro TTS |

## Audited Surfaces

| Surface | Finding | Action before W5 |
| --- | --- | --- |
| Onboarding | Named both intended differentiators before the unprompted question and claimed the blocked bundled audio was real/original. | Replaced with the literal actions: listen, save, and write. The task must provide the proof. |
| First-run Home | Named original audio and mistakes before the task and called saved phrases “review cards.” | Replaced with the literal first-lesson actions. |
| Bundled lesson | Instructions are action-led. Completion and sentence-help copy used “review card.” | Changed to “phrases saved for review” and “practice the corrected version tomorrow.” |
| Study handoff | Uses concrete “review,” “phrase,” and “tomorrow” language. | Keep. |
| W5 Settings readout | Moderator tool exposed “activation,” “loop,” “dropoff,” and “funnel” if a participant opened Settings. | Replaced visible labels with first task, where the task stopped, and own material import; internal event names stay unchanged. |
| Consent | Clear and free of product-process jargon. | Keep. |
| Moderator questions | Price options used `setup`, `sync`, and abstract packaging labels. | Replaced with concrete learner outcomes; order and price stay fixed. |
| Follow-up messages | Used `follow-up` and `card` in participant copy. | Replaced with “retorno” and “frases para revisar.” |

## PT-BR Completeness (first session) — 2026-07-13

Follow-up pass covering hardcoded-English (and reverse hardcoded-Portuguese) defects on every
surface reachable in the first session, closing launch-checklist item 3 in docs/product.md.

Already clean, verified key-by-key against `src/i18n/messages.ts` (no missing keys, no unwrapped
strings): Onboarding, first-run Hoje, the bundled lesson (LessonView, MistakeStep,
TranscriptReview), Study surfaces, consent, and the W5 Settings readout.

Fixed in this pass:

| Surface | Defect | Fix |
| --- | --- | --- |
| Correct tab (all 6 components) | No i18n at all: static UI hardcoded English, generation stages hardcoded Portuguese (broken for B1+ too). | Wired `useT()` throughout; both directions now resolve from `messages.ts`. |
| Error-type tags | Raw enum slugs (`word-order`) shown in Correct, Study, and deck previews. | New `src/lib/cards/errorTypeLabels.ts` map rendered through `t()`. |
| Study list preview (DeckPreview) + AI picker (ProviderPicker) | Hardcoded English; Discover passed a PT title using "cards". | Wired `useT()`; Discover title now "Prévia das frases de prática". |
| Discover source picker | "Article URL" raw English; group label hardcoded Portuguese. | Both via `t()`. |
| App chrome | English `aria-label`s (nav, dark mode, settings, back buttons); "Advanced tools" overlay untranslated. | All via `t()`. |
| Document metadata | `<html lang="en">` static; stale description about the old TTS tool. | Static default `pt-BR`, re-stamped at runtime by `I18nProvider` when the profile resolves to English; PT-BR description. |
| Electron loading screen | First screen on launch all English; error/rotation routing regexed English copy. | PT-BR strings; `setStatus(text, kind)` protocol replaces copy-matching regexes. |
| Hoje return-day copy | English "cards" inside PT strings. | "frases". |

Deliberately left (outside the first-session path, recorded so this does not read as missed):

- Advanced tools content (Speech tab, ThemePhraseGenerator, Anki exporter) — tier-3 surfaces behind
  Settings; `exportDeck.ts` success messages ("N cards sent to Anki") included.
- `PlanOnboarding` provider/model jargon (requires an AI provider; not the beginner path).
- English keys themselves still say "cards" in a few Hoje return-day strings — the key is the B1+
  English display; revisit with W5 explain-back verbatims, same rule as external copy.

## Deferred External Copy

Do not act on these until W5 has a result:

- The landing page uses “ciclo/loop” as a central narrative and contains technical trust language.
- The demo script uses “card” repeatedly and is already blocked on genuine original audio.
- The recruiting message describes the product before the unaided session and uses “cards” and
  “follow-ups.” It must remain frozen with all outreach.

After W5, use participants' verbatim explain-backs to decide whether any of those words belong in the
public narrative. Do not replace them with new marketing language from this audit alone.
