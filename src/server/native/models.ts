import "server-only";

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import unbzip2 from "unbzip2-stream";
import { modelsDir } from "./data";

type ModelId = "whisper-small" | "kokoro-1.0";

interface ModelSpec {
  id: ModelId;
  url: string;
  sha256: string;
  size: number;
  archive: boolean;
  filename: string;
}

const SPECS: Record<ModelId, ModelSpec> = {
  "whisper-small": {
    id: "whisper-small",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    size: 487_601_967,
    archive: false,
    filename: "ggml-small.bin",
  },
  "kokoro-1.0": {
    id: "kokoro-1.0",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2",
    sha256: "c133d26353d776da730870dac7da07dbfc9a5e3bc80cc5e8e83ab6e823be7046",
    size: 349_418_188,
    archive: true,
    filename: "kokoro-multi-lang-v1_0.tar.bz2",
  },
};

export interface ModelStatus {
  ready: boolean;
  kokoro_installed: boolean;
  whisper_installed: boolean;
  loading_model: boolean;
  downloading_model: boolean;
  loading_kokoro: boolean;
  downloading_kokoro: boolean;
  loading_whisper: boolean;
  downloading_whisper: boolean;
  download_progress?: number;
  error: string | null;
}

const active = new Map<ModelId, Promise<string>>();
const downloading = new Set<ModelId>();
let progress = 0;
let lastError: string | null = null;

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function download(spec: ModelSpec, target: string): Promise<void> {
  const response = await fetch(spec.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed (${response.status})`);
  }
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      progress = Math.min(1, received / spec.size);
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(target));
  if ((await sha256(target)) !== spec.sha256) {
    throw new Error(`Checksum mismatch for ${spec.id}`);
  }
}

async function findFile(root: string, filename: string): Promise<string | null> {
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

// Resolve the on-disk location of an already-installed model, or null when it
// is missing. A model counts as installed only when its `.ready.json` marker
// AND its payload (the bin file, or the extracted model.onnx) are both present —
// so a half-written or interrupted install never reads as ready.
async function resolveInstalled(spec: ModelSpec): Promise<string | null> {
  const finalDir = path.join(modelsDir(), spec.id);
  const marker = path.join(finalDir, ".ready.json");
  if (!(await exists(marker))) return null;
  if (!spec.archive) {
    const file = path.join(finalDir, spec.filename);
    return (await exists(file)) ? file : null;
  }
  const model = await findFile(finalDir, "model.onnx");
  return model ? path.dirname(model) : null;
}

async function ensure(spec: ModelSpec): Promise<string> {
  const root = modelsDir();
  await mkdir(root, { recursive: true });
  const installed = await resolveInstalled(spec);
  if (installed) return installed;

  const finalDir = path.join(root, spec.id);
  const marker = path.join(finalDir, ".ready.json");
  const tempDir = `${finalDir}.partial`;
  const archive = path.join(root, `${spec.filename}.partial`);
  await rm(tempDir, { recursive: true, force: true });
  await rm(archive, { force: true });
  await mkdir(tempDir, { recursive: true });
  downloading.add(spec.id);
  progress = 0;
  try {
    await download(spec, archive);
    if (spec.archive) {
      await pipeline(createReadStream(archive), unbzip2(), tar.x({ cwd: tempDir }));
      for (const required of ["model.onnx", "voices.bin", "tokens.txt"]) {
        if (!(await findFile(tempDir, required))) {
          throw new Error(`Kokoro archive is missing ${required}`);
        }
      }
    } else {
      await rename(archive, path.join(tempDir, spec.filename));
    }
    await writeFile(marker.replace(finalDir, tempDir), JSON.stringify({
      id: spec.id,
      sha256: spec.sha256,
      installedAt: new Date().toISOString(),
    }));
    await rm(finalDir, { recursive: true, force: true });
    await rename(tempDir, finalDir);
    await rm(archive, { force: true });
    lastError = null;
    if (!spec.archive) return path.join(finalDir, spec.filename);
    const model = await findFile(finalDir, "model.onnx");
    if (!model) throw new Error("Kokoro model was not installed");
    return path.dirname(model);
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Model installation failed";
    await rm(tempDir, { recursive: true, force: true });
    await rm(archive, { force: true });
    throw error;
  } finally {
    downloading.delete(spec.id);
  }
}

function ensureOnce(id: ModelId): Promise<string> {
  const current = active.get(id);
  if (current) return current;
  const promise = ensure(SPECS[id]).finally(() => active.delete(id));
  active.set(id, promise);
  return promise;
}

export const ensureWhisperModel = () => ensureOnce("whisper-small");
export const ensureKokoroModel = () => ensureOnce("kokoro-1.0");

export const kokoroInstalled = (): Promise<boolean> =>
  resolveInstalled(SPECS["kokoro-1.0"]).then((dir) => dir !== null);
export const whisperInstalled = (): Promise<boolean> =>
  resolveInstalled(SPECS["whisper-small"]).then((file) => file !== null);

export async function modelStatus(): Promise<ModelStatus> {
  const whisper = active.has("whisper-small");
  const kokoro = active.has("kokoro-1.0");
  const [kokoroReady, whisperReady] = await Promise.all([
    kokoroInstalled(),
    whisperInstalled(),
  ]);
  return {
    // `ready` reflects whether the TTS model needed for audio is on disk — the
    // gate every apkg export depends on — not just "the runtime is up".
    ready: kokoroReady,
    kokoro_installed: kokoroReady,
    whisper_installed: whisperReady,
    loading_model: whisper || kokoro,
    downloading_model: downloading.size > 0,
    loading_kokoro: kokoro,
    downloading_kokoro: downloading.has("kokoro-1.0"),
    loading_whisper: whisper,
    downloading_whisper: downloading.has("whisper-small"),
    download_progress: downloading.size ? progress : undefined,
    error: lastError,
  };
}
