#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import unbzip2 from "unbzip2-stream";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lessonsFile = path.join(rootDir, "src", "features", "learn", "lessons.json");

const DEFAULT_SPEED = 1.15;
const DEFAULT_VOICE = "af_heart";
const KOKORO_SPEC = {
  id: "kokoro-1.0",
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2",
  sha256: "c133d26353d776da730870dac7da07dbfc9a5e3bc80cc5e8e83ab6e823be7046",
  size: 349_418_188,
  filename: "kokoro-multi-lang-v1_0.tar.bz2",
};

const VOICE_IDS = {
  af_bella: 2,
  af_heart: 3,
  af_nicole: 6,
  af_sarah: 9,
  am_adam: 11,
  am_michael: 16,
  bf_emma: 21,
  bm_george: 26,
};

function usage() {
  console.log(`Usage: node scripts/generate-learn-audio.mjs [--force] [--dry-run]

Generates lesson/demo .wav files declared in src/features/learn/lessons.json.

Environment:
  LEARN_AUDIO_VOICE   Kokoro voice id, default ${DEFAULT_VOICE}
  LEARN_AUDIO_SPEED   Kokoro speed, default ${DEFAULT_SPEED}
  SKIP_LEARN_AUDIO    Set to 1 to skip generation
`);
}

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  usage();
  process.exit(0);
}
const force = args.has("--force");
const dryRun = args.has("--dry-run");

function dataDir() {
  if (process.env.PHRASELOOP_DATA_DIR) return process.env.PHRASELOOP_DATA_DIR;

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "PhraseLoop");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "PhraseLoop");
  }

  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgData, "PhraseLoop");
}

function modelsDir() {
  return path.join(dataDir(), "models", "native");
}

function modelDirs() {
  const dirs = [modelsDir()];
  if (process.env.PHRASELOOP_BUNDLED_MODELS_DIR) dirs.push(process.env.PHRASELOOP_BUNDLED_MODELS_DIR);
  return [...new Set(dirs)];
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function findFile(root, filename) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && entry.name === filename) return full;
    if (entry.isDirectory()) {
      const found = await findFile(full, filename);
      if (found) return found;
    }
  }
  return null;
}

