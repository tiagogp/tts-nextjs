# English Text to Speech

Convert English text into natural speech and download the audio file. Runs 100% locally — no API keys required.

## Stack

- **Frontend** — Next.js + TypeScript + Tailwind CSS + next-themes
- **Backend** — FastAPI + [Coqui TTS](https://github.com/coqui-ai/TTS) (VITS) + [Kokoro](https://github.com/hexgrad/kokoro) + [Chatterbox](https://github.com/resemble-ai/chatterbox)

## Requirements

- Node.js 20+
- Python 3.11 (`brew install python@3.11`)
- espeak-ng (`brew install espeak-ng`)

## Setup

**1. Install frontend dependencies**

```bash
npm install
```

**2. Create the Python virtualenv and install backend dependencies**

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Models are downloaded automatically on first run (~200 MB for VITS, ~80 MB for Kokoro, ~1 GB for Chatterbox).

## Running

Start both services with a single command:

```bash
./start.sh
```

Or manually in two terminals:

```bash
# Terminal 1 — backend (port 5002)
cd backend
.venv/bin/uvicorn tts_server:app --port 5002

# Terminal 2 — frontend (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Three TTS engines: **VITS** (Coqui), **Kokoro**, and **Chatterbox**
- 5 VITS voices, 8 Kokoro voices (US/UK, male/female), and 3 Chatterbox emotion presets
- Adjust playback speed (0.5× – 2.0×)
- Play audio in the browser with scrubable progress bar
- Download as WAV
- History of last 10 generations with restore and download
- **Batch generation** — one sentence per line, download all as ZIP
- Dark / light / system theme

## Discover (YouTube → transcript → phrases)

The **Discover** tab turns native content into learning material. Paste a YouTube URL; the
backend downloads the **audio only** (no video) with `yt-dlp` and transcribes it locally with
[faster-whisper](https://github.com/SYSTRAN/faster-whisper), producing a timestamped
transcript. Each segment can be played back as its **native audio clip** and marked to keep.

Runs 100% locally — the speech-recognition model (`small`, ~480 MB) downloads on first use.
Requires `ffmpeg` (`brew install ffmpeg`).

> Next step (in progress): LLM curation biased by an optional **focus** field, a review pass,
> and one-click card generation. See [ARCHITECTURE_CARDS.md](ARCHITECTURE_CARDS.md).

## Card AI providers

Card mining, generation, the quality critique, and free-text correction (the **Correct** tab's
"Avaliar (IA)") run through a pluggable provider. You pick one at runtime; only the configured
ones show up in the selector:

| Provider | Evaluates free text? | How to enable |
| --- | --- | --- |
| **Local** (heuristic) | No | Always available. No model — cloze/keyword heuristics only. |
| **Ollama** (local LLM) | Yes | Run [Ollama](https://ollama.com) and set `OLLAMA_BASE_URL` in `.env.local`. |
| **Claude** | Yes | Set `ANTHROPIC_API_KEY` in `.env.local`. |
| **GPT** | Yes | Set `OPENAI_API_KEY` in `.env.local`. |

For a fully local-but-capable setup, run Ollama yourself and point the app at it:

```bash
# .env.local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1          # optional default; the UI lets you pick any installed model
```

```bash
ollama pull llama3.1
ollama serve                   # exposes the OpenAI-compatible API on :11434
```

Once `OLLAMA_BASE_URL` is set, the **Discover** and **Correct** tabs show a **model picker**
populated from the models you've actually pulled (`ollama list`) — no need to hardcode
`OLLAMA_MODEL`. It uses Ollama's OpenAI-compatible endpoint, so structured-output quality
depends on the model: prefer an instruction-tuned one that handles JSON well (e.g. `llama3.1`,
`qwen2.5`).

## Anki (CSV → Audio → Notes)

If you want to generate audio for your own cards, you have two options:

- **Export a `.apkg`** (import later / move to another computer)
- **Send directly to Anki** (requires Anki Desktop + AnkiConnect running)

### Export `.apkg` (recommended)

```bash
backend/.venv/bin/python backend/apkg_from_csv.py \
  --csv cards.csv \
  --deck "My Deck" \
  --pt-col pt \
  --en-col en \
  --out my-deck.apkg
```

Import the generated `.apkg` in Anki: `File → Import`.

### Export from the web UI

Open the app and use the **Anki Export** section to upload your CSV and download a `.apkg`.

### Send directly to Anki (AnkiConnect)

**Requirements**

- Anki Desktop running
- [AnkiConnect](https://foosoft.net/projects/anki-connect/) installed (default port `8765`)

**CSV format**

By default the script expects a header row with columns named `pt` and `en`, e.g.:

```csv
pt,en
"Olá, tudo bem?","Hello, how are you?"
```

**Run**

```bash
backend/.venv/bin/python backend/anki_csv_import.py \
  --csv cards.csv \
  --deck "My Deck" \
  --pt-col pt \
  --en-col en
```

This creates `Basic` notes with:

- `Front`: Portuguese text + Portuguese audio
- `Back`: English text + English audio

Use `--front-field` / `--back-field` if your note type uses different field names.

## Project Structure

```
.
├── backend/
│   ├── tts_server.py      # FastAPI server wrapping Coqui VITS + Kokoro
│   └── requirements.txt
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main UI
│   │   ├── layout.tsx
│   │   └── api/tts/           # Next.js proxy route → backend
│   ├── components/
│   │   ├── AudioPlayer.tsx
│   │   ├── BatchGenerator.tsx
│   │   ├── HistoryPanel.tsx
│   │   ├── Select.tsx
│   │   └── ThemeProvider.tsx
│   └── types/
└── start.sh               # Starts both services
```
