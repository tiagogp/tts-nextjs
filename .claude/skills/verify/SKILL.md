---
name: verify
description: Build/launch/drive recipe for verifying PhraseLoop changes end-to-end (Next.js dev server + Playwright GUI drive).
---

# Verifying PhraseLoop changes

## Launch

- `yarn dev` → http://localhost:3000/app (redirects from `/`). Next 16 + Turbopack;
  only ONE dev server per checkout (a second `next dev -p …` refuses to start and can
  corrupt `.next/dev/cache` — if you see `TurbopackInternalError`, `rm -rf .next/dev`
  and restart).
- Simulate a fresh install (no models, no cache):
  `PHRASELOOP_DATA_DIR=$(mktemp -d) yarn dev`
- Simulate a machine WITHOUT a working AI provider (this machine runs Ollama on
  :11434, which the app auto-detects): add `OLLAMA_BASE_URL=http://127.0.0.1:9`.
  Without this, `providerReady` is always true and provider-less flows never show.

## API surfaces (curl)

- `POST /api/discover` — SSE; body `{"url":"https://www.youtube.com/watch?v=…"}`;
  events `progress|done|error`; `done.result.sourceId` is a 12-char id.
- `GET /api/discover/clip/<sourceId>?startMs=&endMs=` — per-phrase WAV slice
  (≤30s); 400 on bad range, 404 on unknown source.
- `POST /api/tts` `{"text":…}` — 409 `model_not_ready` (PT-BR) until Kokoro is
  installed; NOTE: any call kicks off the ~349MB download into the active data dir.
- `POST /api/transcribe` / `POST /api/pronunciation/assess` (multipart `file`,
  `targetText`) — 409 `model_not_ready` + `downloading`/`progress` until Whisper
  (~488MB) lands; the 409 also starts the download.
- `GET /api/status` — model install/download state.

## GUI drive (Playwright)

- Cached browser: `~/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium`
  → use `playwright-core@1.48.x` with `executablePath`, `locale: "pt-BR"`.
- The UI is PT-BR for sub-B1 profiles. Key labels: tabs `Hoje / Revisar / Frases`
  (+ `Erros` = Correct after tier 3 unlock); onboarding dialog is
  `[aria-labelledby="welcome-title"]` (match role=dialog loosely and you'll also catch
  Next's dev error overlay); lesson save `Salvar e estudar`; sentence check
  `Corrigir minha frase`; save-for-tomorrow `Salvar sua frase para amanhã`;
  Discover save `Salvar frases para praticar →`; Study flip `Mostrar resposta`.
- Fresh browser context = fresh IndexedDB = fresh onboarding; tab panels stay
  mounted across switches (state persists per session).
- `window.confirm` dialogs are auto-dismissed by Playwright (destructive Settings
  actions are therefore safe-by-default in scripts).

## Flows worth driving

1. First run: onboarding → `Hoje` → first lesson → save phrases → write sentence →
   save → `Erros` tab + AI settings unlock (must work with a mistake-FREE sentence).
2. Provider-less Discover: import YouTube → hand-pick chips (`Salvar`) → save →
   `Revisar` shows cards with native clips (`audio[src*="/api/discover/clip/"]`).
3. The "connect an AI in Settings" link from Discover must land on a Settings
   screen that actually shows "Advanced AI" regardless of tier.

## Gotchas

- Real data dir on macOS is `~/Library/Application Support/PhraseLoop` — shared
  with the packaged Electron app. Never point verification at it; always use
  `PHRASELOOP_DATA_DIR`.
- `yarn test` (Vitest) writes a `logs/` dir into the active data dir via pino.
- YouTube import of a ~3.5min video ≈ 30–90s (download + whisper) once the model
  is installed.
