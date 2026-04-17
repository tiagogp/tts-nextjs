"""
Coqui TTS server — FastAPI wrapper around the open-source TTS library.

Model: tts_models/en/vctk/vits  (multi-speaker English, ~200 MB)
First run downloads the model automatically to ~/.local/share/tts/

Start:
    uvicorn tts_server:app --port 5002 --reload
"""

import io
import wave
import struct

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from TTS.api import TTS

app = FastAPI(title="Coqui TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Load model once at startup — downloads on first run (~200 MB)
tts = TTS("tts_models/en/vctk/vits", progress_bar=True, gpu=False)

# VCTK speaker IDs with known gender
SPEAKERS: dict[str, str] = {
    "female-1": "p225",   # female
    "female-2": "p228",   # female
    "male-1":   "p226",   # male
    "male-2":   "p278",   # male
    "neutral":  "p270",   # male (deeper)
}


class TTSRequest(BaseModel):
    text: str
    voice: str = "female-1"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


@app.post("/tts")
def synthesize(req: TTSRequest) -> StreamingResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 4096:
        raise HTTPException(status_code=400, detail="text exceeds 4096 characters")

    speaker = SPEAKERS.get(req.voice, "p225")

    wav: list[float] = tts.tts(text=text, speaker=speaker, speed=req.speed)
    sample_rate: int = tts.synthesizer.output_sample_rate

    audio = np.array(wav, dtype=np.float32)

    buf = io.BytesIO()
    sf.write(buf, audio, sample_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
