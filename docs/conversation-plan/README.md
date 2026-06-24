# Conversation feature — plan

Adds **in-app conversation practice** to PhraseLoop, and uses it to unify three product
ideas that were proposed as separate features:

1. **Weekly exposure meter** — how much you practiced this week.
2. **Stuck-points diary** — where you keep getting stuck, by situation.
3. **Context repertoire generator** — phrases/dialogues for the contexts you're weak in.

The key insight: **conversation is not a fourth disconnected feature — it is a new
*ingestion path*.** It reuses the STT + LLM + TTS the app already has, and feeds the
existing `error → card → SRS → weakness` loop. Each conversation has a *scenario*
("ordering at a restaurant", "job interview", "doctor visit") and that scenario **is the
context tag** the other three ideas were missing.

## What already exists (and gets reused)

| Piece | Where | Role in conversation |
|---|---|---|
| STT (Whisper, on-device) | `src/server/native/speech.ts` → `/api/transcribe` | transcribe the user's spoken turn |
| TTS (Kokoro, on-device, queued) | `src/server/native/speech.ts` → `/api/tts` | give voice to the assistant's reply |
| LLM multi-provider | `src/lib/cards/provider.ts` | produce the assistant's turns |
| Error extraction (text → `ErrorEvent[]`) | `correct()` + `/api/cards/correct` | catch mistakes in the user's turns |
| error→card→SRS→weakness loop | `src/lib/store/repository.ts`, `src/lib/srs/analytics.ts` | receive the conversation's errors |

So most of the work is **composition**, not new infrastructure.

## The loop

```
                          ┌─────────────────── one conversation turn ───────────────────┐
  push-to-talk ─ record ─►│ /api/transcribe (Whisper) ─► user turn text                 │
                          │                                       │                      │
                          │ /api/conversation (LLM chat) ◄────────┘ + history + scenario │
                          │   │ assistant text ─► shown immediately                      │
                          │   └─► /api/tts (Kokoro) ─► spoken back (after text)          │
                          └──────────────────────────────────────────────────────────────┘
                                              │ (at end of session)
            provider.correct() over the user's turns ─► ErrorEvent[]  (tagged: context = scenario)
                                              │
                  existing loop: generate ─► cards ─► SRS ─► detectWeaknesses ─► reinforce
                                              │
                       session counts (turns / minutes) ─► weekly exposure meter
```

The scenario tag makes weakness detection say *"you keep getting stuck in work situations"*
(idea #2), lets generation target the weakest context (idea #3), and the session itself is
the **exposure signal** the meter (idea #1) needs — which the app could not observe before
because conversations happened outside it.

## Phases

Build in order. Phase 0 delivers value on its own and de-risks the rest.

| Phase | File | Delivers |
|---|---|---|
| 0 | [`phase-0-context.md`](phase-0-context.md) | Context primitive. Completes idea #2, enables #3 — before conversation exists. |
| 1 | [`phase-1-conversation-core.md`](phase-1-conversation-core.md) | The conversation itself: tab, chat round-trip, voice in/out. |
| 2 | [`phase-2-loop.md`](phase-2-loop.md) | Close the loop: conversation turns → errors → cards. |
| 3 | [`phase-3-exposure-meter.md`](phase-3-exposure-meter.md) | Weekly exposure meter (idea #1), reframed on observable data. |

## Cross-cutting decisions

These hold across phases. Flag if any is wrong.

- **STT is Apple-Silicon only** (`speech.ts` guards `darwin`/`arm64`). Off mac-arm64 the
  conversation falls back to a **typed turn** rather than disabling the feature.
- **The conversation LLM may be a cloud provider** even though the app is local-first. The
  UI must say the turns leave the device when a cloud provider is selected. Cards can still
  be generated locally.
- **Correction runs at end of session**, not per turn — so it never interrupts the flow.
- **Push-to-talk, not voice-activity-detection**, for v1. Simpler, predictable.

## Latency reality ("even if it's a bit slow")

Per turn, serial: STT (~1–3s) + LLM (cloud ~1–2s / local Ollama ~5–15s) + TTS (~1–3s; the
queue in `speech.ts` serializes synthesis). Total ≈ 3–6s cloud, 10–20s local. Acceptable for
a practice tool. Mitigations baked into the plan:

- **Show the assistant text first, synthesize audio after** — reading isn't blocked on audio.
- Recommend a **cloud provider for the conversation turn** even if card generation stays local.
- Keep `maxNumSentences` low so TTS returns sooner.
</content>
</invoke>
