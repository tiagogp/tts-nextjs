# PhraseLoop

PhraseLoop is a local-first app for Brazilian A2-B1 self-study learners who want to turn real English and their own mistakes into daily production practice: listen, save one useful phrase, produce English without help, get feedback, retry, and review at the right time.

PhraseLoop starts with one Home-led loop: hear a curated clip, save one useful phrase, review it immediately, correct your own sentence, and turn that correction into tomorrow's practice. Speech generation, Anki export, Speak, custom plans, and AI provider setup are still built in, but they stay behind the core loop rather than defining the first experience.

It is research-aligned, not a substitute for a class, teacher, or immersion, and not yet a proven learning-effectiveness claim. Launch validation is tracking retention, transfer, retry resolution, and unaided production rather than streaks or volume.

## Why PhraseLoop (vs. Anki or a chatbot)

Five-second promise: **turn real English and your mistakes into review cards that keep your source's audio, in 2 minutes.**

Two things a manual flashcard app and a generic chatbot don't do for you:

- **Your source's own audio** — phrases come from real English you chose (a
  YouTube clip, an article, a PDF) and review cards keep that source's audio, not a
  robotic re-read. _Source clip → saved phrase → next-day review card._ The lessons
  bundled with the app are the exception: their 292 clips are generated on-device by
  Kokoro TTS (`scripts/generate-learn-audio.mjs`), and `native-audio/manifest.json`
  is still empty, so nothing shipped in the box is native-source audio.
- **Your mistakes become drills** — a correction isn't a dead-end note. Each fix
  turns into a review card, and your weak spots feed back into more practice.
  _Writing/speech mistake → corrected phrase → weak-spot reinforcement._ With no AI
  provider configured, the check is deterministic and on-device: spelling of the
  lesson phrase, mechanics, and the high-frequency PT→EN transfer errors in
  `src/features/learn/transferErrors.ts` (article omission, _I have 30 years_,
  _depend of_, _people is_, present-with-_since_, …). Full-coverage feedback still
  needs a provider.

Everything else — local spaced repetition, zero-setup first lesson, Anki export,
local-first storage — exists to keep that loop calm and daily. Launch validation asks whether
users complete the first loop quickly, explain it without jargon, notice the audio or mistake
drills, and name a repeated paid pain before billing moves forward.

### Head to head

| What you need | Manual Anki | Generic chatbot | PhraseLoop |
| --- | --- | --- | --- |
| Get from real material to a review card | Find audio, trim it, build the note, type both sides | Paste text, copy the answer, build the card yourself elsewhere | Keep a phrase from the clip you chose — card is made for you |
| Audio on the card | Whatever you can source and attach by hand | None, or a robotic re-read | The clip you heard, kept on the card — the original when you brought the source |
| Your own mistakes | A note you have to turn into a card yourself | Lost when the chat scrolls away | Become review cards and feed your weak spots |
| Knowing what to study tomorrow | You schedule it | The model has no memory of your reviews | Local spaced repetition picks the due cards |
| Where your history lives | Local (with sync add-ons) | On someone else's server | Local-first, with JSON backup and validated restore |

The switching bet is speed: PhraseLoop must make the path from source material to a reviewed
audio card take under 2 minutes with less friction than doing the same work by hand in Anki,
Migaku, or LingQ. Speak and ELSA are stronger for speaking confidence and pronunciation.
PhraseLoop's launch wedge is the combined desktop loop of source audio, local review, and personal
mistakes becoming tomorrow's practice.

Launch status: this is a research-to-launch candidate. It should not be treated as broadly
launch-ready until activation, explain-back, D+1/D+7 return, differentiation, and one repeated paid
pain are observed.

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
./scripts/start.sh
```

Speech inference runs inside the Next Node process through native addons. No
Python, helper app, or auxiliary Dock icon is used. The only external binary is
`yt-dlp`, needed for YouTube import only (`brew install yt-dlp`; ffmpeg is
optional and improves the audio format).

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
opens the `.dmg`, drags **PhraseLoop** to **Applications**, and double-clicks to
launch. No Terminal window and no install script.

> A build signed and notarized with a Developer ID (set `APPLE_DEVELOPER_ID`
> plus the notarytool credentials before `app:download`) launches with a plain
> double-click. A local ad-hoc/dev build is unsigned, so the first launch still
> needs **right-click → Open** to clear Gatekeeper.

The first-run lesson and daily review work without AI keys or Ollama. Provider setup is an
advanced path for AI mining, card generation from your own sources, correction, conversation,
and custom plans:

- If Ollama is running locally, PhraseLoop detects it automatically (`http://localhost:11434`).
- If Ollama is not available, add one of these keys to `phraseloop.env`, then restart the app:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

`OPENROUTER_MODEL` overrides the default OpenRouter model (`openrouter/fusion`).