async function resolveInstalledKokoro() {
  for (const root of modelDirs()) {
    const finalDir = path.join(root, KOKORO_SPEC.id);
    if (!(await exists(path.join(finalDir, ".ready.json")))) continue;
    const model = await findFile(finalDir, "model.onnx");
    if (model) return path.dirname(model);
  }
  return null;
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function downloadKokoroArchive(target) {
  const response = await fetch(KOKORO_SPEC.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Kokoro download failed (${response.status})`);
  }

  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      const percent = Math.floor((received / KOKORO_SPEC.size) * 100);
      if (percent % 10 === 0) process.stdout.write(`\rDownloading Kokoro model... ${percent}%`);
      callback(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(target));
  process.stdout.write("\n");
  if ((await sha256(target)) !== KOKORO_SPEC.sha256) {
    throw new Error("Checksum mismatch for Kokoro model");
  }
}

async function ensureKokoroModel() {
  const installed = await resolveInstalledKokoro();
  if (installed) return installed;

  const root = modelsDir();
  const finalDir = path.join(root, KOKORO_SPEC.id);
  const tempDir = `${finalDir}.partial`;
  const archive = path.join(root, `${KOKORO_SPEC.filename}.partial`);

  await mkdir(root, { recursive: true });
  await rm(tempDir, { recursive: true, force: true });
  await rm(archive, { force: true });
  await mkdir(tempDir, { recursive: true });

  try {
    console.log("Kokoro model is missing; downloading it once for local build audio generation.");
    await downloadKokoroArchive(archive);
    await pipeline(createReadStream(archive), unbzip2(), tar.x({ cwd: tempDir }));
    for (const required of ["model.onnx", "voices.bin", "tokens.txt"]) {
      if (!(await findFile(tempDir, required))) throw new Error(`Kokoro archive is missing ${required}`);
    }
    await writeFile(path.join(tempDir, ".ready.json"), JSON.stringify({
      id: KOKORO_SPEC.id,
      sha256: KOKORO_SPEC.sha256,
      installedAt: new Date().toISOString(),
    }));
    await rm(finalDir, { recursive: true, force: true });
    await rename(tempDir, finalDir);
    await rm(archive, { force: true });

    const model = await findFile(finalDir, "model.onnx");
    if (!model) throw new Error("Kokoro model was not installed");
    return path.dirname(model);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    await rm(archive, { force: true });
    throw error;
  }
}

function wav(samples, sampleRate) {
  const out = Buffer.allocUnsafe(44 + samples.length * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    out.writeInt16LE(Math.round(value < 0 ? value * 32768 : value * 32767), 44 + i * 2);
  }
  return out;
}

function lessonAudioItems(lessons) {
  const items = [];
  const seen = new Set();
  const publicDir = path.join(rootDir, "public");
  for (const lesson of Array.isArray(lessons) ? lessons : []) {
    for (const phrase of Array.isArray(lesson?.phrases) ? lesson.phrases : []) {
      if (typeof phrase?.en !== "string" || typeof phrase?.clip !== "string") continue;
      if (!phrase.clip.startsWith("/") || !phrase.clip.endsWith(".wav")) continue;
      const target = path.resolve(publicDir, phrase.clip.slice(1));
      if (!target.startsWith(`${publicDir}${path.sep}`)) {
        throw new Error(`Invalid lesson audio path: ${phrase.clip}`);
      }
      if (seen.has(target)) continue;
      seen.add(target);
      items.push({ text: phrase.en.trim(), target });
    }
  }
  return items.filter((item) => item.text);
}

async function createTts(root) {
  const sherpa = require("sherpa-onnx-node");
  const lexicons = ["lexicon-us-en.txt", "lexicon-zh.txt"].map((name) => path.join(root, name));
  const tts = await sherpa.OfflineTts.createAsync({
    model: {
      kokoro: {
        model: path.join(root, "model.onnx"),
        voices: path.join(root, "voices.bin"),
        tokens: path.join(root, "tokens.txt"),
        dataDir: path.join(root, "espeak-ng-data"),
        lexicon: lexicons.join(","),
      },
      debug: false,
      numThreads: Math.max(2, Math.min(6, os.cpus().length - 2)),
      provider: "cpu",
    },
    maxNumSentences: 2,
  });

  const voice = process.env.LEARN_AUDIO_VOICE || DEFAULT_VOICE;
  const rawSpeed = Number(process.env.LEARN_AUDIO_SPEED ?? DEFAULT_SPEED);
  const speed = Number.isFinite(rawSpeed) ? Math.min(2, Math.max(0.5, rawSpeed)) : DEFAULT_SPEED;

  return async (text) => {
    const audio = await tts.generateAsync({
      text,
      enableExternalBuffer: false,
      generationConfig: new sherpa.GenerationConfig({
        sid: VOICE_IDS[voice] ?? VOICE_IDS[DEFAULT_VOICE],
        speed,
        silenceScale: 0.2,
      }),
    });
    return wav(audio.samples, audio.sampleRate);
  };
}

async function main() {
  if (process.env.SKIP_LEARN_AUDIO === "1") {
    console.log("Skipping learn audio generation because SKIP_LEARN_AUDIO=1.");
    return;
  }

  const lessons = JSON.parse(await readFile(lessonsFile, "utf8"));
  const items = lessonAudioItems(lessons);
  const missing = [];

  for (const item of items) {
    if (force || !(await exists(item.target))) missing.push(item);
  }

  if (dryRun) {
    console.log(`${items.length} lesson audio files declared; ${missing.length} would be generated.`);
    return;
  }

  if (missing.length === 0) {
    console.log(`${items.length} lesson audio files are already present.`);
    return;
  }

  console.log(`Generating ${missing.length}/${items.length} lesson audio files...`);
  const kokoroRoot = await ensureKokoroModel();
  const synthesize = await createTts(kokoroRoot);

  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    await mkdir(path.dirname(item.target), { recursive: true });
    const buffer = await synthesize(item.text);
    const temp = `${item.target}.partial`;
    await writeFile(temp, buffer);
    await rename(temp, item.target);
    console.log(`[${i + 1}/${missing.length}] ${path.relative(rootDir, item.target)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
