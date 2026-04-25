"""
Multi-engine TTS server — supports VITS and Kokoro-82M.

VITS loads at startup. Kokoro is lazy-loaded on first request.

Start:
    uvicorn tts_server:app --port 5002 --reload
"""

import io

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from TTS.api import TTS

app = FastAPI(title="Multi-Engine TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# ── VITS (loaded at startup) ──────────────────────────────────────────────────
vits_model = TTS("tts_models/en/vctk/vits", progress_bar=True, gpu=False)

VITS_SPEAKERS: dict[str, str] = {
    "female-1": "p225",
    "female-2": "p228",
    "male-1":   "p226",
    "male-2":   "p278",
    "neutral":  "p270",
}

# ── Kokoro-82M (lazy-loaded on first request) ─────────────────────────────────
_kokoro_a = None  # American English (af_*, am_*)
_kokoro_b = None  # British English  (bf_*, bm_*)
_kokoro_downloading = False

def _get_kokoro(lang_code: str):
    global _kokoro_a, _kokoro_b, _kokoro_downloading
    if lang_code == "b":
        if _kokoro_b is None:
            _kokoro_downloading = True
            try:
                from kokoro import KPipeline
                _kokoro_b = KPipeline(lang_code="b")
            finally:
                _kokoro_downloading = False
        return _kokoro_b
    else:
        if _kokoro_a is None:
            _kokoro_downloading = True
            try:
                from kokoro import KPipeline
                _kokoro_a = KPipeline(lang_code="a")
            finally:
                _kokoro_downloading = False
        return _kokoro_a


# ── Request schema ────────────────────────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    voice: str = "female-1"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    engine: str = "vits"  # "vits" | "kokoro"


# ── Endpoint ──────────────────────────────────────────────────────────────────
@app.post("/tts")
def synthesize(req: TTSRequest) -> StreamingResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 4096:
        raise HTTPException(status_code=400, detail="text exceeds 4096 characters")

    if req.engine == "kokoro":
        audio, sample_rate = _synth_kokoro(text, req.voice, req.speed)
    else:
        audio, sample_rate = _synth_vits(text, req.voice, req.speed)

    buf = io.BytesIO()
    sf.write(buf, audio, sample_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
    )


def _synth_vits(text: str, voice: str, speed: float):
    speaker = VITS_SPEAKERS.get(voice, "p225")
    wav = vits_model.tts(text=text, speaker=speaker, speed=speed)
    sample_rate: int = vits_model.synthesizer.output_sample_rate
    return np.array(wav, dtype=np.float32), sample_rate


def _synth_kokoro(text: str, voice: str, speed: float):
    lang_code = "b" if voice.startswith("b") else "a"
    pipeline = _get_kokoro(lang_code)
    chunks = [audio for _, _, audio in pipeline(text, voice=voice, speed=speed)]
    combined = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
    return combined.astype(np.float32), 24000


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict:
    return {"downloading_model": _kokoro_downloading}
