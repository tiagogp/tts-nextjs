#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import unbzip2 from "unbzip2-stream";

const require = createRequire(import.meta.url);
const currentPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentPath), "..");
const lessonsFile = path.join(rootDir, "src", "features", "learn", "lessons.json");
const defaultPublicDir = path.join(rootDir, "public");
const defaultNativeDir = path.join(rootDir, "native-audio");

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

const NATIVE_LIBRARY_IGNORED = new Set(["manifest.json", "README.md", ".DS_Store", ".gitkeep"]);

function usage() {
  console.log(`Usage: node scripts/generate-learn-audio.mjs [--force] [--dry-run] [--verify]

Ensures the lesson/demo .wav files declared in src/features/learn/lessons.json:
  1. installs real native-speaker recordings from native-audio/ (see its README),
  2. synthesizes only the remaining clips with Kokoro.
Native recordings are never overwritten by synthesis, --force included.

Modes:
  --verify   Report native/synthetic coverage per lesson and fail (exit 1) only
             when a declared clip is missing. Read-only; downloads nothing.
  --dry-run  Report what would be installed/generated, then exit.
  --force    Regenerate synthetic clips even if present (native clips are kept).

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
const verify = args.has("--verify");

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

function isDeclarableClip(phrase) {
  if (typeof phrase?.en !== "string" || typeof phrase?.clip !== "string") return false;
  return phrase.clip.startsWith("/") && phrase.clip.endsWith(".wav");
}

/**
 * Every spoken line a lesson declares. Roadmap lessons add a dialogue on top of
 * their phrases, and the content validator requires those clips to exist too, so
 * synthesis has to see both lists.
 */
function lessonSpokenLines(lesson) {
  return [
    ...(Array.isArray(lesson?.phrases) ? lesson.phrases : []),
    ...(Array.isArray(lesson?.dialogue) ? lesson.dialogue : []),
  ];
}

export function lessonAudioItems(lessons, publicDir = defaultPublicDir) {
  const items = [];
  const byClip = new Map();
  for (const lesson of Array.isArray(lessons) ? lessons : []) {
    for (const line of lessonSpokenLines(lesson)) {
      if (!isDeclarableClip(line)) continue;
      const text = line.en.trim();
      if (!text) continue;
      const existing = byClip.get(line.clip);
      if (existing) {
        if (!existing.lessonIds.includes(lesson.id)) existing.lessonIds.push(lesson.id);
        continue;
      }
      const target = path.resolve(publicDir, line.clip.slice(1));
      if (!target.startsWith(`${publicDir}${path.sep}`)) {
        throw new Error(`Invalid lesson audio path: ${line.clip}`);
      }
      const item = { text, clip: line.clip, target, lessonIds: [lesson.id] };
      byClip.set(line.clip, item);
      items.push(item);
    }
  }
  return items;
}

export function lessonClipMap(lessons) {
  const map = new Map();
  for (const lesson of Array.isArray(lessons) ? lessons : []) {
    const clips = [];
    for (const line of lessonSpokenLines(lesson)) {
      if (isDeclarableClip(line) && line.en.trim() && !clips.includes(line.clip)) {
        clips.push(line.clip);
      }
    }
    if (clips.length > 0) map.set(lesson.id, clips);
  }
  return map;
}

export async function isRiffWave(file) {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    return bytesRead === 12 && header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WAVE";
  } finally {
    await handle.close();
  }
}

export async function collectNativeRecordings(nativeDir = defaultNativeDir) {
  const recordings = new Map();
  const strayFiles = [];
  if (!(await exists(nativeDir))) return { recordings, strayFiles };

  async function walk(dir, rel) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, entryRel);
        continue;
      }
      if (!rel && NATIVE_LIBRARY_IGNORED.has(entry.name)) continue;
      if (entry.name === ".DS_Store" || entry.name === ".gitkeep") continue;
      if (entry.name.endsWith(".wav")) {
        recordings.set(`/${entryRel}`, full);
      } else {
        strayFiles.push(entryRel);
      }
    }
  }

  await walk(nativeDir, "");
  return { recordings, strayFiles };
}

export async function readNativeManifest(nativeDir = defaultNativeDir) {
  const file = path.join(nativeDir, "manifest.json");
  if (!(await exists(file))) return { entries: [], errors: [] };
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    return { entries: [], errors: [`native-audio/manifest.json is not valid JSON: ${error.message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], errors: ["native-audio/manifest.json must be a JSON array of clip entries."] };
  }
  return { entries: parsed, errors: [] };
}

