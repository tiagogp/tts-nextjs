# native-audio — optional recorded replacements

This directory is the committed source of truth for licensed recorded clips when they are
available. Bundled Kokoro audio is an accepted default, not a release blocker.
`yarn learn:audio` installs everything here into `public/` (which is gitignored and
otherwise filled by Kokoro synthesis) and **never** synthesizes over a native recording —
`--force` included.

Recorded replacements are an optional content-quality upgrade. They still require provenance
and licensing, but the guided first-run loop does not require them.

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
     "recordingKind": "native",
     "speaker": "Jane D. (US English, native)",
     "speakerId": "jane-d",
     "accent": "US",
     "delivery": "natural",
     "speedWpm": 142,
     "provenance": "Own recording; speaker consent archived",
     "license": "own recording — released for PhraseLoop bundling",
     "recordedAt": "2026-07-10",
     "normalizationStatus": "peak normalized to -1 dBFS; silence trimmed"
   }
   ```

   `speaker`, `speakerId`, `accent`, `delivery`, `speedWpm`, `connectedSpeechFeatures`, `provenance`, `license`, `recordedAt`, and `normalizationStatus` are mandatory. Use an empty `connectedSpeechFeatures` array for carefully articulated material. The license
   must cover the speaker's consent or the applicable third-party terms. `source` is optional.
   For licensed third-party audio, put the exact license and origin in
   `license`/`source` (e.g. `"CC-BY 4.0"` + a URL).
4. Install and check:

   ```sh
   yarn learn:audio          # copies native clips into public/, synthesizes only the rest
   yarn learn:audio:verify   # verifies declared clips and metadata
   yarn learn:audio:ci       # CI gate: verifies every CEFR five-lesson batch has real-audio coverage
   ```

The CI coverage gate counts only licensed native recordings: synthetic Kokoro clips are an
honest fallback but cannot satisfy speaker, accent, natural-delivery, connected-speech, or
speed coverage targets. It also rejects dialogue roles that resolve to the same voice.
