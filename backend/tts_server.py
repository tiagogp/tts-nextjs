"""
Multi-engine TTS server — supports VITS, XTTS v2, and Kokoro-82M.

VITS loads at startup. XTTS v2 and Kokoro are lazy-loaded on first request.

Start:
    uvicorn tts_server:app --port 5002 --reload
"""

import io
import os
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from TTS.api import TTS
from TTS.utils.manage import ModelManager

# XTTS v2 asks for TOS via stdin, which blocks a server process.
# Monkey-patch ask_tos to auto-accept and persist the agreement file
# so subsequent runs use the file-based check without the patch.
def _auto_accept_tos(self, output_path: str) -> bool:
    tos_file = os.path.join(output_path, "tos_agreed.txt")
    if not os.path.exists(tos_file):
        os.makedirs(output_path, exist_ok=True)
        with open(tos_file, "w") as f:
            f.write("I have read, understood and agreed to the Terms of Service.")
    return True

ModelManager.ask_tos = _auto_accept_tos

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

# ── XTTS v2 (lazy-loaded on first request) ───────────────────────────────────
_xtts_model: Optional[TTS] = None

XTTS_VALID_SPEAKERS = {
    "Claribel Dervla",
    "Daisy Studious",
    "Sofia Hellen",
    "Tammy Grit",
    "Andrew Chipper",
    "Badr Odhiambo",
    "Craig Gutsy",
    "Torcull Diarmuid",
}

def _get_xtts() -> TTS:
    global _xtts_model
    if _xtts_model is None:
        _xtts_model = TTS(
            "tts_models/multilingual/multi-dataset/xtts_v2",
            progress_bar=True,
            gpu=False,
        )
    return _xtts_model


# ── Kokoro-82M (lazy-loaded on first request) ─────────────────────────────────
_kokoro_a = None  # American English (af_*, am_*)
_kokoro_b = None  # British English  (bf_*, bm_*)

def _get_kokoro(lang_code: str):
    global _kokoro_a, _kokoro_b
    if lang_code == "b":
        if _kokoro_b is None:
            from kokoro import KPipeline
            _kokoro_b = KPipeline(lang_code="b")
        return _kokoro_b
    else:
        if _kokoro_a is None:
            from kokoro import KPipeline
            _kokoro_a = KPipeline(lang_code="a")
        return _kokoro_a


# ── Request schema ────────────────────────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    voice: str = "female-1"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    engine: str = "vits"  # "vits" | "xtts-v2" | "kokoro"


# ── Endpoint ──────────────────────────────────────────────────────────────────
@app.post("/tts")
def synthesize(req: TTSRequest) -> StreamingResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 4096:
        raise HTTPException(status_code=400, detail="text exceeds 4096 characters")

    if req.engine == "xtts-v2":
        audio, sample_rate = _synth_xtts(text, req.voice, req.speed)
    elif req.engine == "kokoro":
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


def _synth_xtts(text: str, voice: str, speed: float):
    model = _get_xtts()
    speaker = voice if voice in XTTS_VALID_SPEAKERS else "Claribel Dervla"
    wav = model.tts(text=text, speaker=speaker, language="en", speed=speed)
    sample_rate: int = model.synthesizer.output_sample_rate
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
