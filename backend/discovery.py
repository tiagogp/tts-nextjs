"""
Discovery ingestion: turn native material into a reviewable transcript with timestamps.

Sources (all converge on the same DiscoverResult → PhraseCandidate → Card pipeline):
  • YouTube / yt-dlp — audio only (the mp4 is never downloaded). A fast path uses the
    video's own captions when present; otherwise faster-whisper transcribes locally.
    Either way the audio is cached so we can slice the exact native clip per phrase.
  • Article / URL — main text extracted with trafilatura, split into sentences (no audio).
  • PDF — text extracted with pypdf, split into sentences (no audio).

Text-only sources carry no timestamps (hasAudio=False); their cards fall back to Kokoro
TTS of the source sentence in the .apkg engine.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import threading
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

CACHE_DIR = Path(__file__).parent / ".discover_cache"
CACHE_DIR.mkdir(exist_ok=True)

# faster-whisper model size. "small" is a good speed/quality balance on Mac CPU.
# "base" is faster, "medium"/"large-v3" are more accurate but heavier.
WHISPER_MODEL_SIZE = "small"

_model: Any = None
_model_lock = threading.Lock()
_loading_model = False


def _source_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def audio_path_for(source_id: str) -> Path:
    return CACHE_DIR / f"{source_id}.mp3"


@dataclass(frozen=True)
class Segment:
    text: str
    startMs: int
    endMs: int


@dataclass(frozen=True)
class DiscoverResult:
    sourceId: str
    title: str
    segments: list[Segment]
    # False for text-only sources (article / PDF): no cached audio, no native clips.
    hasAudio: bool = True

    def to_dict(self) -> dict:
        return {
            "sourceId": self.sourceId,
            "title": self.title,
            "segments": [asdict(s) for s in self.segments],
            "hasAudio": self.hasAudio,
        }


def is_loading_model() -> bool:
    return _loading_model


def _get_model():
    global _model, _loading_model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _loading_model = True
            try:
                # int8 on CPU keeps memory low and is fast enough for this use.
                _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
            finally:
                _loading_model = False
    return _model


def download_audio(url: str) -> tuple[str, str, dict]:
    """Download audio only via yt-dlp. Returns (source_id, title, info).

    `info` carries the metadata yt-dlp already extracted — including the available
    caption tracks — so we can take the captions fast path without a second request.
    """
    import yt_dlp

    source_id = _source_id(url)
    target = audio_path_for(source_id)

    # yt-dlp appends the extension itself; give it the stem.
    outtmpl = str(CACHE_DIR / f"{source_id}.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=not target.exists())
        title = info.get("title") or "Untitled"

    return source_id, title, info


def _pick_caption_track(info: dict, lang: str | None) -> list[dict] | None:
    """Pick the best caption track from yt-dlp info — manual subs over auto-captions."""
    def choose(tracks: dict[str, list] | None) -> list | None:
        if not tracks:
            return None
        keys = list(tracks.keys())
        key = None
        if lang:
            key = next((k for k in keys if k == lang or k.startswith(f"{lang}-")), None)
        if not key:
            key = next((k for k in keys if k.startswith("en")), None) or (keys[0] if keys else None)
        return tracks.get(key) if key else None

    # Human-written subtitles are cleaner than auto-generated ones.
    return choose(info.get("subtitles")) or choose(info.get("automatic_captions"))


def _captions_from_info(info: dict, lang: str | None) -> list[Segment] | None:
    """Fast path: turn YouTube's own captions into Segments, skipping Whisper.

    Returns None when no usable json3 caption track exists, so the caller can fall
    back to transcription.
    """
    track = _pick_caption_track(info, lang)
    if not track:
        return None
    j3 = next((t for t in track if t.get("ext") == "json3" and t.get("url")), None)
    if not j3:
        return None
    try:
        with urllib.request.urlopen(j3["url"], timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

    segments: list[Segment] = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text:
            continue
        start = int(event.get("tStartMs", 0))
        dur = int(event.get("dDurationMs", 0))
        segments.append(Segment(text=text, startMs=start, endMs=start + dur))
    return segments or None


# Split a text blob into sentence-ish chunks for review. Used by text-only sources.
def _segment_text(text: str) -> list[Segment]:
    collapsed = re.sub(r"\s+", " ", text).strip()
    chunks = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'(À-ſ])", collapsed)
    segments: list[Segment] = []
    seen: set[str] = set()
    for chunk in chunks:
        s = chunk.strip()
        # Skip fragments too short to be worth a card.
        if len(s) < 8:
            continue
        key = re.sub(r"\W+", " ", s, flags=re.UNICODE).strip().casefold()
        if key in seen:
            continue
        seen.add(key)
        segments.append(Segment(text=s[:1000], startMs=0, endMs=0))
    return segments


def _dedupe_segments(segments: list[Segment]) -> list[Segment]:
    """Drop exact repeated transcript/caption lines while preserving first timing."""
    out: list[Segment] = []
    seen: set[str] = set()
    for seg in segments:
        key = re.sub(r"\W+", " ", seg.text, flags=re.UNICODE).strip().casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(seg)
    return out


def transcribe(source_id: str, lang: str | None) -> list[Segment]:
    """Transcribe the cached audio with faster-whisper. lang=None auto-detects."""
    audio = audio_path_for(source_id)
    if not audio.exists():
        raise FileNotFoundError(f"audio not found for source {source_id}")

    model = _get_model()
    segments_gen, _info = model.transcribe(
        str(audio),
        language=lang,
        vad_filter=True,  # drop long silences -> tighter segments
    )

    segments: list[Segment] = []
    for seg in segments_gen:
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append(
            Segment(
                text=text,
                startMs=int(seg.start * 1000),
                endMs=int(seg.end * 1000),
            )
        )
    return segments


def transcribe_bytes(data: bytes, suffix: str, lang: str | None) -> str:
    """Transcribe an uploaded audio clip (e.g. a mic recording) to plain text.

    Writes the bytes to a temp file because faster-whisper reads from a path, runs the
    same model as the discovery path, and joins the segments into one passage for the
    correction step. lang=None auto-detects.
    """
    import tempfile

    model = _get_model()
    with tempfile.NamedTemporaryFile(suffix=suffix or ".webm", delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        segments_gen, _info = model.transcribe(tmp.name, language=lang, vad_filter=True)
        parts = [(seg.text or "").strip() for seg in segments_gen]
    return " ".join(p for p in parts if p).strip()


def discover(url: str, lang: str | None) -> DiscoverResult:
    """YouTube path. Captions fast path when available, else local Whisper.

    The audio is cached in both cases so the .apkg engine can slice native clips.
    """
    source_id, title, info = download_audio(url)
    segments = _captions_from_info(info, lang)  # C3: skip Whisper when captions exist
    if segments is None:
        segments = transcribe(source_id, lang)
    segments = _dedupe_segments(segments)
    return DiscoverResult(sourceId=source_id, title=title, segments=segments, hasAudio=True)


def discover_article(url: str) -> DiscoverResult:
    """C2: extract the main text of an article/URL and split it into reviewable sentences."""
    import trafilatura

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError("could not fetch that URL")
    text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
    if not text or not text.strip():
        raise ValueError("no readable article text found at that URL")

    title = "Article"
    try:
        meta = trafilatura.extract_metadata(downloaded)
        if meta and meta.title:
            title = meta.title
    except Exception:
        pass

    return DiscoverResult(
        sourceId=_source_id(url),
        title=title,
        segments=_segment_text(text),
        hasAudio=False,
    )


def discover_pdf(data: bytes, filename: str | None) -> DiscoverResult:
    """C1: extract text from a PDF and split it into reviewable sentences."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:
        raise ValueError(f"could not read PDF: {exc}") from exc
    if not text.strip():
        raise ValueError("no extractable text in this PDF (it may be scanned images)")

    title = (filename or "PDF").rsplit(".", 1)[0] or "PDF"
    return DiscoverResult(
        sourceId=hashlib.sha1(data).hexdigest()[:12],
        title=title,
        segments=_segment_text(text),
        hasAudio=False,
    )
