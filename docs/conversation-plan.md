# Conversation Feature Plan

Conversation practice should not be a disconnected chatbot. It should become another
ingestion path for the existing learning loop:

```text
conversation -> mistakes -> cards -> SRS -> weaknesses -> reinforcement
```

The conversation scenario also becomes the situational context for the mistakes and cards,
for example `job-interview`, `restaurant`, `doctor`, or `small-talk`.

## What Gets Reused

| Existing piece | Role in conversation |
| --- | --- |
| Whisper transcription | Converts the learner's spoken turn to text. |
| Kokoro TTS | Speaks the assistant reply. |
| LLM providers | Generate assistant turns and correction feedback. |
| Correction flow | Extracts `ErrorEvent[]` from learner turns. |
| Card/SRS store | Saves generated cards and review history. |
| Weakness analytics | Detects repeated struggles by concept, error type, and context. |

## Phase 0: Context Primitive

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

## Phase 1: Conversation Core

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

## Phase 2: Close The Loop

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

## Phase 3: Exposure Meter

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

## Cross-Cutting Decisions

- On non-macOS-arm64 devices, conversation falls back to typed input.
- Correction runs at the end of the session, not per turn.
- Use push-to-talk for v1.
- Keep assistant replies short so STT, LLM, and TTS latency stays tolerable.
- Conversation is allowed to use a cloud provider, but the UI must clearly say when turns
  leave the device.
