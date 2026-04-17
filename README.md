# English Text to Speech

Convert English text into natural speech and download the audio file. Runs 100% locally — no API keys required.

## Stack

- **Frontend** — Next.js + TypeScript + Tailwind CSS
- **Backend** — FastAPI + [Coqui TTS](https://github.com/coqui-ai/TTS) (VCTK VITS multi-speaker model)

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

The Coqui TTS model (~200 MB) is downloaded automatically on first run.

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

- Type or paste English text (up to 4096 characters)
- Choose from 5 voices (female, male, neutral)
- Adjust playback speed (0.5x – 2.0x)
- Play audio in the browser with scrubable progress bar
- Download as WAV
- History of last 10 generations with restore and download
- Dark mode

## Project Structure

```
.
├── backend/
│   ├── tts_server.py      # FastAPI server wrapping Coqui TTS
│   └── requirements.txt
├── src/
│   ├── app/
│   │   ├── page.tsx       # Main UI
│   │   └── api/tts/       # Next.js proxy route → backend
│   ├── components/
│   │   ├── AudioPlayer.tsx
│   │   └── HistoryPanel.tsx
│   └── types/
└── start.sh               # Starts both services
```
