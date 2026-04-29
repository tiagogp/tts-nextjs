#!/usr/bin/env python3
"""
Import a CSV with Portuguese + English text, generate TTS audio locally,
and create Anki notes via AnkiConnect.

Prereqs:
  - Anki Desktop running
  - AnkiConnect installed + enabled (default: http://127.0.0.1:8765)
  - backend/.venv with requirements installed

Example:
  backend/.venv/bin/python backend/anki_csv_import.py \\
    --csv cards.csv \\
    --deck "My Deck" \\
    --pt-col Portuguese \\
    --en-col English
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import soundfile as sf
from TTS.api import TTS


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


def _sha1_12(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def _parse_col(value: str) -> int | str:
    value = value.strip()
    if value.isdigit():
        return int(value)
    return value


def _get_cell(row: dict[str, str] | list[str], col: int | str) -> str:
    if isinstance(row, dict):
        if isinstance(col, int):
            raise ValueError("Numeric column indices require CSV without headers")
        return (row.get(col) or "").strip()
    else:
        if isinstance(col, str):
            raise ValueError("Header column names require CSV with headers")
        if col < 0 or col >= len(row):
            return ""
        return (row[col] or "").strip()


def _csv_rows(path: Path, delimiter: str, has_header: bool) -> Iterable[dict[str, str] | list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        if has_header:
            reader = csv.DictReader(f, delimiter=delimiter)
            yield from reader
        else:
            reader = csv.reader(f, delimiter=delimiter)
            yield from reader


def anki_invoke(url: str, action: str, params: dict[str, Any]) -> Any:
    payload = {"action": action, "version": 6, "params": params}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Failed to reach AnkiConnect at {url}: {e}") from e

    out = json.loads(body)
    if out.get("error") is not None:
        raise RuntimeError(f"AnkiConnect error for {action}: {out['error']}")
    return out.get("result")


def anki_store_media(url: str, filename: str, data: bytes) -> None:
    anki_invoke(
        url,
        "storeMediaFile",
        {"filename": filename, "data": base64.b64encode(data).decode("ascii")},
    )


@dataclass(frozen=True)
class TTSConfig:
    model_name: str
    speaker: str | None = None
    speed: float = 1.0
    gpu: bool = False


class CoquiSynth:
    def __init__(self) -> None:
        self._models: dict[str, TTS] = {}

    def _get(self, model_name: str, gpu: bool) -> TTS:
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
        # Some models accept speed; others don't.
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


def _sound_tag(filename: str) -> str:
    return f"[sound:{filename}]"


def _ensure_deck(url: str, deck: str) -> None:
    anki_invoke(url, "createDeck", {"deck": deck})


def _add_notes_checked(url: str, notes: list[dict[str, Any]]) -> tuple[int, int]:
    """
    Returns: (added_count, rejected_count)
    """
    checks = anki_invoke(url, "canAddNotesWithErrorDetail", {"notes": notes}) or []
    to_add: list[dict[str, Any]] = []
    rejected = 0

    for note, check in zip(notes, checks, strict=False):
        can_add = bool(check.get("canAdd")) if isinstance(check, dict) else True
        if can_add:
            to_add.append(note)
        else:
            rejected += 1
            err = check.get("error") if isinstance(check, dict) else "unknown error"
            _eprint(f"Skipped note: {err}")

    if not to_add:
        return (0, rejected)

    result = anki_invoke(url, "addNotes", {"notes": to_add}) or []
    added = sum(1 for nid in result if nid)
    failed = len(to_add) - added
    if failed:
        _eprint(f"Warning: {failed} notes failed to add (see AnkiConnect for details).")
    return (added, rejected + failed)


def _note_payload(
    deck: str,
    model: str,
    front_field: str,
    back_field: str,
    front: str,
    back: str,
    allow_duplicate: bool,
    duplicate_scope: str,
    duplicate_scope_deck_name: str | None,
    tags: list[str],
) -> dict[str, Any]:
    options: dict[str, Any] = {
        "allowDuplicate": allow_duplicate,
        "duplicateScope": duplicate_scope,
    }
    if duplicate_scope_deck_name:
        options["duplicateScopeOptions"] = {"deckName": duplicate_scope_deck_name, "checkChildren": False}
    return {
        "deckName": deck,
        "modelName": model,
        "fields": {front_field: front, back_field: back},
        "options": options,
        "tags": tags,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="CSV → TTS → Anki (via AnkiConnect)")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument("--delimiter", default=",", help="CSV delimiter (default: ,)")
    parser.add_argument("--no-header", action="store_true", help="Treat CSV as having no header row")
    parser.add_argument("--pt-col", default="pt", help='Portuguese column name or index (default: "pt")')
    parser.add_argument("--en-col", default="en", help='English column name or index (default: "en")')
    parser.add_argument("--deck", required=True, help='Target Anki deck (e.g. "English")')
    parser.add_argument("--note-type", default="Basic", help='Anki note type (default: "Basic")')
    parser.add_argument("--front-field", default="Front", help='Field name for the "front" text (default: Front)')
    parser.add_argument("--back-field", default="Back", help='Field name for the "back" text (default: Back)')
    parser.add_argument("--anki-url", default="http://127.0.0.1:8765", help="AnkiConnect URL")
    parser.add_argument("--out-dir", default="backend/.anki_tts_out", help="Where to cache generated WAVs")

    parser.add_argument("--en-model", default=VITS_EN_MODEL, help=f'Coqui model for English (default: "{VITS_EN_MODEL}")')
    parser.add_argument(
        "--en-voice",
        default="female-1",
        choices=sorted(VITS_EN_SPEAKERS.keys()),
        help="English VITS voice (default: female-1)",
    )
    parser.add_argument("--en-speed", type=float, default=1.0, help="English speed (0.5–2.0 recommended)")

    parser.add_argument(
        "--pt-model",
        default=VITS_PT_MODEL_DEFAULT,
        help=f'Coqui model for Portuguese (default: "{VITS_PT_MODEL_DEFAULT}")',
    )
    parser.add_argument("--pt-speed", type=float, default=1.0, help="Portuguese speed (0.5–2.0 recommended)")

    parser.add_argument("--gpu", action="store_true", help="Use GPU if available (Coqui TTS)")
    parser.add_argument("--allow-duplicate", action="store_true", help="Allow duplicate notes")
    parser.add_argument(
        "--duplicate-scope",
        default="deck",
        choices=["deck", "collection"],
        help="Duplicate check scope (default: deck)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="How many notes to add per AnkiConnect request (default: 25)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Generate audio but don't call AnkiConnect")
    parser.add_argument("--tag", action="append", default=["tts-import"], help="Tag to add (repeatable)")

    args = parser.parse_args(argv)

    csv_path = Path(args.csv)
    if not csv_path.exists():
        _eprint(f"CSV not found: {csv_path}")
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

    anki_url: str = args.anki_url
    deck: str = args.deck
    note_type: str = args.note_type
    front_field: str = args.front_field
    back_field: str = args.back_field
    tags: list[str] = list(dict.fromkeys([t.strip() for t in (args.tag or []) if t.strip()])) or ["tts-import"]

    duplicate_scope = args.duplicate_scope
    duplicate_scope_deck_name = deck if duplicate_scope == "deck" else None

    synth = CoquiSynth()

    if not args.dry_run:
        _ensure_deck(anki_url, deck)

    en_speaker = VITS_EN_SPEAKERS[args.en_voice]
    cfg_en = TTSConfig(model_name=args.en_model, speaker=en_speaker, speed=float(args.en_speed), gpu=bool(args.gpu))
    cfg_pt = TTSConfig(model_name=args.pt_model, speaker=None, speed=float(args.pt_speed), gpu=bool(args.gpu))

    notes_buffer: list[dict[str, Any]] = []
    total_added = 0
    total_rejected = 0
    skipped = 0

    for i, row in enumerate(_csv_rows(csv_path, delimiter=delimiter, has_header=has_header), start=1):
        pt_text = _get_cell(row, pt_col)
        en_text = _get_cell(row, en_col)
        if not pt_text and not en_text:
            skipped += 1
            continue

        # Stable filenames per text+config so reruns don't duplicate media.
        en_key = f"en|{cfg_en.model_name}|{cfg_en.speaker}|{cfg_en.speed}|{en_text}"
        pt_key = f"pt|{cfg_pt.model_name}|{cfg_pt.speed}|{pt_text}"
        en_filename = f"anki_tts_en_{_sha1_12(en_key)}.wav"
        pt_filename = f"anki_tts_pt_{_sha1_12(pt_key)}.wav"

        front_parts: list[str] = []
        back_parts: list[str] = []

        if pt_text:
            pt_wav_path = out_dir / pt_filename
            if not pt_wav_path.exists():
                wav_bytes = synth.synth_wav_bytes(pt_text, cfg_pt)
                pt_wav_path.write_bytes(wav_bytes)
            if not args.dry_run:
                anki_store_media(anki_url, pt_filename, pt_wav_path.read_bytes())
            front_parts.append(pt_text)
            front_parts.append(_sound_tag(pt_filename))

        if en_text:
            en_wav_path = out_dir / en_filename
            if not en_wav_path.exists():
                wav_bytes = synth.synth_wav_bytes(en_text, cfg_en)
                en_wav_path.write_bytes(wav_bytes)
            if not args.dry_run:
                anki_store_media(anki_url, en_filename, en_wav_path.read_bytes())
            back_parts.append(en_text)
            back_parts.append(_sound_tag(en_filename))

        front = "<br>".join(front_parts).strip()
        back = "<br>".join(back_parts).strip()

        note = _note_payload(
            deck=deck,
            model=note_type,
            front_field=front_field,
            back_field=back_field,
            front=front or "(empty)",
            back=back or "(empty)",
            allow_duplicate=bool(args.allow_duplicate),
            duplicate_scope=duplicate_scope,
            duplicate_scope_deck_name=duplicate_scope_deck_name,
            tags=tags,
        )
        notes_buffer.append(note)

        if len(notes_buffer) >= int(args.batch_size):
            if not args.dry_run:
                added, rejected = _add_notes_checked(anki_url, notes_buffer)
                total_added += added
                total_rejected += rejected
            else:
                total_added += len(notes_buffer)
            notes_buffer.clear()

        if i % 25 == 0:
            _eprint(f"Processed {i} rows…")

    if notes_buffer:
        if not args.dry_run:
            added, rejected = _add_notes_checked(anki_url, notes_buffer)
            total_added += added
            total_rejected += rejected
        else:
            total_added += len(notes_buffer)

    if args.dry_run:
        _eprint(f"Dry run done. Would add {total_added} notes. Skipped {skipped} empty rows.")
    else:
        _eprint(
            f"Done. Added {total_added} notes. Rejected {total_rejected}. Skipped {skipped} empty rows."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
