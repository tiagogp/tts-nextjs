#!/usr/bin/env python3
"""
CSV → TTS → .apkg (Anki package) generator.

Takes a CSV with Portuguese + English text, generates audio locally,
and writes an Anki deck package you can import anywhere.

Example:
  backend/.venv/bin/python backend/apkg_from_csv.py \
    --csv cards.csv \
    --deck "English - new method" \
    --pt-col pt \
    --en-col en \
    --out deck.apkg
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import genanki
import numpy as np
import soundfile as sf


VITS_EN_MODEL = "tts_models/en/vctk/vits"
VITS_PT_MODEL_DEFAULT = "tts_models/pt/cv/vits"

VITS_EN_SPEAKERS: dict[str, str] = {
    "female-1": "p225",
    "female-2": "p228",
    "male-1": "p226",
    "male-2": "p278",
    "neutral": "p270",
}


def _eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _sha1_12(text: str) -> str:
    return _sha1(text)[:12]


def _stable_id_u31(namespace: str, name: str) -> int:
    """
    genanki requires integer IDs. Keep them stable across runs:
    a 31-bit positive int derived from sha1(namespace|name).
    """
    h = int(_sha1(f"{namespace}|{name}")[:8], 16)
    return h & 0x7FFFFFFF


def _parse_col(value: str) -> int | str:
    value = value.strip()
    if value.isdigit():
        return int(value)
    return value


def _get_cell(row: dict[str, str] | list[str], col: int | str, *, has_header: bool) -> str:
    if has_header:
        if isinstance(col, int):
            raise ValueError("Numeric column indices require --no-header")
        if not isinstance(row, dict):
            raise ValueError("Internal error: expected dict row when CSV has header")
        return (row.get(col) or "").strip()
    else:
        if isinstance(col, str):
            raise ValueError("Header column names require CSV with a header row")
        if not isinstance(row, list):
            raise ValueError("Internal error: expected list row when CSV has no header")
        if col < 0 or col >= len(row):
            return ""
        return (row[col] or "").strip()


def _csv_rows(path: Path, delimiter: str, has_header: bool) -> Iterable[dict[str, str] | list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        if has_header:
            yield from csv.DictReader(f, delimiter=delimiter)
        else:
            yield from csv.reader(f, delimiter=delimiter)


@dataclass(frozen=True)
class TTSConfig:
    model_name: str
    speaker: str | None = None
    speed: float = 1.0
    gpu: bool = False


class CoquiSynth:
    def __init__(self) -> None:
        self._models: dict[str, Any] = {}

    def _get(self, model_name: str, gpu: bool):
        from TTS.api import TTS  # lazy import (heavy)

        key = f"{model_name}::gpu={gpu}"
        model = self._models.get(key)
        if model is None:
            model = TTS(model_name, progress_bar=True, gpu=gpu)
            self._models[key] = model
        return model

    def synth_wav_bytes(self, text: str, cfg: TTSConfig) -> bytes:
        model = self._get(cfg.model_name, cfg.gpu)
        kwargs: dict[str, Any] = {"text": text}
        if cfg.speaker:
            kwargs["speaker"] = cfg.speaker
        try:
            wav = model.tts(**kwargs, speed=cfg.speed)
        except TypeError:
            wav = model.tts(**kwargs)

        sample_rate = getattr(getattr(model, "synthesizer", None), "output_sample_rate", None) or 22050
        buf = io.BytesIO()
        sf.write(
            buf,
            np.asarray(wav, dtype=np.float32),
            int(sample_rate),
            format="WAV",
            subtype="PCM_16",
        )
        return buf.getvalue()


@dataclass(frozen=True)
class KokoroConfig:
    voice: str = "af_heart"
    speed: float = 1.0
    lang_code: str | None = None


def _kokoro_lang_code(voice: str, lang_code: str | None) -> str:
    if lang_code:
        return lang_code
    if voice:
        return voice[0]
    return "a"


class KokoroSynth:
    def __init__(self) -> None:
        self._pipelines: dict[str, Any] = {}

    def _get(self, lang_code: str):
        from kokoro import KPipeline  # lazy import (downloads model on first run)

        pipeline = self._pipelines.get(lang_code)
        if pipeline is None:
            pipeline = KPipeline(lang_code=lang_code)
            self._pipelines[lang_code] = pipeline
        return pipeline

    def synth_wav_bytes(self, text: str, cfg: KokoroConfig) -> bytes:
        lang_code = _kokoro_lang_code(cfg.voice, cfg.lang_code)
        pipeline = self._get(lang_code)
        chunks = [audio for _, _, audio in pipeline(text, voice=cfg.voice, speed=float(cfg.speed))]
        combined = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)

        buf = io.BytesIO()
        sf.write(
            buf,
            np.asarray(combined, dtype=np.float32),
            24000,
            format="WAV",
            subtype="PCM_16",
        )
        return buf.getvalue()


def _sound_tag(filename: str) -> str:
    return f"[sound:{filename}]"


_FILENAME_SAFE_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_name(text: str, *, limit: int = 48) -> str:
    text = _FILENAME_SAFE_RE.sub("_", text.strip())
    text = text.strip("._-")
    if not text:
        return "card"
    return text[:limit]


def _mk_model(model_name: str) -> genanki.Model:
    model_id = _stable_id_u31("anki_model", model_name)
    return genanki.Model(
        model_id,
        model_name,
        fields=[
            {"name": "Front"},
            {"name": "Back"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": "{{FrontSide}}<hr id=answer>{{Back}}",
            }
        ],
        css="""
