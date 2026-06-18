# Card pipeline — architecture

Extends this repo (TTS + `.apkg` export) into a system that builds spaced-repetition cards
from two sources of real material. This repo already owns the *output* half (audio + `.apkg`);
this branch adds the *inputs* and the *brain* (pluggable generation + quality gate).

## Two ingestion paths, one output

1. **Discovery (priority).** Mine phrases worth learning from native content — YouTube,
   podcasts. This is where most new learning comes from.
2. **Correction.** Turn your own mistakes (from the native-correction tool) into cards that
   drill exactly what you got wrong.

Both converge on the same `Card` and the same `.apkg` export.

## Pipeline

```
ingestion                         generation (pluggable)        export (already built)
─────────                         ──────────────────────        ──────────────────────
YouTube/podcast ─ yt-dlp (audio   Provider.generate() ────┐
  only, no mp4) ─ Whisper (ts)    (Local | Claude | GPT)   │
  → PhraseCandidate + clip ───────►                        ├─→ Card[] → CSV/JSON → apkg_from_csv.py
                                  Provider.critique() ─────┘            (+ native clip / Kokoro)
native-correction tool ─────────►  (keep | rewrite | drop)                      → Anki
  → ErrorEvent                              │
                                  Store (local-first) ←── persists every source + Card + review
                                            │
                                  weakness detection (Fase 5)
```

## YouTube: audio only, with per-phrase native clips

The mp4 is dead weight — only the audio carries learning value.

- **Download:** `yt-dlp -x --audio-format mp3` (or `bestaudio`). Faster, smaller, no video.
- **Transcript + timing:** YouTube captions when present, else Whisper for word/segment
  timestamps.
- **The payoff:** with timestamps we cut the *exact* native audio clip for each phrase and
  embed it in the card — authentic intonation and rhythm, far better than TTS for learning,
  and something no competitor does. Reuses the existing media plumbing in the `.apkg` engine.

## Discovery flow: extract → curate → review

Three distinct steps so the user gets both automation and control:

1. **Extract (mechanical).** Whisper produces the full transcript as `TranscriptSegment[]`.
2. **Curate (LLM, `provider.mine`).** The LLM selects the phrases worth learning, biased by an
   optional **focus** the user types (`DiscoveryRequest.focus` — e.g. "phrasal verbs",
   "business vocab"; empty = let the LLM decide). Output is `PhraseCandidate[]` with
   `status: "suggested"`.
3. **Review (human-in-the-loop UI).** The user accepts / rejects / edits each suggestion.
   Only `status: "accepted"` candidates flow into `provider.generate()` and become cards.

Mining is pluggable like generation — the same provider choice (local / Claude / GPT) drives
both, so "run it all locally" stays a coherent, private path end to end.

## Two design commitments (from product decisions)

### 1. Local-first persistence, "most complete" form
We persist the **sources** (ErrorEvents and PhraseCandidates), not just finished cards. The
raw history of *what you got wrong* and *what you chose to learn* is the asset that makes the
Fase 5 "tutor" (weakness detection) possible later. Cards are derived data; the sources are
the source of truth.

Storage: local-first (IndexedDB in the browser / SQLite on the backend). Nothing leaves the
device unless the user explicitly picks a cloud generation provider.

### 2. Generation is pluggable — the user chooses where it runs
Everything past `generate()` is provider-agnostic. The pipeline never branches on provider.

- `LocalProvider` — transformers.js / WebGPU. Private, free, lower quality.
- `ClaudeProvider` — Anthropic API. Default `claude-opus-4-8` for quality, `claude-haiku-4-5`
  for cheap bulk. Best generation + critique.
- `OpenAIProvider` — GPT, for parity.

Selected at runtime. See `src/lib/cards/provider.ts`.

## What changes in the existing `.apkg` engine

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

## Roadmap

The vision: drop in material (PDF, YouTube, article) → get **active-recall exercises** and
**spaced flashcards** whose questions test understanding, not literal memorization → over time,
an SRS engine, performance tracking, and weakness detection turn it from a generator into a
tutor. Status against that vision:

### ✅ Done — foundation
- [x] **Contract / schema** — `schema.ts`, `provider.ts` (the interface every stage agrees on).
- [x] **Discovery ingestion** — backend: yt-dlp audio-only + faster-whisper →
      `TranscriptSegment[]` with timestamps. Verified end-to-end.
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
- [x] **B2. Extend the genanki note type** — `apkg_from_csv.py --cards-json` builds a deck with
      an additive note type (`Front`, `Back`, `Audio`, `Concept`, `ErrorType`, `Source`); the
      PT/EN CSV path is untouched.
- [x] **B3. Slice the native audio clip** — server-side ffmpeg cut of `[startMs, endMs]` from the
      cached source mp3 (`backend/.discover_cache/{sourceId}.mp3`), embedded as the card's media.
      Falls back to Kokoro TTS of the answer when no clip is available.

### ✅ More material sources
All three converge on the same `DiscoverResult → PhraseCandidate → Card` pipeline; the
Discover UI now has a **source-type selector** (YouTube / Article-URL / PDF). Text-only
sources carry no timestamps (`hasAudio: false`), so their cards fall back to Kokoro TTS for
the answer audio — the native-clip slicing is reserved for the audio path.
- [x] **C1. PDF** parsing — `POST /discover/pdf` (multipart) → `pypdf` text extraction →
      sentence segmentation. Next.js proxy at `src/app/api/discover/pdf/route.ts` (25 MB cap).
- [x] **C2. Article / URL** text extraction — `POST /discover/article` → `trafilatura`
      main-text + title extraction → sentence segmentation. Proxy at
      `src/app/api/discover/article/route.ts`.
- [x] **C3. YouTube captions** fast path — `discovery.discover()` reads the caption tracks
      yt-dlp already returns (manual subs preferred over auto-captions, `json3` format) and
      builds timestamped segments directly, skipping Whisper. Falls back to `transcribe()`
      when no usable captions exist. Audio is still cached either way, so native clips work.

### ✅ Persistence & study (the long-game)
Local-first and browser-only: everything lives in IndexedDB (`src/lib/store/db.ts`), nothing
leaves the device. The **Study** tab (`src/components/StudyTab.tsx`) is the surface for all of it.
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
      (`saveCards`) and immediately drill. Provider is auto-picked server-side
      (`bestAvailableProvider`: Claude → OpenAI → local) since the Study tab has no selector.
      Intake validation is shared between both routes via `src/lib/cards/intake.ts`.
      _Still ahead: (b) a **time window** in `detectWeaknesses` for improving/worsening trend
      instead of a static aggregate._

### ✅ The other half — learn from your own mistakes
The error-driven path now lands in the same store, cards, and weakness analysis the
discovery path does. The **Correct** tab (`src/components/CorrectTab.tsx`) is the ingestion
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

### Recommended order

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
