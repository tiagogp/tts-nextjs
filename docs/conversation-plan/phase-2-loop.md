# Phase 2 — Close the loop

**Goal:** turn the mistakes made *during a conversation* into context-tagged cards, so the
conversation feeds the same `error → card → SRS → weakness → reinforce` machinery the rest of
the app already runs.

**Depends on:** Phase 0 (context tag) + Phase 1 (conversations to read from).

## The flow

At end of session (user taps "Finish" / "Review this conversation"):

1. Collect the user's turns from the `Conversation` (assistant turns are ignored — we only
   correct the learner).
2. Run `provider.correct()` over them (one call over the joined turns, or per turn — start
   with joined for fewer round-trips).
3. **Tag every resulting `ErrorEvent` with `context = conversation.scenario`** — this is the
   payoff of Phase 0.
4. Persist via `saveCorrectionDeck` (sources + cards) — already in `repository.ts`.
5. Set `conversation.correctedAt` so a session isn't double-corrected.

From step 4 onward, nothing new is needed: `detectWeaknesses`, the Study tab, and
`reinforce` all just work, now with conversation-sourced, context-tagged data.

## Steps

- [ ] **Extract.** Add `correctConversation(conversationId)` in the repository (or a thin
      client fn): load turns → `evaluateCorrectionText` (`src/features/correct/api.ts`)
      with `context` set → returns `ErrorEvent[]`.
- [ ] **Tag + persist.** Write the events with `context = scenario`, then `saveCorrectionDeck`.
      Mark `correctedAt`.
- [ ] **Review UI.** A post-session summary: the turns, the mistakes caught (original →
      corrected, errorType, rationale), and a **"Generate cards"** button that reuses
      `generateCorrectionDeck` (`src/features/correct/api.ts`).
- [ ] **Empty case.** Native-correct conversation → "no mistakes caught" state, no cards.
- [ ] **Re-open guard.** Already-corrected conversations show their saved result instead of
      re-running correction.

## Acceptance criteria

- Finishing a conversation produces `ErrorEvent`s whose `context` equals the scenario.
- Those errors appear in `detectWeaknesses` grouped under their context.
- "Generate cards" yields cards that carry the context and enter SRS like any other card.
- Re-opening a finished conversation does not re-charge the provider for correction.

## Risks / notes

- **Cost/latency of correction** is bounded because it runs once per session, not per turn.
- The learner's transcribed turns carry STT noise; the correction prompt should be told the
  input is a *speech transcript* so it doesn't "correct" transcription artifacts as language
  errors.
- Keep assistant turns out of correction — correcting the AI's own output is meaningless and
  wastes tokens.
</content>
