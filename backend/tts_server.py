"""
Multi-engine TTS server — supports VITS, Kokoro-82M, and Chatterbox.

VITS loads at startup. Kokoro and Chatterbox are lazy-loaded on first request.

Start:
    uvicorn tts_server:app --port 5002 --reload
"""

import io
import shutil
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from TTS.api import TTS

import discovery

VOICE_REF_PATH = Path(__file__).parent / "voice_reference.wav"

app = FastAPI(title="Multi-Engine TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET", "DELETE"],
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


# ── Chatterbox (lazy-loaded on first request) ─────────────────────────────────
_chatterbox = None
_chatterbox_downloading = False

# Emotion presets via exaggeration parameter
CHATTERBOX_VOICES: dict[str, dict] = {
    "neutral":    {"exaggeration": 0.3, "cfg_weight": 0.5},
    "expressive": {"exaggeration": 0.5, "cfg_weight": 0.5},
    "dramatic":   {"exaggeration": 0.8, "cfg_weight": 0.5},
}

def _get_chatterbox():
    global _chatterbox, _chatterbox_downloading
    if _chatterbox is None:
        _chatterbox_downloading = True
        try:
            import torch
            from chatterbox.tts import ChatterboxTTS
            device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
            model = ChatterboxTTS.from_pretrained(device=device)
            if VOICE_REF_PATH.exists():
                model.prepare_conditionals(str(VOICE_REF_PATH))
            _chatterbox = model
        finally:
            _chatterbox_downloading = False
    return _chatterbox


# ── Request schema ────────────────────────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = Field(default=1.15, ge=0.5, le=2.0)
    engine: str = "kokoro"  # "vits" | "kokoro" | "chatterbox"


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
    elif req.engine == "chatterbox":
        audio, sample_rate = _synth_chatterbox(text, req.voice)
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


def _synth_chatterbox(text: str, voice: str, speed: float = 1.0):
    model = _get_chatterbox()
    params = CHATTERBOX_VOICES.get(voice, CHATTERBOX_VOICES["expressive"])
    wav = model.generate(text, **params)
    audio = wav.squeeze(0).cpu().numpy().astype(np.float32)
    return audio, model.sr


@app.get("/voice-upload")
def voice_status() -> dict:
    return {"name": "my-voice" if VOICE_REF_PATH.exists() else None}


@app.post("/voice-upload")
async def upload_voice(file: UploadFile = File(...)) -> dict:
    global _chatterbox
    with VOICE_REF_PATH.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    _chatterbox = None  # force re-load with new voice reference
    return {"name": "my-voice"}


@app.delete("/voice-upload")
def delete_voice() -> dict:
    global _chatterbox
    if VOICE_REF_PATH.exists():
        VOICE_REF_PATH.unlink()
    _chatterbox = None
    return {"status": "ok"}


# ── Discovery (YouTube audio → transcript) ────────────────────────────────────
class DiscoverRequest(BaseModel):
    url: str
    lang: str | None = None  # None = auto-detect


@app.post("/discover")
def discover(req: DiscoverRequest) -> dict:
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    try:
        result = discovery.discover(url, req.lang)
    except Exception as exc:  # yt-dlp / whisper failures → surface a clean message
        raise HTTPException(status_code=502, detail=f"discovery failed: {exc}") from exc
    return result.to_dict()


class ArticleRequest(BaseModel):
    url: str


@app.post("/discover/article")
def discover_article(req: ArticleRequest) -> dict:
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    try:
        result = discovery.discover_article(url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"article extraction failed: {exc}") from exc
    return result.to_dict()


@app.post("/discover/pdf")
async def discover_pdf(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large (max 25 MB)")
    try:
        result = discovery.discover_pdf(data, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PDF extraction failed: {exc}") from exc
    return result.to_dict()


@app.get("/discover/audio/{source_id}")
def discover_audio(source_id: str) -> FileResponse:
    # source_id is a 12-char sha1 prefix; reject anything else to avoid path traversal.
    if not source_id.isalnum() or len(source_id) != 12:
        raise HTTPException(status_code=400, detail="invalid source id")
    path = discovery.audio_path_for(source_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(str(path), media_type="audio/mpeg")


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), lang: str | None = None) -> dict:
    """E2 (speech): transcribe a recorded clip to text for the correction step."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="audio too large (max 25 MB)")
    suffix = Path(file.filename or "clip.webm").suffix or ".webm"
    try:
        text = discovery.transcribe_bytes(data, suffix, lang)
    except Exception as exc:  # whisper / ffmpeg failures → clean message
        raise HTTPException(status_code=502, detail=f"transcription failed: {exc}") from exc
    return {"text": text}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict:
    return {
        "downloading_model": _kokoro_downloading or _chatterbox_downloading or discovery.is_loading_model(),
        "downloading_kokoro": _kokoro_downloading,
        "downloading_chatterbox": _chatterbox_downloading,
        "downloading_whisper": discovery.is_loading_model(),
    }
