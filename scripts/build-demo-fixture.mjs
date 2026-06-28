// Offline prep for bundled learning content. Runs on a dev machine (never in
// the shipped app): it pre-generates Kokoro audio clips for the curated demo and
// graded lessons so the in-app beginner path is truly zero-setup.
//
// Audio is generated through the running app's TTS route, which already owns the
// Kokoro model loading. This avoids importing the `server-only` speech module.
//
// Usage:
//   1. Start the app/dev server (so /api/tts is reachable, Kokoro model present).
//   2. node scripts/build-demo-fixture.mjs [baseUrl]
//      baseUrl defaults to http://localhost:3000

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PHRASES_JSON = path.join(root, "src/features/discover/demo/demoPhrases.json");
const LESSONS_JSON = path.join(root, "src/features/learn/lessons.json");
const OUT_DIR = path.join(root, "public/demo/audio");

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const VOICE = "af_heart";
const SPEED = 1.0;

async function synth(text) {
  const res = await fetch(`${baseUrl}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: VOICE, speed: SPEED }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS ${res.status} for "${text}": ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const phrases = JSON.parse(await readFile(PHRASES_JSON, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  for (const phrase of phrases) {
    const filename = path.basename(phrase.clip); // e.g. 01.wav
    const wav = await synth(phrase.en);
    await writeFile(path.join(OUT_DIR, filename), wav);
    console.log(`✓ ${filename}  (${(wav.length / 1024).toFixed(0)} KB)  ${phrase.en}`);
  }

  const lessons = JSON.parse(await readFile(LESSONS_JSON, "utf8"));
  let lessonClipCount = 0;
  for (const lesson of lessons) {
    const lessonOutDir = path.join(root, "public/learn/audio", lesson.id);
    await mkdir(lessonOutDir, { recursive: true });
    for (const [index, phrase] of lesson.phrases.entries()) {
      if (!phrase.clip.startsWith(`/learn/audio/${lesson.id}/`)) continue;
      const filename = path.basename(phrase.clip) || `${String(index + 1).padStart(2, "0")}.wav`;
      const wav = await synth(phrase.en);
      await writeFile(path.join(lessonOutDir, filename), wav);
      lessonClipCount += 1;
      console.log(`✓ ${lesson.id}/${filename}  (${(wav.length / 1024).toFixed(0)} KB)  ${phrase.en}`);
    }
  }

  console.log(`\nDone — ${phrases.length} demo clips and ${lessonClipCount} lesson clips generated.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
