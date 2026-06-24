# Phase 1 — Conversation core

**Goal:** a working spoken (or typed) back-and-forth with an AI partner in the target
language, scoped to a chosen scenario and level. This is the investment phase.

**Depends on:** Phase 0 (the `context` tag the scenario writes into).

## 1. Provider chat primitive

Conversation is multi-turn chat — different from the single-shot `generate` / `correct` /
`critique`. Add an **optional** method, gated like `correct?()`:

```ts
// src/lib/cards/provider.ts
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ConverseOptions {
  scenario: string;          // becomes the context tag
  targetLang: string;
  level?: EnglishLevel;      // steers difficulty
}

// on CardGenerationProvider:
converse?(
  history: ConversationTurn[],
  opts: ConverseOptions,
  run?: GenerationRunOptions,
): Promise<string>;          // the assistant's next turn
```

- Implement for `claude`, `openai`, `ollama`. `local` omits it → UI shows "pick Claude/GPT".
- System prompt: roleplay the scenario, stay in `targetLang`, hold the user's `level`, keep
  turns short (1–3 sentences) so STT/TTS stay snappy and the user does most of the talking.

## 2. Persistence (this is the version bump)

New store for conversations. Bump `DB_VERSION` 1 → 2 in `src/lib/store/db.ts` and add to
`onupgradeneeded` + `STORES`.

```ts
interface Conversation {
  id: string;
  scenario: string;          // == context
  targetLang: string;
  level?: EnglishLevel;
  turns: ConversationTurn[];  // append-only
  startedAt: number;
  endedAt?: number;
  correctedAt?: number;       // set once Phase 2 has run error extraction
}
```

Repository helpers: `saveConversation`, `getConversation`, `getConversations`,
`appendTurn`.

## 3. API route

`/api/conversation` (`src/app/api/conversation/route.ts`): resolve the provider (reuse the
provider registry / settings plumbing the card routes use), call `converse()`, return the
assistant text. Keep TTS out of this route — the client requests `/api/tts` separately so
text can render before audio.

## 4. UI — the "Converse" tab

- Add `{ id: "converse", label: "Converse" }` to `src/components/app/homeTabs.ts`.
- **Scenario picker** at session start: a few presets (restaurant, job interview, doctor,
  small talk) + custom. Sets `scenario` (context) and `level` (reuse `EnglishLevel` from
  `src/features/discover/types.ts`).
- **Turn loop:**
  1. Push-to-talk record → `transcribeAudio(blob)` (already in `src/features/correct/api.ts`).
     Off mac-arm64 (no Whisper), show a text input instead.
  2. POST turn + history to `/api/conversation` → render assistant text immediately.
  3. POST assistant text to `/api/tts` → play with the existing `AudioPlayer`.
- Append every turn to the `Conversation` as it happens (survives reload / accidental close).
- Surface a privacy line when a cloud provider is selected ("turns are sent to <provider>").

## Acceptance criteria

- User can pick a scenario, speak (or type) a turn, and get a spoken reply in the target
  language, scoped to the scenario and level.
- The conversation persists and can be reopened.
- Assistant **text appears before** its audio finishes synthesizing.
- Local-only provider selected → clear "choose Claude/GPT for conversation" message.

## Risks / notes

- **Latency** is the main UX risk — see the budget in the [README](README.md). Text-first
  rendering is the single biggest win; do it from day one.
- The TTS queue (`ttsQueue` in `speech.ts`) serializes synthesis, so a long reply blocks the
  next turn's audio. Keeping replies short mitigates this.
- Don't run error extraction here — that's Phase 2, at end of session, to avoid interrupting
  the conversational flow.
</content>
