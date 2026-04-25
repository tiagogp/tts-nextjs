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
