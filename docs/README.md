# PhraseLoop — Architecture & Build Record

Technical source of truth for the card pipeline, architecture, and shipped build history.
Product direction and active priorities live in [product.md](product.md); visual/UI rules live
in [design-system.md](design-system.md); repo layout and module ownership live in
[project-structure.md](project-structure.md); user-facing setup and the feature list live
in the [root README](../README.md).

**Contents**

1. [What this is](#1-what-this-is)
2. [The card pipeline — architecture](#2-the-card-pipeline--architecture)
3. [Card pipeline — build status](#3-card-pipeline--build-status)
4. [Pre-launch TODO](#4-pre-launch-todo)
5. [Conversation practice — shipped](#5-conversation-practice--shipped)
6. [Structured 90-day learning plan — shipped](#6-structured-90-day-learning-plan--shipped)

---

## 1. What this is

PhraseLoop helps Portuguese-speaking English learners turn real English into native-audio
review cards and a calm daily study habit on desktop first, with review-anywhere surfaces
planned next.

It extends a TTS + `.apkg` exporter into a system that builds spaced-repetition cards from
real material, with **native audio**, and drills your weak spots over time — 100% local by
default. This repo already owns the *output* half (audio + `.apkg`); the card work adds the
*inputs* (discovery + correction) and the *brain* (pluggable generation + quality gate).

**The vision:** drop in material (PDF, YouTube, article) → get **active-recall exercises**
and **spaced flashcards** whose questions test understanding, not literal memorization →
over time an SRS engine, performance tracking, and weakness detection turn it from a
generator into a **tutor**.

---

## 2. The card pipeline — architecture

### Two ingestion paths, one output

1. **Discovery (priority).** Mine phrases worth learning from native content — YouTube,
   podcasts, articles, PDFs. This is where most new learning comes from.
2. **Correction.** Turn your own mistakes (from the native-correction tool) into cards that
   drill exactly what you got wrong.

Both converge on the same `Card` and the same `.apkg` export.

```
ingestion                         generation (pluggable)        export (already built)
─────────                         ──────────────────────        ──────────────────────
YouTube/podcast ─ yt-dlp (audio   Provider.generate() ────┐
  only, no mp4) ─ Whisper (ts)    (Local | Claude | GPT)   │
  → PhraseCandidate + clip ───────►                        ├─→ Card[] → CSV/JSON → apkg
                                  Provider.critique() ─────┘            (+ native clip / Kokoro)
native-correction tool ─────────►  (keep | rewrite | drop)                      → Anki
  → ErrorEvent                              │
                                  Store (local-first) ←── persists every source + Card + review
                                            │
                                  weakness detection (tutor)
```

### YouTube: audio only, with per-phrase native clips

The mp4 is dead weight — only the audio carries learning value.

- **Download:** external `yt-dlp` binary (`bestaudio`, extracted to m4a when ffmpeg is
  available). youtubei.js can no longer decipher stream URLs, so yt-dlp is a hard requirement
  for YouTube import (`brew install yt-dlp`). Faster, smaller, no video.
- **Transcript + timing:** Whisper for segment timestamps (the YouTube.js captions fast path
  was removed along with stream deciphering).
- **The payoff:** with timestamps we cut the *exact* native audio clip for each phrase and
  embed it in the card — authentic intonation and rhythm, far better than TTS for learning,
  and something no competitor does. Reuses the existing media plumbing in the `.apkg` engine.

### Discovery flow: extract → curate → review

Three distinct steps so the user gets both automation and control:

1. **Extract (mechanical).** Whisper produces the full transcript as `TranscriptSegment[]`.
2. **Curate (LLM, `provider.mine`).** The LLM selects the phrases worth learning, biased by
   an optional **focus** the user types (`DiscoveryRequest.focus` — e.g. "phrasal verbs",
   "business vocab"; empty = let the LLM decide). Output is `PhraseCandidate[]` with
   `status: "suggested"`.
3. **Review (human-in-the-loop UI).** The user accepts / rejects / edits each suggestion.
   Only `status: "accepted"` candidates flow into `provider.generate()` and become cards.

Mining is pluggable like generation — the same provider choice (local / Claude / GPT) drives
both, so "run it all locally" stays a coherent, private path end to end.

### Two design commitments (from product decisions)

**1. Local-first persistence, "most complete" form.** We persist the **sources**
(`ErrorEvent`s and `PhraseCandidate`s), not just finished cards. The raw history of *what you
got wrong* and *what you chose to learn* is the asset that makes the "tutor" (weakness
detection) possible later. Cards are derived data; the sources are the source of truth.
Storage: local-first (IndexedDB in the browser / SQLite on the backend). Nothing leaves the
device unless the user explicitly picks a cloud generation provider.

**2. Generation is pluggable — the user chooses where it runs.** Everything past
`generate()` is provider-agnostic. The pipeline never branches on provider.

- `LocalProvider` — transformers.js / WebGPU. Private, free, lower quality.
- `ClaudeProvider` — Anthropic API. Default `claude-opus-4-8` for quality, `claude-haiku-4-5`
  for cheap bulk. Best generation + critique.
- `OpenAIProvider` — GPT, for parity.

Selected at runtime. See `src/lib/cards/provider.ts`.

### Provider matrix

| Provider | Evaluates free text? | How to enable |
| --- | --- | --- |
| **OpenRouter** | Yes | Save an OpenRouter key in Settings, or set `OPENROUTER_API_KEY` in `.env.local`. Default model `openrouter/fusion` (override with `OPENROUTER_MODEL`). |
| **Ollama** (local LLM) | Yes | Run [Ollama](https://ollama.com). Uses `http://localhost:11434` by default. |
| **Claude** | Yes | Save an Anthropic key in Settings, or set `ANTHROPIC_API_KEY` in `.env.local`. |
| **GPT** | Yes | Save an OpenAI key in Settings, or set `OPENAI_API_KEY` in `.env.local`. |

### What changes in the existing `.apkg` engine

`apkg_from_csv.py` today is hard-coded to `pt`/`en`. The error-driven card needs richer
fields so a card can *isolate the concept it tests* and *link back to the mistake that
produced it* (anti-hallucination / grounding):

| Field      | Purpose                                                         |
|------------|----------------------------------------------------------------|
| `Front`    | The prompt that tests understanding (not literal recall)       |
| `Back`     | The native-correct answer + audio                              |
| `Concept`  | The isolated concept (e.g. "preposition after motion verb")    |
| `ErrorType`| Category from the correction tool (collocation, tense, …)      |
| `Source`   | Pointer to the original ErrorEvent (grounding / traceability)  |

This is an additive extension of the genanki note type, not a rewrite.

---

## 3. Card pipeline — build status

The vision: drop in material (PDF, YouTube, article) → get **active-recall exercises** and
**spaced flashcards** whose questions test understanding, not literal memorization → over
time, an SRS engine, performance tracking, and weakness detection turn it from a generator
into a tutor. Status against that vision:

### ✅ Done — foundation
- [x] **Contract / schema** — `schema.ts`, `provider.ts` (the interface every stage agrees on).
- [x] **Discovery ingestion** — local TypeScript runtime: yt-dlp audio-only + whisper.cpp →
      `TranscriptSegment[]` with timestamps. Verified end-to-end. (Originally YouTube.js;
      switched to the external yt-dlp binary when YouTube.js stopped deciphering stream URLs.)
- [x] **`.apkg` export engine** with TTS audio (genanki).
- [x] **Tabs UI** + transcript with native-clip playback + manual "Keep".

### ✅ The brain — quality generation (the differentiator)
All three providers share one provider-agnostic brain (`src/lib/cards/shared.ts`):
prompt + JSON-schema builders and normalizers, so the providers stay genuinely
interchangeable. Cloud providers use structured outputs; the registry
(`src/lib/cards/registry.ts`, server-only) resolves the user's choice from env keys.
- [x] **A1. Provider impls** — `ClaudeProvider` (Anthropic SDK, `claude-opus-4-8`,
      adaptive thinking + structured outputs), `OpenAIProvider` (strict JSON schema +
      embeddings), `LocalProvider` (offline heuristic, no network). See
      `src/lib/cards/providers/`.
- [x] **A2. `mine()`** — LLM curation biased by **Focus** (`buildMineRequest`); maps each
      pick back to its transcript segment so the native-clip timestamps survive. Local
      provider does focus-keyword-weighted heuristic selection.
- [x] **A3. `generate()`** — active-recall cards (comprehension / cloze, not rote recall),
      1–2 per source, for both discovery and correction paths.
- [x] **A4. `critique()`** — keep / rewrite / drop gate (`buildCritiqueRequest`); rewrites
      inherit the original card's grounding.
- [x] **A5. Semantic dedup** (`src/lib/cards/dedupe.ts`) — embedding cosine when the
      provider has an embedder (OpenAI), lexical-cosine fallback otherwise.
- [x] **A6. Grounding** — structural (`source` pointer set by code, not the model, then
      verified in `generateVettedCards`) + semantic (the critique drops ungrounded cards).
- _Orchestration:_ `generateVettedCards` (generate → ground → critique per source) and
  `generateDeck` (vet all sources, then dedup) in `src/lib/cards/provider.ts`. The offline
  path is verified end-to-end.

### ✅ Close the loop — ingestion → card → Anki
- [x] **B1. Wire "Generate cards →"** — kept segments → accepted `PhraseCandidate[]` →
      `POST /api/cards/generate` (server-only, resolves the chosen provider, runs
      `generateDeck`) → extended `.apkg` engine → browser download. The Discover UI now has a
      provider selector (Local always; Claude/OpenAI when their key is set, listed by
      `GET /api/cards/providers`). Verified end-to-end with the local provider.
- [x] **B2. Extend the Anki note type** — the TypeScript `ankipack` exporter builds a deck with
      an additive note type (`Front`, `Back`, `Audio`, `Concept`, `ErrorType`, `Source`); the
      PT/EN CSV path is untouched.
- [x] **B3. Slice the native audio clip** — in-process audio decoding cuts `[startMs, endMs]` from the
      cached source audio (`Application Support/PhraseLoop/discover-cache`), embedded as card media.
      Falls back to Kokoro TTS of the answer when no clip is available.

### ✅ More material sources
All three converge on the same `DiscoverResult → PhraseCandidate → Card` pipeline; the
Discover UI now has a **source-type selector** (YouTube / Article-URL / PDF). Text-only
sources carry no timestamps (`hasAudio: false`), so their cards fall back to Kokoro TTS for
the answer audio — the native-clip slicing is reserved for the audio path.
- [x] **C1. PDF** parsing — `POST /discover/pdf` (multipart) → PDF.js text extraction →
      sentence segmentation. Next.js proxy at `src/app/api/discover/pdf/route.ts` (25 MB cap).
- [x] **C2. Article / URL** text extraction — `POST /discover/article` → Mozilla Readability
      main-text + title extraction → sentence segmentation. Proxy at
      `src/app/api/discover/article/route.ts`.
- [x] ~~**C3. YouTube captions** fast path~~ — removed together with the YouTube.js download
      path (stream deciphering broke). Every YouTube import now transcribes with Whisper;
      audio is still cached, so native clips work.

### ✅ Persistence & study (the long-game)
Local-first and browser-only: everything lives in IndexedDB (`src/lib/store/db.ts`), nothing
leaves the device. The **Study** tab (`src/features/study/components/StudyTab.tsx`) is the surface for all of it.
- [x] **D1. Local-first store** — IndexedDB (`tts-cards`) with stores for `errorEvents` /
      `phraseCandidates` / `cards` / `srs` / `reviews`. Typed CRUD + study queries in
      `src/lib/store/repository.ts`. Discover now persists the accepted `PhraseCandidate`s
      (source of truth) and the generated `Card`s on "Generate cards →" — the generate route
      returns JSON (cards + base64 `.apkg`) when `persist: true` so the client can save and
      still download the deck.
- [x] **D2. SRS engine** — `ts-fsrs` wrapped in `src/lib/srs/fsrs.ts` (Date↔epoch-ms
      serialization so the `due` index is range-queryable). New cards start due immediately;
      the Study tab shows the due queue, flip-to-answer, and Again/Hard/Good/Easy with a live
      next-interval preview per grade.
- [x] **D3. Performance tracking** — every grade appends a denormalized `ReviewRecord`
      (concept + errorType inline). `computePerformance` (`src/lib/srs/analytics.ts`) derives
      accuracy, lapse rate, daily review counts (14-day sparkline), today's count, and streak.
- [x] **D4. Weakness detection** (the "tutor") — `detectWeaknesses` groups the review log by
      concept and error type, ranks by struggle rate (Again/Hard share) past a min-reviews
      threshold, and the Study tab lists the worst spots. Denormalized fields mean it survives
      card deletion.
- [x] **D5. Reinforcement loop** (closing the tutor loop) — each "Weak spot" gets a
      **Reforçar** button that pulls *every* card for that concept/error-type into a focused
      drill session via `getReinforcementCards` (`src/lib/store/repository.ts`), bypassing the
      FSRS due date. This is what turns the weakness panel from a passive report into an action:
      detect → drill. The session sits on top of the normal due queue; finishing it (or the
      "Sair" button) drops back to regular review.
- [x] **D5 (a). Directed generation** (the tutor's real differentiator) — each "Weak spot"
      also gets a **Gerar +** button. `getReinforcementSources` (`src/lib/store/repository.ts`)
      finds the `PhraseCandidate`s / `ErrorEvent`s behind that concept's struggled-with cards;
      `POST /api/cards/reinforce` runs them back through the same `generateDeck` (generate →
      ground → critique → dedup) to mint *fresh variant cards* that drill the same concept from
      a new angle. Grounded by construction (every card still points to a real source the
      learner has) and needs no new material. Unlike `/api/cards/generate` it builds no .apkg —
      variants are studied in-app, so it just returns `Card[]` for the client to persist
      (`saveCards`) and immediately drill. Study uses the explicit global provider from
      Settings; it blocks with a connection prompt rather than silently falling back.
      Intake validation is shared between both routes via `src/lib/cards/intake.ts`.
- [x] **D5 (b). Weakness trend over time** — `detectWeaknesses` no longer reports a static
      aggregate: each error-type weakness carries a `trend`
      (`improving` / `worsening` / `stable`) + signed `trendDelta`, read from your
      *production* (ErrorEvents split into earlier/recent halves), in
      `src/lib/srs/analytics.ts`. Weaknesses now also group by **context**
      (`kind: "concept" | "errorType" | "context"`), not just concept / error type.

### ✅ The other half — learn from your own mistakes
The error-driven path now lands in the same store, cards, and weakness analysis the
discovery path does. The **Correct** tab (`src/features/correct/components/CorrectTab.tsx`) is the ingestion
surface; everything past it reuses the existing provider pipeline and `.apkg` engine.
- [x] **E1. Correction-tool integration** — wire the native-correction tool's output to
      `ErrorEvent` (the error-driven path). The Correct tab takes corrections two ways
      (typed `original → corrected` with optional error-type tags + rationale, or a JSON
      paste of the tool's output) and builds `ErrorEvent`s. `POST /api/cards/generate` now
      accepts `errors` alongside `candidates`, maps them to `CardSource{ kind: "error" }`,
      and runs the same `generateDeck` (generate → ground → critique → dedup) — so the
      provider's correction-path cards (the "say it naturally" contrast) flow into the
      extended `.apkg` engine (Kokoro TTS of the answer, no native clip). The client persists
      the `ErrorEvent`s (source of truth) + cards via `saveCorrectionDeck`
      (`src/lib/store/repository.ts`), mirroring `saveGeneratedDeck`, so the Study tab,
      FSRS scheduling, and `detectWeaknesses` pick up mistakes alongside discoveries.

### Active product priority

The current product sequencing is now owned by [product.md](product.md):

1. Commit to one identity: Portuguese-speaking serious self-study/Anki learners, PT -> EN, desktop first.
2. Engineer the 5-minute zero-config wow: URL or bundled demo -> native-audio cards ->
   first review, with no keys and no Ollama required.
3. Ship exactly one calm re-engagement pull.
4. Refocus IA on Discover -> Study -> Correct; keep provider setup, Tools/Speech, Anki export,
   Converse/Plan/cycle UI hidden as depth until the core loop is understood.
5. Scope review-anywhere for the SRS habit.
6. Freeze new adaptive-difficulty work until 1-5 are real.
7. Deepen the tutor only after the habit loop is working.

### Historical build order

| Step | Unlocks |
|------|---------|
| **A. ClaudeProvider (mine + generate + critique)** | Makes Discover an actual card generator — the heart |
| **B. Wiring + native clip in `.apkg`** | Closes the loop: video → cards with native audio in Anki |
| **C. Local-first store** | Prerequisite for everything "long-game" |
| **D. SRS + tracking + tutor** | Turns it from a tool into a product with a thesis |

Steps **A** and **B** are done — all three providers (Claude / OpenAI / local) ship together and
the loop is closed: "Generate cards →" calls `generateDeck()` server-side and feeds the result
into the extended `.apkg` engine, embedding the sliced native clip per card. Set
`ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) in `.env.local` to enable a cloud provider in the
selector; the local provider needs no key. The material-sources work (checklist **C** —
PDF / article / YouTube-captions fast path) is also done, so ingestion now spans audio and
text. The **long-game** (checklist **D** — local-first store, FSRS scheduling, performance
tracking, weakness detection) now ships too: generated cards persist to IndexedDB and the
**Study** tab turns the generator into a tutor. Both ingestion halves are now wired: the other
half — **E1**, the native-correction tool's output → `ErrorEvent`s via the **Correct** tab —
feeds the same `generateDeck` pipeline, `.apkg` engine, store, and weakness analysis the
discovery path does. The two paths fully converge on one `Card` and one Anki export.

---

## 4. Pre-launch TODO

Ordered by priority for the older build-out. For the active product sequence, use
[product.md](product.md).

### Critical Fixes (blockers)

- [x] **Fix settings race condition** — `AiSettingsContext` browser GET can race with Electron IPC PUT to `/api/settings/runtime`. Add a write-confirms-read handshake (version/timestamp on payload) so the browser waits for Electron write to confirm before rendering.
- [x] **Log per-card critique decisions** — `generateVettedCards()` now emits `cards-candidate-dropped-verdict` and `cards-candidate-rewritten` debug events with `candidateIndex`, `cardId`, `reason`, and `durationMs`.
- [x] **"Fix this" deeplinks on every error notice** — Inline "Open Settings →" buttons added to all provider-unavailable notices in DiscoverTab, AiEvaluateForm (CorrectTab), and ConverseTab. Callback threaded from HomeClient.
- [x] **Refactor `localRuntime.dispatch()` to a route registry** — The current 150-line if-else chain is fragile and untestable. Create `src/server/routes.ts` with a typed `Record<string, Handler>` map.

### High-Impact (v1 scope)

- [x] **Reorder tabs: Discover first** — Tab order changed to Discover → Practice → Correct → Speech. Default tab is now Discover.
- [x] **Rework onboarding to show the full loop** — Replaced with numbered 3-step walkthrough: "1. Discover → 2. Generate cards → 3. Study". CTA changed to "Start with Discover".
- [x] **Card preview before APKG export** — Users download a file they can't inspect. Show a `DeckPreview` component (front/back/context per card) from the pipeline response before the download is triggered.
- [x] **Per-card audio embedded in APKG** — Infrastructure exists: Kokoro synthesizes audio, `apkg.ts` supports media. Call Kokoro for each card's target text and add the audio file to the media map.
- [x] **AnkiConnect integration** — Manual import is the biggest friction point. POST to the AnkiConnect REST API; fall back to file download if AnkiConnect is unavailable.
- [x] **Home screen / progress dashboard** — App opens on a TTS form with no learning context. Add a dashboard: cards due today, recent session history, learning streak, quick-start button to Discover.
- [x] **Embeddings cache in dedup** — `dedupe.ts` recomputes embeddings on every call. Add an in-memory `Map<contentHash+model, embedding[]>` with a TTL to avoid redundant API calls.

### UX States (missing)

- [x] **First-time Discover empty state** — Show "Paste a YouTube URL to get started" with an example URL instead of a blank form.
- [x] **Empty Study queue** — Show "You're all caught up — Discover new content" with a button to the Discover tab.
- [x] **Post-export success action** — After APKG download, offer "Study now" to jump to the Study tab.
- [x] **Weak spots empty state** — Show "No patterns detected yet — study a few cards first" instead of nothing.
- [x] **Generation timeout message** — "This is taking longer than expected. Try a shorter clip or switch to a faster provider." with a direct link to Settings.

### Features to Transform

- [x] **Batch audio generator → Theme-based phrase generator** — Replace the batch tool in Speech tab with a theme input (e.g. "ordering at a restaurant") → LLM generates phrase list → user toggles keep/discard → only confirmed phrases get synthesized + exported as APKG. New route: `/api/cards/generate-from-theme`.
- [x] **JSON import in Correct tab** — Hide behind an "Advanced" disclosure or remove entirely. Too niche; creates visual noise for most users.
- [x] **Local Heuristic provider** — Remove from the main provider selector. Present only as an "offline fallback" label, not a first-class option.

### Nice-to-Have

- [x] **Export to CSV / plain text** — Removes the Anki dependency for users who don't use it. ~20 lines.
- [x] **Error type breakdown in Study stats** — Show which error categories recur, not just overall accuracy %.
- [x] **Search/filter saved cards** — Basic browse/search across all captured cards without opening Anki.
- [x] **Centralize magic numbers** — Move all scattered timeouts and size limits into `src/lib/constants.ts` with a one-line comment explaining each value.
- [x] **API route integration tests** — At minimum: `/api/tts`, `/api/cards/generate`, `/api/settings`. Current coverage is ~0% for routes.
- [x] **Per-endpoint input size guards** — Validate payload size at the top of each route handler that accepts large text, before JSON parsing.

### Future (post-v1)

- [ ] Browser extension for clipboard/selection mining
- [ ] Mobile card review sync
- [ ] Multi-language support (currently English-only)
- [x] Sentence-level audio playback in Discover transcript review
- [ ] AnkiWeb sync (for users not on AnkiConnect)
- [x] Structured logging (replace scattered `console.error()` with pino)

---

## 5. Conversation practice — shipped

> **Status: ✅ all four phases below ship today.** Provider `converse()` lives in
> `src/lib/cards/providers/{claude,openai,ollama}.ts` (the local heuristic has none — it
> returns a 422); the API is `src/app/api/conversation/route.ts`; the UI is
> `src/features/converse/components/ConverseTab.tsx`; the `conversations` store, the
> Phase-2 context-tagged correction (`correctReview` + `correctedAt` guard), and the
> Phase-3 Study **ExposureMeter** (`src/features/study/components/ExposureMeter.tsx`) are
> all wired. The phase specs below are kept as the design record.

Conversation practice should not be a disconnected chatbot. It should become another
ingestion path for the existing learning loop:

```text
conversation -> mistakes -> cards -> SRS -> weaknesses -> reinforcement
```

The conversation scenario also becomes the situational context for the mistakes and cards,
for example `job-interview`, `restaurant`, `doctor`, or `small-talk`.

### What gets reused

| Existing piece | Role in conversation |
| --- | --- |
| Whisper transcription | Converts the learner's spoken turn to text. |
| Kokoro TTS | Speaks the assistant reply. |
| LLM providers | Generate assistant turns and correction feedback. |
| Correction flow | Extracts `ErrorEvent[]` from learner turns. |
| Card/SRS store | Saves generated cards and review history. |
| Weakness analytics | Detects repeated struggles by concept, error type, and context. |

### Phase 0: Context primitive

Goal: give every mistake and card an optional situational context.

Tasks:

- Add `context?: string` to `ErrorEvent` and `Card`.
- Accept `context` in correction parsing and correction API calls.
- Propagate source context onto generated cards.
- Add `context?: string` to review records.
- Teach weakness detection to group by context.
- Allow reinforcement by context.
- Show/edit context in correction and weakness UI.

Acceptance criteria:

- A correction can be saved with context.
- Generated cards and reviews preserve that context.
- Weakness detection can return context-keyed weaknesses.
- Existing records without context still work.

### Phase 1: Conversation core

Goal: support a spoken or typed back-and-forth with an AI partner, scoped to a scenario and
learner level.

Provider addition:

```ts
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ConverseOptions {
  scenario: string;
  targetLang: string;
  level?: EnglishLevel;
}

converse?(
  history: ConversationTurn[],
  opts: ConverseOptions,
  run?: GenerationRunOptions,
): Promise<string>;
```

Tasks:

- Implement `converse()` for Claude, OpenAI, and Ollama.
- Add a conversation store with scenario, target language, level, turns, and timestamps.
- Add `/api/conversation` to resolve the selected provider and return assistant text.
- Add a Converse tab with scenario picker, level, push-to-talk, typed fallback, and history.
- Render assistant text before requesting TTS audio.
- Show a privacy notice when a cloud provider is selected.

Acceptance criteria:

- User can pick a scenario, speak or type, and receive a scoped assistant reply.
- Conversation persists and can be reopened.
- Text response appears before audio synthesis completes.
- Local-only provider without chat support shows a clear provider prompt.

### Phase 2: Close the loop

Goal: turn conversation mistakes into context-tagged cards.

End-of-session flow:

1. Collect only the user's turns.
2. Run correction over the learner's turns.
3. Tag every resulting error with `context = conversation.scenario`.
4. Persist errors and generated cards through the existing correction deck flow.
5. Mark the conversation as corrected to avoid duplicate provider calls.

Tasks:

- Add a `correctConversation` flow.
- Build a post-session review screen.
- Reuse correction deck generation for conversation errors.
- Handle the empty state where no mistakes are detected.
- Guard already-corrected conversations from re-running correction.

Acceptance criteria:

- Finished conversations produce context-tagged `ErrorEvent`s.
- Conversation errors can generate cards and enter SRS.
- Weaknesses can include conversation context.
- Reopening a finished conversation does not re-charge correction.

### Phase 3: Exposure meter

Goal: show weekly practice exposure using observable app activity rather than self-report.

Data sources:

- Conversation sessions.
- User turns.
- Review counts.
- Optional per-context practice breakdown.

Tasks:

- Add weekly aggregates over conversations and reviews.
- Let the user set a gentle weekly target.
- Show under-target, in-zone, and overload states.
- Optionally use errors-per-turn to improve weakness trends.

Acceptance criteria:

- Study tab shows weekly exposure against a target.
- Counts come from real app activity.
- Quiet weeks do not incorrectly look like improvement if errors-per-turn ships.

### Cross-cutting decisions

- On non-macOS-arm64 devices, conversation falls back to typed input.
- Correction runs at the end of the session, not per turn.
- Use push-to-talk for v1.
- Keep assistant replies short so STT, LLM, and TTS latency stays tolerable.
- Conversation is allowed to use a cloud provider, but the UI must clearly say when turns
  leave the device.

---

## 6. Structured 90-day learning plan — shipped

> **Status: ✅ all 5 implementation steps below ship today.** Stores live in IndexedDB
> **`DB_VERSION 4`** (`learningPlan`, `activityLog`, `effortHistory` — plus `conversations`);
> `activityLog` is emitted from Study / Discover / Converse / Correct via
> `emitActivity` (`src/lib/store/activityLog.ts`). Plan generation/adaptation:
> `src/features/plan/{generator,adaptation,effort,schema,store}.ts` →
> `src/app/api/plan/route.ts` + `src/app/api/plan/adapt/route.ts`. Home surface:
> `src/features/plan/components/{PlanOnboarding,TodayCard,WeeklyEffortCard,PlanCalendar}.tsx`.
> The spec below is kept as the design record.

### O que é

Um plano de aprendizado personalizado gerado a partir do perfil do usuário (`LearningProfile`),
dividido em fases diárias com tarefas concretas que mapeiam para as features existentes do app.
O plano se adapta automaticamente com base no esforço real medido.

### Conceito central

```
Meta + Perfil → Plano gerado por LLM → Calendário de dias → Tarefa do dia
                                                                    ↓
                                              Usuário executa (Discover / Study / Converse)
                                                                    ↓
                                              Activity log registra o que foi feito de verdade
                                                                    ↓
                                              Comparação plano vs. realidade → ajuste automático
```

### Inputs do usuário (onboarding do plano)

| Campo | Tipo | Exemplo |
|---|---|---|
| `goal` | texto livre | "Conseguir conversar em espanhol em situações do dia a dia" |
| `targetLevel` | enum CEFR | B1 |
| `currentLevel` | já existe em `LearningProfile.level` | A2 |
| `availabilityMinutes` | número | 20 min/dia |
| `planDays` | número | 90 |
| `language` | já existe no perfil | Espanhol |

### Estrutura do plano

**Fases (geradas por LLM).** O plano é dividido em fases temáticas. Exemplo para 90 dias / 20 min:

```
Fase 1 (dias 1–30):  Listening & vocabulário de sobrevivência
  → Foco: Discover 3x/semana, Study diário, sem Converse ainda

Fase 2 (dias 31–60): Output básico + correção de erros
  → Foco: Converse 2x/semana, Correct das conversas, cards dos erros

Fase 3 (dias 61–90): Fluência e consolidação
  → Foco: conteúdo mais denso no Discover, Converse sem roteiro
```

**Tarefa do dia (`DailyTask`).** Cada dia tem uma lista de tarefas concretas, cada uma com um
`tab` de destino:

```ts
interface DailyTask {
  date: string;               // "2026-06-24"
  phase: number;
  tasks: TaskItem[];
  estimatedMinutes: number;
  completedAt?: number;
}

interface TaskItem {
  id: string;
  type: "discover" | "study" | "converse" | "correct";
  instruction: string;        // ex: "Descubra 1 vídeo curto sobre viagens"
  targetMetric?: {            // o que conta como "feito"
    action: "cards_reviewed" | "video_processed" | "conversation_turns" | "cards_created";
    quantity: number;
  };
  completedAt?: number;
}
```

### Activity log (camada nova necessária)

O plano precisa saber o que o usuário **realmente fez**. Hoje cada feature vive no seu próprio
estado. É necessária uma store `activityLog` no IndexedDB:

```ts
interface ActivityEvent {
  id: string;
  ts: number;
  type:
    | "cards_reviewed"       // Study — n cards graduados
    | "video_processed"      // Discover — transcrição → cards gerada
    | "conversation_turn"    // Converse — turno enviado
    | "correction_generated" // Correct — deck criado
    | "cards_created";       // qualquer fonte → n cards novos
  payload: Record<string, unknown>;  // contagem, cardIds, conversationId, etc.
}
```

Cada feature emite eventos para essa store. O plan engine lê e marca tarefas como feitas.

**Onde emitir:**
- `StudyTab` → após `onGrade` bem-sucedido
- `DiscoverTab` → após export de cards do transcript
- `ConverseTab` → após cada turno enviado
- `CorrectTab` → após geração de deck

### Medição de esforço

Além de "feito/não feito", o sistema mede a **intensidade** da sessão:

```ts
interface EffortSnapshot {
  weekOf: string;                   // "2026-W26"
  plannedMinutes: number;           // soma das estimativas do plano nessa semana
  actualMinutes: number;            // derivado do activity log (timestamps)
  adherenceRate: number;            // 0–1
  streak: number;                   // dias consecutivos com alguma atividade
}
```

Derivado automaticamente — sem o usuário ter que registrar nada manualmente.

### Adaptação do plano

A cada 7 dias (ou quando o usuário pede), o sistema re-avalia:

```
IF adherenceRate < 0.5 por 2 semanas seguidas:
  → reduz quantidade diária de tarefas
  → notifica: "Parece que 20 min/dia está puxado. Que tal 10 min?"

IF adherenceRate > 0.9 por 2 semanas seguidas:
  → sugere avançar a fase atual
  → oferece aumentar a carga

IF streak == 0 por 3 dias:
  → notifica tarefa de "retomada" (mais leve que o normal)
```

O LLM gera a revisão do plano com base no `EffortSnapshot` + histórico de reviews do FSRS.

### Integração com o que já existe

| O que já existe | Como o plano usa |
|---|---|
| `LearningProfile.level` | ponto de partida do plano |
| `LearningProfile.goal` (cards/semana) | vira `availabilityMinutes` aproximado |
| `ReviewRecord` (FSRS) | mede progresso real de vocabulário |
| `conversations` store | conta turnos de Converse |
| `cards` store | conta cards criados |

### Modelo de dados no IndexedDB (DB_VERSION 4)

Stores (todas já criadas em `src/lib/store/db.ts`):

```
learningPlan   — { id, createdAt, meta: PlanMeta, phases: Phase[], days: DailyTask[] }
activityLog    — { id, ts, type, payload }
effortHistory  — { weekOf, plannedMinutes, actualMinutes, adherenceRate, streak }
```

### UX — fluxo do dia a dia

```
App abre → Home screen
           ├─ "Hoje" card → tarefa do dia com botão direto pra aba certa
           ├─ streak + barra de progresso da fase atual
           └─ "X dias para o objetivo"

Tarefa concluída → check animado → próxima tarefa do dia
Semana fechada   → resumo: "Você fez Y% do plano. Aqui está o ajuste para a semana que vem."
```

### O que NÃO está no escopo aqui

- Geração de conteúdo (o usuário ainda escolhe os vídeos no Discover)
- Gamificação (pontos, badges) — pode vir depois
- Sync na nuvem — tudo continua local-first

### Ordem de implementação sugerida

1. **Activity log** — store + emissão nos 4 lugares (sem UI, só infra)
2. **Plan schema + geração** — onboarding do plano, chamada LLM, salva no IndexedDB
3. **Home screen "Hoje"** — mostra tarefa do dia, deeplink para aba
4. **EffortSnapshot semanal** — cálculo automático, exibição simples
5. **Adaptação** — revisão semanal por LLM com base no esforço
