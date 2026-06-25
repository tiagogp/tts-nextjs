# PhraseLoop

Convert English text into natural speech and download the audio file. Runs 100% locally — no API keys required.

## Stack

- **Frontend** — Next.js + TypeScript + Tailwind CSS + next-themes
- **Local speech runtime** — Kokoro 1.0 via sherpa-onnx and whisper.cpp/Metal, loaded directly by Node

## Requirements

- Apple Silicon Mac running macOS 14+
- Node.js 22.13+

## Setup

Install dependencies:

```bash
npm install
```

Kokoro and Whisper models are downloaded automatically on first use and stored
under `~/Library/Application Support/PhraseLoop/models/native`. Downloads are
verified by SHA-256 and installed atomically.

## Running

Start the Electron app and its standalone Next server with a single command:

```bash
./start.sh
```

Speech inference runs inside the Next Node process through native addons. No
Python, ffmpeg executable, helper app, or auxiliary Dock icon is used.

## Building the macOS app

Generate the native app:

```bash
npm run app:dist
```

The app is written to:

```bash
dist/mac-arm64/PhraseLoop.app
```

The package includes standalone Next.js and signed arm64 native libraries. It
also creates a user config file on first launch:

```bash
~/Library/Application Support/PhraseLoop/phraseloop.env
```

### Distributing the app

Build a shareable disk image:

```bash
npm run app:download
```

This packages the native runtime and writes a drag-to-Applications disk image
to `dist/PhraseLoop-mac-arm64.dmg`. Share that file: the recipient
opens the `.dmg`, drags **PhraseLoop** to **Applications**, and opens it once
(right-click → Open the first time, since the app is ad-hoc signed). No Terminal
window and no install script — the app clears its own download quarantine on
first launch.

Provider setup for card generation/correction:

- If Ollama is running locally, PhraseLoop detects it automatically (`http://localhost:11434`).
- If Ollama is not available, add one of these keys to `phraseloop.env`, then restart the app:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Optional Ollama overrides:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## Features

- Local **Kokoro 1.0** text-to-speech and whisper.cpp transcription
- 8 Kokoro voices (US/UK, male/female)
- Adjust playback speed (0.5× – 2.0×)
- Play audio in the browser with scrubable progress bar
- Download as WAV
- History of last 10 generations with restore and download
- **Batch generation** — one sentence per line, download all as ZIP
- Dark / light / system theme

## Discover (YouTube → transcript → phrases)

The **Discover** tab turns native content into learning material. Paste a YouTube URL; the
app downloads the **audio only** (no video) with YouTube.js and transcribes it locally with
[whisper.cpp](https://github.com/ggml-org/whisper.cpp), producing a timestamped
transcript. Each segment can be played back as its **native audio clip** and marked to keep.

Runs 100% locally — the speech-recognition model (`small`, ~480 MB) downloads on first use.
Audio decoding uses in-process WebAssembly; Homebrew and ffmpeg are not required.

> Next step (in progress): LLM curation biased by an optional **focus** field, a review pass,
> and one-click card generation. See [docs/README.md](docs/README.md).

## Card AI providers

Card mining, generation, the quality critique, and free-text correction run through a
pluggable provider. Open **Settings → AI Provider** to choose the global default, test a
connection, or override the provider for one Discover/Correct task. Ollama is the default;
PhraseLoop never sends content to a cloud provider unless you explicitly select it.

| Provider | Evaluates free text? | How to enable |
| --- | --- | --- |
| **Local** (heuristic) | No | Always available. No model — cloze/keyword heuristics only. |
| **Ollama** (local LLM) | Yes | Run [Ollama](https://ollama.com). Uses `http://localhost:11434` by default. |
| **Claude** | Yes | Save an Anthropic key in Settings, or set `ANTHROPIC_API_KEY` in `.env.local`. |
| **GPT** | Yes | Save an OpenAI key in Settings, or set `OPENAI_API_KEY` in `.env.local`. |

For a fully local-but-capable setup, run Ollama yourself:

```bash
ollama pull llama3.1
ollama serve                   # exposes the OpenAI-compatible API on :11434
```

Settings, **Discover**, and **Correct** show a model picker populated from the models you've
actually pulled (`ollama list`) — no need to hardcode `OLLAMA_MODEL`. If your server runs
somewhere else, change its address in Settings or set `OLLAMA_BASE_URL` in `.env.local`.
Desktop credentials are encrypted with the operating system's secure storage and synchronized
to the local backend without restarting PhraseLoop. Ollama uses its OpenAI-compatible endpoint, so structured-output quality
depends on the model: prefer an instruction-tuned one that handles JSON well (e.g. `llama3.1`,
`qwen2.5`).

## Anki (CSV → Audio → Notes)

Open the app and use **Anki Export** to upload CSV/JSON and download a modern
`.apkg` containing Kokoro audio. CSV defaults to columns named `pt` and `en`:

```csv
pt,en
"Olá, tudo bem?","Hello, how are you?"
```

Discover exports retain native timestamped clips when available and fall back
to Kokoro audio otherwise. Import the result with Anki's `File → Import`.

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx           # Server entry that renders the desktop client shell
│   │   ├── layout.tsx
│   │   └── api/               # Stable BFF routes used by the desktop UI
│   ├── components/
│   │   ├── app/               # app shell, tabs, providers
│   │   └── ui/                # shared presentational primitives
│   ├── features/              # speech, discover, correct, study, settings, cards
│   ├── platform/electron/     # typed client-side access to the preload bridge
│   ├── server/                # server-only BFF helpers and native runtime
│   │   └── native/            # models, speech, discovery, audio, APKG
│   ├── lib/                   # shared pure/domain utilities
│   └── types/
└── start.sh                   # Starts Electron and standalone Next
```

The UI is organized by feature rather than by tab-sized files. Next.js `app/` stays thin:
route handlers keep their public URLs stable, while domain logic lives under `features/`
or server-only modules under `server/`.
