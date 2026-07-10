<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Feature freeze (docs/validation-action-plan.md Phase 0)

In effect until the W5 validation round (docs/w5-validation-protocol.md) passes or fails.
Until then, **no fixes, polish, or refactors** on the surfaces below — **crash fixes only**.
Everything else in the repo (the guided first-run loop, Discover, Study, Correct, activation
metrics, i18n, the W5 instrumentation itself) is open for normal work; see Phase 1 in
docs/validation-action-plan.md for what's actually in scope right now.

Before editing any file below, re-read this list. If a task would add a feature, capability,
or polish to one of these surfaces, stop and tell the user it's frozen instead of doing it.

| Surface | Frozen paths |
| --- | --- |
| Speak/Converse | `src/features/converse/` (whole dir); `src/features/speech/components/SpeechTab.tsx`, `AnkiExporter.tsx`, `BatchGenerator.tsx`, `HistoryPanel.tsx` |
| 90-day Plan | `src/features/plan/` (whole dir); `src/app/api/plan/`, `src/app/api/plan/adapt/` |
| Adaptive bands / cycle research | `src/lib/srs/band.ts`, `src/lib/srs/fsrs.ts`, `src/lib/srs/skillState.ts`, `src/features/study/cyclePlanner.ts`, `src/features/study/bandQueue.ts`, `src/features/study/sessionMode.ts`, `src/features/study/scaffold.ts` |
| Theme generator | `src/features/speech/components/ThemePhraseGenerator.tsx`, `src/app/api/cards/generate-from-theme/` |
| AnkiConnect | `importCardsToAnkiConnect()` in `src/features/cards/exportDeck.ts`, and the AnkiConnect toggle in `src/features/cards/components/DeckPreview.tsx` |
| Per-task provider overrides | Adding new provider options, persistence, or UI to `src/features/cards/hooks/useProviderSelection.ts` / `src/features/cards/components/ProviderPicker.tsx` |

**Explicitly NOT frozen** — shared infrastructure the active wedge (Discover → Study →
Correct, the guided first-run loop) depends on, even though it sits near or inside the
directories above:

- `src/features/speech/hooks/useKokoroModel.ts`, `useAudioState.ts`, `useSpeechGenerator.ts`,
  `src/features/speech/context/TtsSettingsContext.tsx`, `src/features/speech/components/KokoroModelNotice.tsx`
- `src/lib/srs/analytics.ts` (weakness trends — needed for Phase 6 groundwork)
- `src/features/study/components/`, `weeklyGoal.ts` (the core review loop)
- `src/features/cards/exportDeck.ts` outside `importCardsToAnkiConnect()`, `downloadApkg.ts`,
  `src/server/anki.ts`, `src/app/api/anki/apkg/route.ts` (plain `.apkg` export, used everywhere)
- `useProviderSelection.ts` / `ProviderPicker.tsx` as consumed by Discover/Correct/Converse —
  keep them working, just don't extend them

If you're unsure whether a change counts as a "crash fix," ask the user before proceeding.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