Optional Ollama overrides:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## Features

- **Review** — study saved phrases with local spaced repetition
- **First lesson** — save and review bundled practice phrases from Home with no provider setup
- **Phrases** — import YouTube audio, articles, or PDFs and keep phrases worth learning
- **Mistakes** — turn writing or transcribed speech corrections into reviewable phrases
- **Speak** — advanced conversation practice that reuses mistakes as learning material after the core loop is clear
- **Advanced tools** — hidden depth for local Kokoro text-to-speech, theme phrase lists, and Anki export
- **Local-first storage** — cards, reviews, plans, conversations, and source material live in IndexedDB with JSON backup export and validated restore from Settings
- Dark / light / system theme

## Phrases (YouTube → transcript → review)

The **Phrases** tab turns native content into learning material. Paste a YouTube URL; the
app downloads the **audio only** (no video) with [yt-dlp](https://github.com/yt-dlp/yt-dlp)
(YouTube.js can no longer decipher stream URLs) and transcribes it locally with
[whisper.cpp](https://github.com/ggml-org/whisper.cpp), producing a timestamped
transcript. Each segment can be played back as its **native audio clip** and marked to keep.

Transcription runs 100% locally — the speech-recognition model (`small`, ~480 MB) downloads
on first use and audio decoding uses in-process WebAssembly. YouTube import requires
`yt-dlp` (`brew install yt-dlp`); ffmpeg is optional. Article and PDF import need neither.

> Product direction, active priorities, and research-backed roadmap live in
> [docs/product.md](docs/product.md). Architecture and shipped feature history live in
> [docs/README.md](docs/README.md). Validation materials live in
> [docs/validation-log.md](docs/validation-log.md) and [docs/learning-rubrics.md](docs/learning-rubrics.md).

## Advanced AI Providers

Card mining, generation, the quality critique, conversation, and free-text correction run through a
pluggable provider. The first lesson and first review do not show provider setup. After the
core loop is understood, **Settings → Advanced AI for custom content** lets you choose the global
default, test a connection, or override the provider for one Discover/Correct task. Ollama is the
default; PhraseLoop never sends content to a cloud provider unless you explicitly select it.

| Provider | Evaluates free text? | How to enable |
| --- | --- | --- |
| **OpenRouter** | Yes | Save an OpenRouter key in Settings, or set `OPENROUTER_API_KEY` in `.env.local`. Default model `openrouter/fusion` (override with `OPENROUTER_MODEL`). |
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
Desktop credentials are saved in the app's local user-data folder with restrictive file permissions and synchronized
to the local backend without restarting PhraseLoop. Ollama uses its OpenAI-compatible endpoint, so structured-output quality
depends on the model: prefer an instruction-tuned one that handles JSON well (e.g. `llama3.1`,
`qwen2.5`).

## Advanced Anki Export

Open the app and use **Anki Export** to upload CSV/JSON and download a modern
`.apkg` containing Kokoro audio. CSV defaults to columns named `pt` and `en`:

```csv
pt,en
"Olá, tudo bem?","Hello, how are you?"
```

Discover exports retain native timestamped clips when available and fall back
to Kokoro audio otherwise. Import the result with Anki's `File → Import`.

## Project Structure

See [docs/README.md](docs/README.md) for the canonical architecture, app boundaries,
module ownership, and build record.

```
.
├── apps/
│   └── landing/              # Vercel landing page and waitlist
├── electron/                 # Electron shell and desktop packaging
├── native-audio/             # Intake for real recordings — manifest is still empty
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
├── scripts/                   # Build, launch, and asset-generation scripts
│   └── start.sh               # Starts Electron and standalone Next
├── docs/                      # Product, architecture, and validation docs
└── assets/                    # Imported source decks/data fixtures
```

The UI is organized by feature rather than by tab-sized files. Next.js `app/` stays thin:
route handlers keep their public URLs stable, while domain logic lives under `features/`
or server-only modules under `server/`.

## Deploying to Vercel

Only `apps/landing` deploys to Vercel. The root Next app is the desktop product —
it depends on native addons (Kokoro/sherpa-onnx, Whisper) and local files, so it
cannot run on Vercel; it ships inside Electron instead.

One-time Vercel project setup (full runbook in
[apps/landing/README.md](apps/landing/README.md)):

1. Import the repo and set **Root Directory** to `apps/landing`.
2. Enable **"Include source files outside of the Root Directory"** — the landing
   reuses repo-root `src/*` via the `@/*` alias.
3. Add the `PHRASELOOP_WAITLIST_WEBHOOK_URL` env var (Production).

`apps/landing/vercel.json` handles the rest (framework, monorepo install without
the Electron binary, `gru1` region). Validate locally with `yarn landing:build`.
