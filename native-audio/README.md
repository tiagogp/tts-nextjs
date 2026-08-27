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

## Cold-listening probes

A second, smaller bank lives beside the lesson clips and is governed by different rules,
because it does a different job: it **measures** comprehension of unfamiliar speech instead
of teaching a phrase. Its bank is declared in
[src/features/listening/coldProbes.json](../src/features/listening/coldProbes.json) and it
ships **empty** — with no clip, the app offers no probe and `coldListening()` keeps
returning `null` with `unmeasuredReason: "no_unfamiliar_audio"`. That is the honest state,
not a broken one.

A probe must be authentic. Synthetic audio cannot measure unfamiliar speech: every learner
has already heard the Kokoro voices in every lesson.

1. Save the recording under `native-audio/learn/probes/<id>.wav`, 16-bit PCM WAV, **10–25
   seconds** — long enough to carry a main idea, short enough to hold on one listen.
2. Add the usual provenance entry to [manifest.json](manifest.json). Probes are validated
   against the same licensing rules as lesson audio; the clip must **not** appear in
   `lessons.json`, because a probe the learner studies is no longer cold.
3. Add the probe to `coldProbes.json`:

   ```json
   {
     "id": "market-queue",
     "clip": "/learn/probes/market-queue.wav",
     "accent": "Irish",
     "speakerId": "probe-market",
     "durationSec": 18,
     "topic": "queueing at a market stall",
     "questions": [
       { "kind": "mainIdea", "prompt": "What is the speaker doing?", "options": ["Explaining a delay", "Ordering food", "Asking for directions"], "answer": "Explaining a delay" },
       { "kind": "detail", "prompt": "How long is the wait?", "options": ["Ten minutes", "An hour", "All afternoon"], "answer": "An hour" }
     ]
   }
   ```

   Exactly one `mainIdea` question, at least three distinct options each, and the answer
   must be one of them. `yarn learn:content:validate` enforces all of it.

Aim for **15–25 clips across at least three accents**: at one probe a fortnight — the pace
the app offers them at — twenty clips is a year of cold-listening measurement. Fewer is
warned about, never blocked; a thin bank still measures something real.

The probe is played once, at full speed, with no transcript and no replay, and the
component enforces that rather than trusting the learner to observe it. Anything gentler
would disqualify the attempt from the metric it exists to feed.