export function validateNativeLibrary({ recordings, strayFiles, manifestEntries, declaredClips }) {
  const errors = [];

  for (const stray of strayFiles) {
    errors.push(
      `native-audio/${stray} is not a .wav file. Convert recordings to 16-bit PCM WAV before adding them.`,
    );
  }

  const manifestByClip = new Map();
  for (const entry of manifestEntries) {
    const clip = typeof entry?.clip === "string" ? entry.clip : null;
    if (!clip || !clip.startsWith("/") || !clip.endsWith(".wav")) {
      errors.push(`manifest entry ${JSON.stringify(entry?.clip ?? entry)} needs a "clip" like "/learn/audio/<lesson>/01.wav".`);
      continue;
    }
    if (manifestByClip.has(clip)) {
      errors.push(`manifest lists ${clip} more than once.`);
      continue;
    }
    manifestByClip.set(clip, entry);
    if (typeof entry.speaker !== "string" || !entry.speaker.trim()) {
      errors.push(`manifest entry for ${clip} is missing "speaker".`);
    }
    if (typeof entry.license !== "string" || !entry.license.trim()) {
      errors.push(`manifest entry for ${clip} is missing "license" (e.g. "own recording", "CC-BY 4.0 <source>").`);
    }
    if (!declaredClips.has(clip)) {
      errors.push(`manifest entry for ${clip} does not match any clip declared in lessons.json.`);
    }
    if (!recordings.has(clip)) {
      errors.push(`manifest entry for ${clip} has no recording at native-audio${clip}.`);
    }
  }

  for (const clip of recordings.keys()) {
    if (!declaredClips.has(clip)) {
      errors.push(`native-audio${clip} does not match any clip declared in lessons.json (typo in the path?).`);
    }
    if (!manifestByClip.has(clip)) {
      errors.push(`native-audio${clip} has no manifest entry (speaker + license are required).`);
    }
  }

  return errors;
}

export function synthesisTargets(items, nativeClips, presentClips, regenerate) {
  return items.filter((item) => {
    if (nativeClips.has(item.clip)) return false;
    return regenerate || !presentClips.has(item.clip);
  });
}

export function buildCoverage(lessons, installedClips, presentClips) {
  const rows = [];
  const missingClips = [];
  for (const [lessonId, clips] of lessonClipMap(lessons)) {
    const native = clips.filter((clip) => installedClips.has(clip)).length;
    const missing = clips.filter((clip) => !presentClips.has(clip)).length;
    const synthetic = clips.length - native - missing;
    rows.push({ lessonId, total: clips.length, native, synthetic, missing });
    for (const clip of clips) {
      if (!presentClips.has(clip)) missingClips.push(clip);
    }
  }
  return { rows, missingClips };
}

export async function nativeInstallState(recordings, itemsByClip) {
  const installed = new Set();
  const pending = [];
  for (const [clip, source] of recordings) {
    const item = itemsByClip.get(clip);
    if (!item) continue;
    if (!(await exists(item.target))) {
      pending.push({ clip, reason: "missing" });
    } else if ((await sha256(item.target)) !== (await sha256(source))) {
      pending.push({ clip, reason: "stale" });
    } else {
      installed.add(clip);
    }
  }
  return { installed, pending };
}

