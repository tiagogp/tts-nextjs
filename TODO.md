# PhraseLoop — Pre-Launch TODO

Ordered by priority. Do not ship publicly until **Critical Fixes** are done.

---

## Critical Fixes (blockers)

- [x] **Fix settings race condition** — `AiSettingsContext` browser GET can race with Electron IPC PUT to `/api/settings/runtime`. Add a write-confirms-read handshake (version/timestamp on payload) so the browser waits for Electron write to confirm before rendering.
- [x] **Log per-card critique decisions** — `generateVettedCards()` now emits `cards-candidate-dropped-verdict` and `cards-candidate-rewritten` debug events with `candidateIndex`, `cardId`, `reason`, and `durationMs`.
- [x] **"Fix this" deeplinks on every error notice** — Inline "Open Settings →" buttons added to all provider-unavailable notices in DiscoverTab, AiEvaluateForm (CorrectTab), and ConverseTab. Callback threaded from HomeClient.
- [x] **Refactor `localRuntime.dispatch()` to a route registry** — The current 150-line if-else chain is fragile and untestable. Create `src/server/routes.ts` with a typed `Record<string, Handler>` map.

---

## High-Impact (v1 scope)

- [x] **Reorder tabs: Discover first** — Tab order changed to Discover → Practice → Correct → Speech. Default tab is now Discover.
- [x] **Rework onboarding to show the full loop** — Replaced with numbered 3-step walkthrough: "1. Discover → 2. Generate cards → 3. Study". CTA changed to "Start with Discover".
- [x] **Card preview before APKG export** — Users download a file they can't inspect. Show a `DeckPreview` component (front/back/context per card) from the pipeline response before the download is triggered.
- [x] **Per-card audio embedded in APKG** — Infrastructure exists: Kokoro synthesizes audio, `apkg.ts` supports media. Call Kokoro for each card's target text and add the audio file to the media map.
- [x] **AnkiConnect integration** — Manual import is the biggest friction point. POST to the AnkiConnect REST API; fall back to file download if AnkiConnect is unavailable.
- [x] **Home screen / progress dashboard** — App opens on a TTS form with no learning context. Add a dashboard: cards due today, recent session history, learning streak, quick-start button to Discover.
- [x] **Embeddings cache in dedup** — `dedupe.ts` recomputes embeddings on every call. Add an in-memory `Map<contentHash+model, embedding[]>` with a TTL to avoid redundant API calls.

---

## UX States (missing)

- [x] **First-time Discover empty state** — Show "Paste a YouTube URL to get started" with an example URL instead of a blank form.
- [x] **Empty Study queue** — Show "You're all caught up — Discover new content" with a button to the Discover tab.
- [x] **Post-export success action** — After APKG download, offer "Study now" to jump to the Study tab.
- [x] **Weak spots empty state** — Show "No patterns detected yet — study a few cards first" instead of nothing.
- [x] **Generation timeout message** — "This is taking longer than expected. Try a shorter clip or switch to a faster provider." with a direct link to Settings.

---

## Features to Transform

- [x] **Batch audio generator → Theme-based phrase generator** — Replace the batch tool in Speech tab with a theme input (e.g. "ordering at a restaurant") → LLM generates phrase list → user toggles keep/discard → only confirmed phrases get synthesized + exported as APKG. New route: `/api/cards/generate-from-theme`.
- [x] **JSON import in Correct tab** — Hide behind an "Advanced" disclosure or remove entirely. Too niche; creates visual noise for most users.
- [x] **Local Heuristic provider** — Remove from the main provider selector. Present only as an "offline fallback" label, not a first-class option.

---

## Nice-to-Have

- [x] **Export to CSV / plain text** — Removes the Anki dependency for users who don't use it. ~20 lines.
- [x] **Error type breakdown in Study stats** — Show which error categories recur, not just overall accuracy %.
- [x] **Search/filter saved cards** — Basic browse/search across all captured cards without opening Anki.
- [x] **Centralize magic numbers** — Move all scattered timeouts and size limits into `src/lib/constants.ts` with a one-line comment explaining each value.
- [x] **API route integration tests** — At minimum: `/api/tts`, `/api/cards/generate`, `/api/settings`. Current coverage is ~0% for routes.
- [x] **Per-endpoint input size guards** — Validate payload size at the top of each route handler that accepts large text, before JSON parsing.

---

## Future (post-v1)

- [ ] Browser extension for clipboard/selection mining
- [ ] Mobile card review sync
- [ ] Multi-language support (currently English-only)
- [x] Sentence-level audio playback in Discover transcript review
- [ ] AnkiWeb sync (for users not on AnkiConnect)
- [x] Structured logging (replace scattered `console.error()` with pino)
