# native-audio — real native-speaker recordings

This directory is the committed source of truth for genuine native-speaker clips.
`yarn learn:audio` installs everything here into `public/` (which is gitignored and
otherwise filled by Kokoro synthesis) and **never** synthesizes over a native recording —
`--force` included.

This exists for the W5 differentiation gate
([docs/validation-action-plan.md](../docs/validation-action-plan.md), Phase 1):
"native audio, not a robotic re-read" must be true from minute one, so no Kokoro audio may
remain anywhere in the guided first-run loop.

## How to add a recording

1. Export the clip as **16-bit PCM WAV** (mono is fine; any sample rate). Keep it short —
   just the phrase, trimmed, no leading/trailing silence beyond ~0.2s.
2. Save it here mirroring the clip path declared in
   `src/features/learn/lessons.json`. Examples:
   - `/learn/audio/a2-food/01.wav` → `native-audio/learn/audio/a2-food/01.wav`
   - `/demo/audio/03.wav` → `native-audio/demo/audio/03.wav`
3. Add a provenance entry to [manifest.json](manifest.json) — **required**, the build fails
   without it:

   ```json
   {
     "clip": "/learn/audio/a2-food/01.wav",
     "speaker": "Jane D. (US English, native)",
     "license": "own recording — released for PhraseLoop bundling",
     "recordedAt": "2026-07-10"
   }
   ```

   `speaker` and `license` are mandatory; `source` and `recordedAt` are optional but
   recommended. For licensed third-party audio, put the exact license and origin in
   `license`/`source` (e.g. `"CC-BY 4.0"` + a URL).
4. Install and check:

   ```sh
   yarn learn:audio          # copies native clips into public/, synthesizes only the rest
   yarn learn:audio:verify   # per-lesson coverage + the first-run gate (exit 1 until it passes)
   ```

## The first-run gate (what W5 needs)

`yarn learn:audio:verify` fails until every clip of the guided first-run lessons is a
native recording — that is the machine-checkable half of the Phase 1 blocker (the other
half is the by-ear clean-install dry run). The gate set, derived from `lessons.json`:

| Lesson | Clips | Who hits it |
| --- | --- | --- |
| `a1-greetings` | 8 | bundled-only beginner participant |
| `a2-food` | 8 | A2 ICP participants |
| `b1-opinions` | 8 | B1 ICP participants |
| `b1-everyday-demo` (`/demo/audio/*`) | 12 | Discover demo import |

Record in priority order `a2-food` → `b1-opinions` → `/demo/audio` → `a1-greetings`
(ICP first). Lessons outside the gate may stay synthetic for now; the verify report shows
their coverage too.