export async function installNativeRecordings(recordings, itemsByClip) {
  const { installed, pending } = await nativeInstallState(recordings, itemsByClip);
  for (const { clip } of pending) {
    const target = itemsByClip.get(clip).target;
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.partial`;
    await copyFile(recordings.get(clip), temp);
    await rename(temp, target);
    installed.add(clip);
  }
  return { installed, copied: pending.map((entry) => entry.clip) };
}

async function loadNativeLibrary(items) {
  const declaredClips = new Set(items.map((item) => item.clip));
  const [{ recordings, strayFiles }, manifest] = await Promise.all([
    collectNativeRecordings(),
    readNativeManifest(),
  ]);
  const errors = [
    ...manifest.errors,
    ...validateNativeLibrary({ recordings, strayFiles, manifestEntries: manifest.entries, declaredClips }),
  ];
  for (const [clip, file] of recordings) {
    if (!(await isRiffWave(file))) {
      errors.push(`native-audio${clip} is not a valid RIFF/WAVE file. Re-export it as 16-bit PCM WAV.`);
    }
  }
  return { recordings, errors };
}

function printCoverage(coverage, pendingInstall) {
  console.log("Lesson audio coverage:");
  const width = Math.max(...[...coverage.rows.map((row) => row.lessonId.length), 6]);
  for (const row of coverage.rows) {
    console.log(
      `  ${row.lessonId.padEnd(width)}  native ${row.native}/${row.total}` +
        `${row.synthetic ? `  synthetic ${row.synthetic}` : ""}${row.missing ? `  missing ${row.missing}` : ""}`,
    );
  }
  if (pendingInstall.length > 0) {
    console.log(
      `\n${pendingInstall.length} native recording(s) not installed yet — run "yarn learn:audio" to install:`,
    );
    for (const entry of pendingInstall) console.log(`  ${entry.clip} (${entry.reason})`);
  }
}

async function main() {
  if (process.env.SKIP_LEARN_AUDIO === "1") {
    console.log("Skipping learn audio generation because SKIP_LEARN_AUDIO=1.");
    return;
  }

  const lessons = JSON.parse(await readFile(lessonsFile, "utf8"));
  const items = lessonAudioItems(lessons);
  const itemsByClip = new Map(items.map((item) => [item.clip, item]));

  const { recordings, errors } = await loadNativeLibrary(items);
  if (errors.length > 0) {
    console.error("The native-audio library has problems (see native-audio/README.md):");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  if (verify) {
    const { installed, pending } = await nativeInstallState(recordings, itemsByClip);
    const presentClips = new Set();
    for (const item of items) {
      if (await exists(item.target)) presentClips.add(item.clip);
    }
    const coverage = buildCoverage(lessons, installed, presentClips);
    printCoverage(coverage, pending);
    if (coverage.missingClips.length === 0) {
      console.log("\nAudio verification: PASS — every declared lesson clip is present.");
      return;
    }
    console.log(
      `\nAudio verification: FAIL — ${coverage.missingClips.length} declared clip(s) are missing:`,
    );
    for (const clip of coverage.missingClips) console.log(`  ${clip}`);
    process.exit(1);
  }

  if (dryRun) {
    const { pending } = await nativeInstallState(recordings, itemsByClip);
    const presentClips = new Set();
    for (const item of items) {
      if (await exists(item.target)) presentClips.add(item.clip);
    }
    const missing = synthesisTargets(items, new Set(recordings.keys()), presentClips, force);
    console.log(
      `${items.length} lesson audio files declared; ${pending.length} native recording(s) would be installed; ` +
        `${missing.length} would be synthesized.`,
    );
    return;
  }

  const { copied } = await installNativeRecordings(recordings, itemsByClip);
  if (copied.length > 0) {
    console.log(`Installed ${copied.length} native recording(s) from native-audio/.`);
  }

  const presentClips = new Set();
  for (const item of items) {
    if (await exists(item.target)) presentClips.add(item.clip);
  }
  const missing = synthesisTargets(items, new Set(recordings.keys()), presentClips, force);

  if (missing.length === 0) {
    console.log(`${items.length} lesson audio files are ready (${recordings.size} native).`);
    return;
  }

  console.log(`Generating ${missing.length}/${items.length} lesson audio files (native clips are kept as-is)...`);
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

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (executedPath === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