.card { font-family: arial; font-size: 22px; text-align: left; color: black; background-color: white; }
hr#answer { margin: 12px 0; }
""".strip(),
    )


def _mk_card_model(model_name: str) -> genanki.Model:
    """
    Extended note type for the card pipeline (B2). Additive over the basic PT/EN
    model: keeps Front/Back and adds the fields that let a card isolate the concept
    it tests and link back to the source that produced it (grounding / traceability).
    """
    model_id = _stable_id_u31("anki_model", model_name)
    return genanki.Model(
        model_id,
        model_name,
        fields=[
            {"name": "Front"},
            {"name": "Back"},
            {"name": "Audio"},
            {"name": "Concept"},
            {"name": "ErrorType"},
            {"name": "Source"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": (
                    "{{FrontSide}}<hr id=answer>{{Back}}<br>{{Audio}}"
                    "{{#Concept}}<div class=\"concept\">🎯 {{Concept}}</div>{{/Concept}}"
                    "{{#ErrorType}}<div class=\"errortype\">{{ErrorType}}</div>{{/ErrorType}}"
                ),
            }
        ],
        css="""
.card { font-family: arial; font-size: 22px; text-align: left; color: black; background-color: white; }
hr#answer { margin: 12px 0; }
.concept { margin-top: 12px; font-size: 14px; color: #ff5600; }
.errortype { margin-top: 4px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
""".strip(),
    )


def _slice_clip(src_mp3: Path, start_ms: int, end_ms: int, out_path: Path) -> bool:
    """
    Cut [start_ms, end_ms] out of the cached native audio with ffmpeg (B3).
    Re-encodes so the cut is sample-accurate. Returns True on success.
    """
    if out_path.exists():
        return True
    start_s = max(0.0, start_ms / 1000.0)
    duration_s = max(0.05, (end_ms - start_ms) / 1000.0)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(src_mp3),
        "-ss", f"{start_s:.3f}",
        "-t", f"{duration_s:.3f}",
        "-acodec", "libmp3lame", "-q:a", "4",
        str(out_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True)
    except FileNotFoundError:
        _eprint("ffmpeg not found on PATH — falling back to TTS for native clips.")
        return False
    if proc.returncode != 0:
        _eprint(f"ffmpeg slice failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
        return False
    return out_path.exists()


def build_cards_deck(args: argparse.Namespace) -> int:
    """
    Card-pipeline export (B1/B2/B3): read a JSON array of generated cards and build
    a deck with the extended note type. Audio is the sliced native clip when the
    card carries clip coordinates, otherwise Kokoro TTS of the answer.

    Each card: { front, back, audioText?, concept?, errorType?, source?: {kind,id},
                 clip?: { sourceId, startMs, endMs } }
    """
    cards_path = Path(args.cards_json)
    if not cards_path.exists():
        _eprint(f"cards JSON not found: {cards_path}")
        return 2

    out_path = Path(args.out)
    if out_path.suffix.lower() != ".apkg":
        _eprint("--out must end with .apkg")
        return 2

    try:
        cards = json.loads(cards_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        _eprint(f"invalid cards JSON: {exc}")
        return 2
    if not isinstance(cards, list):
        _eprint("cards JSON must be an array of card objects")
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    discover_cache = Path(args.discover_cache) if args.discover_cache else None

    synth_kokoro = KokoroSynth()
    cfg_en_kokoro = KokoroConfig(
        voice=str(args.en_kokoro_voice),
        speed=float(args.en_kokoro_speed),
        lang_code=str(args.en_kokoro_lang) if args.en_kokoro_lang else None,
    )

    model = _mk_card_model(str(args.model_name))
    deck_name = str(args.deck)
    deck = genanki.Deck(_stable_id_u31("anki_deck", deck_name), deck_name)

    media_files: list[str] = []
    added = 0
    skipped = 0

    for i, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            skipped += 1
            continue
        front = str(card.get("front") or "").strip()
        back = str(card.get("back") or "").strip()
        if not front or not back:
            skipped += 1
            continue
        audio_text = str(card.get("audioText") or back).strip() or back

        concept = str(card.get("concept") or "").strip()
        error_type = str(card.get("errorType") or "").strip()
        source = card.get("source") if isinstance(card.get("source"), dict) else None
        source_str = f"{source.get('kind')}:{source.get('id')}" if source else ""

        audio_tag = ""
        clip = card.get("clip") if isinstance(card.get("clip"), dict) else None
        clip_done = False
        if clip and discover_cache:
            src_id = str(clip.get("sourceId") or "")
            start_ms = int(clip.get("startMs") or 0)
            end_ms = int(clip.get("endMs") or 0)
            src_mp3 = discover_cache / f"{src_id}.mp3"
            if src_id and end_ms > start_ms and src_mp3.exists():
                clip_filename = f"clip_{src_id}_{start_ms}_{end_ms}.mp3"
                clip_path = out_dir / clip_filename
                if _slice_clip(src_mp3, start_ms, end_ms, clip_path):
                    media_files.append(str(clip_path))
                    audio_tag = _sound_tag(clip_filename)
                    clip_done = True

        # Fallback: synthesize the source sentence for Discover cards, or Back otherwise.
        if not clip_done:
            tts_key = f"card|kokoro|{cfg_en_kokoro.lang_code}|{cfg_en_kokoro.voice}|{cfg_en_kokoro.speed}|{audio_text}"
            tts_filename = f"anki_tts_en_{_sha1_12(tts_key)}.wav"
            tts_path = out_dir / tts_filename
            if not tts_path.exists():
                tts_path.write_bytes(synth_kokoro.synth_wav_bytes(audio_text, cfg_en_kokoro))
            media_files.append(str(tts_path))
            audio_tag = _sound_tag(tts_filename)

        guid = _sha1(f"{deck_name}|{front}|{back}|{source_str}")
        note = genanki.Note(
            model=model,
            fields=[front, back, audio_tag, concept, error_type, source_str],
            guid=guid,
            tags=["card-pipeline"],
        )
        deck.add_note(note)
        added += 1

    media_files = list(dict.fromkeys(media_files))
    pkg = genanki.Package(deck)
    pkg.media_files = media_files
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pkg.write_to_file(str(out_path))

    _eprint(f"Done. Wrote {out_path} with {added} cards. Skipped {skipped} invalid.")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Generate an Anki .apkg from a PT/EN CSV")
    parser.add_argument("--csv", help="Path to CSV file (PT/EN mode)")
    parser.add_argument(
        "--cards-json",
        dest="cards_json",
        help="Path to a JSON array of generated cards (card-pipeline mode; overrides --csv)",
    )
    parser.add_argument(
        "--discover-cache",
        dest="discover_cache",
        default=None,
        help="Directory holding cached source mp3s, for native-clip slicing (card-pipeline mode)",
    )
    parser.add_argument("--delimiter", default=",", help="CSV delimiter (default: ,)")
    parser.add_argument("--no-header", action="store_true", help="Treat CSV as having no header row")
    parser.add_argument("--pt-col", default="pt", help='Portuguese column name or index (default: "pt")')
    parser.add_argument("--en-col", default="en", help='English column name or index (default: "en")')
    parser.add_argument("--deck", required=True, help='Deck name (e.g. "English - new method")')
    parser.add_argument("--model-name", default="Basic (TTS Import)", help="Note type name embedded in the package")
    parser.add_argument("--out", required=True, help="Output .apkg path")
    parser.add_argument("--out-dir", default="backend/.anki_tts_out", help="Where to cache generated WAVs")
    parser.add_argument(
        "--pt-audio",
        action="store_true",
        help="Also generate Portuguese audio (default: off)",
    )

    parser.add_argument(
        "--en-engine",
        default="kokoro",
        choices=["vits", "kokoro"],
        help='English TTS engine (default: "kokoro")',
    )
    parser.add_argument("--en-model", default=VITS_EN_MODEL, help=f'Coqui model for English (default: "{VITS_EN_MODEL}")')
    parser.add_argument(
        "--en-voice",
        default="female-1",
        choices=sorted(VITS_EN_SPEAKERS.keys()),
        help="English VITS voice (default: female-1)",
    )
    parser.add_argument("--en-speed", type=float, default=1.0, help="English speed (0.5–2.0 recommended)")
    parser.add_argument(
        "--en-kokoro-voice",
        default="af_heart",
        help='English Kokoro voice id (default: "af_heart")',
    )
    parser.add_argument(
        "--en-kokoro-speed",
        type=float,
        default=1.15,
        help='English Kokoro speed (default: 1.15)',
    )
    parser.add_argument(
        "--en-kokoro-lang",
        default=None,
        help='English Kokoro lang_code (default: inferred from voice, e.g. "a")',
    )

    parser.add_argument(
        "--pt-model",
        default=VITS_PT_MODEL_DEFAULT,
        help=f'Coqui model for Portuguese (default: "{VITS_PT_MODEL_DEFAULT}")',
    )
    parser.add_argument("--pt-speed", type=float, default=1.0, help="Portuguese speed (0.5–2.0 recommended)")
    parser.add_argument("--gpu", action="store_true", help="Use GPU if available (Coqui TTS)")

    args = parser.parse_args(argv)

    # Card-pipeline mode (B1/B2/B3): generated cards + native clips / extended note type.
    if args.cards_json:
        return build_cards_deck(args)

    if not args.csv:
        _eprint("--csv is required (or use --cards-json for the card pipeline)")
        return 2

    csv_path = Path(args.csv)
    if not csv_path.exists():
        _eprint(f"CSV not found: {csv_path}")
        return 2

    out_path = Path(args.out)
    if out_path.suffix.lower() != ".apkg":
        _eprint("--out must end with .apkg")
        return 2

    delimiter = args.delimiter
    if len(delimiter) != 1:
        _eprint("--delimiter must be a single character")
        return 2

    has_header = not args.no_header
    pt_col = _parse_col(args.pt_col)
    en_col = _parse_col(args.en_col)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    synth_coqui = CoquiSynth()
    synth_kokoro = KokoroSynth()

    cfg_pt = TTSConfig(model_name=args.pt_model, speaker=None, speed=float(args.pt_speed), gpu=bool(args.gpu))
    en_engine = str(args.en_engine)
    if en_engine == "kokoro":
        cfg_en_kokoro = KokoroConfig(
            voice=str(args.en_kokoro_voice),
            speed=float(args.en_kokoro_speed),
            lang_code=str(args.en_kokoro_lang) if args.en_kokoro_lang else None,
        )
        cfg_en = None
    else:
        en_speaker = VITS_EN_SPEAKERS[args.en_voice]
        cfg_en = TTSConfig(model_name=args.en_model, speaker=en_speaker, speed=float(args.en_speed), gpu=bool(args.gpu))
        cfg_en_kokoro = None

    model = _mk_model(str(args.model_name))
    deck_name = str(args.deck)
    deck_id = _stable_id_u31("anki_deck", deck_name)
    deck = genanki.Deck(deck_id, deck_name)

    media_files: list[str] = []
    added = 0
    skipped = 0

    for i, row in enumerate(_csv_rows(csv_path, delimiter=delimiter, has_header=has_header), start=1):
        pt_text = _get_cell(row, pt_col, has_header=has_header)
        en_text = _get_cell(row, en_col, has_header=has_header)
        if not pt_text and not en_text:
            skipped += 1
            continue

        if en_engine == "kokoro":
            assert cfg_en_kokoro is not None
            en_key = f"en|kokoro|{cfg_en_kokoro.lang_code}|{cfg_en_kokoro.voice}|{cfg_en_kokoro.speed}|{en_text}"
        else:
            assert cfg_en is not None
            en_key = f"en|vits|{cfg_en.model_name}|{cfg_en.speaker}|{cfg_en.speed}|{en_text}"
        pt_key = f"pt|{cfg_pt.model_name}|{cfg_pt.speed}|{pt_text}"
        en_filename = f"anki_tts_en_{_sha1_12(en_key)}.wav"
        pt_filename = f"anki_tts_pt_{_sha1_12(pt_key)}.wav"

        front_parts: list[str] = []
        back_parts: list[str] = []

        # Front: English + audio (Kokoro by default)
        if en_text:
            en_wav_path = out_dir / en_filename
            if not en_wav_path.exists():
                if en_engine == "kokoro":
                    assert cfg_en_kokoro is not None
                    en_wav_path.write_bytes(synth_kokoro.synth_wav_bytes(en_text, cfg_en_kokoro))
                else:
                    assert cfg_en is not None
                    en_wav_path.write_bytes(synth_coqui.synth_wav_bytes(en_text, cfg_en))
            media_files.append(str(en_wav_path))
            front_parts.append(en_text)
            front_parts.append(_sound_tag(en_filename))

        # Back: Portuguese text; audio optional
        if pt_text:
            back_parts.append(pt_text)
            if bool(args.pt_audio):
                pt_wav_path = out_dir / pt_filename
                if not pt_wav_path.exists():
                    pt_wav_path.write_bytes(synth_coqui.synth_wav_bytes(pt_text, cfg_pt))
                media_files.append(str(pt_wav_path))
                back_parts.append(_sound_tag(pt_filename))

        front = "<br>".join(front_parts).strip() or "(empty)"
        back = "<br>".join(back_parts).strip() or "(empty)"

        guid = _sha1(f"{deck_name}|{front}|{back}")
        note = genanki.Note(
            model=model,
            fields=[front, back],
            guid=guid,
            tags=["tts-import"],
        )
        deck.add_note(note)
        added += 1

        if i % 25 == 0:
            _eprint(f"Processed {i} rows…")

    # Deduplicate media paths (keep order).
    media_files = list(dict.fromkeys(media_files))

    pkg = genanki.Package(deck)
    pkg.media_files = media_files
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pkg.write_to_file(str(out_path))

    _eprint(f"Done. Wrote {out_path} with {added} notes. Skipped {skipped} empty rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
