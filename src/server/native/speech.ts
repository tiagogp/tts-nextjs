import "server-only";

import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { decodeAudio, resample, wav } from "./audio";
import { ensureKokoroModel, ensureWhisperModel } from "./models";

export interface SpeechSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Transcription {
  text: string;
  segments: SpeechSegment[];
}

const VOICE_IDS: Record<string, number> = {
  af_bella: 2,
  af_heart: 3,
  af_nicole: 6,
  af_sarah: 9,
  am_adam: 11,
  am_michael: 16,
  bf_emma: 21,
  bm_george: 26,
};

const require = createRequire(import.meta.url);
type WhisperFn = (options: Record<string, unknown>, callback: (error: Error | null, value: unknown) => void) => void;
let whisperCall: ((options: Record<string, unknown>) => Promise<unknown>) | null = null;
interface GeneratedAudio { samples: Float32Array; sampleRate: number }
interface OfflineTtsLike {
  generateAsync(options: Record<string, unknown>): Promise<GeneratedAudio>;
}
interface SherpaModule {
  OfflineTts: { createAsync(options: Record<string, unknown>): Promise<OfflineTtsLike> };
  GenerationConfig: new (options: Record<string, unknown>) => object;
}
let ttsPromise: Promise<OfflineTtsLike> | null = null;
let ttsQueue: Promise<unknown> = Promise.resolve();

function whisper(): (options: Record<string, unknown>) => Promise<unknown> {
  if (whisperCall) return whisperCall;
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("Native transcription requires Apple Silicon");
  }
  // Locate the addon and dlopen it directly. Three traps:
  //   1. Don't use `require.resolve` (the bundler-bound `require`): turbopack
  //      rewrites it to a numeric module id, so path.dirname() later throws
  //      "path argument must be of type string. Received type number".
  //   2. Don't use the package's own `transcribe` export: its loader looks for
  //      the addon under `darwin-arm64/`, but the package ships it as
  //      `mac-arm64/`, so that path doesn't exist.
  //   3. Don't `require.resolve` the package entry either: Next's standalone
  //      build only traces `dist/mac-arm64/**` (the glob in next.config.ts), so
  //      the package's package.json and JS entry are absent from the packaged
  //      app — resolve() then throws "Cannot find module" and transcription dies
  //      with a generic error. The addon path is fixed, so build it directly off
  //      the runtime node_modules instead.
  const addonPath = path.join(
    process.cwd(),
    "node_modules",
    "@kutalia",
    "whisper-node-addon",
    "dist",
    `mac-${process.arch}`,
    "whisper.node",
  );
  const nativeModule = { exports: {} as unknown };
  process.dlopen(nativeModule as NodeModule, addonPath);
  whisperCall = promisify((nativeModule.exports as { whisper: WhisperFn }).whisper);
  return whisperCall;
}

function timestampMs(value: unknown): number {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!match) return 0;
  return (((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000) + Number(match[4]);
}

function normalizeWhisper(value: unknown): Transcription {
  const raw = (value && typeof value === "object" && "transcription" in value)
    ? (value as { transcription: unknown }).transcription
    : [];
  const segments: SpeechSegment[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (Array.isArray(item)) {
        const text = String(item.at(-1) ?? "").trim();
        if (!text) continue;
        segments.push({ text, startMs: timestampMs(item[0]), endMs: timestampMs(item[1]) });
      } else {
        const text = String(item ?? "").trim();
        if (text) segments.push({ text, startMs: 0, endMs: 0 });
      }
    }
  }
  return { text: segments.map((segment) => segment.text).join(" ").trim(), segments };
}

export async function transcribe(options: {
  audio: Buffer | Uint8Array;
  language?: string | null;
}): Promise<Transcription> {
  const [model, decoded] = await Promise.all([
    ensureWhisperModel(),
    decodeAudio(options.audio),
  ]);
  const result = await whisper()({
    pcmf32: resample(decoded, 16_000),
    model,
    language: options.language || "auto",
    translate: false,
    use_gpu: true,
    no_prints: true,
    no_timestamps: false,
    n_threads: Math.max(2, Math.min(8, os.cpus().length - 2)),
  });
  return normalizeWhisper(result);
}

async function getTts(): Promise<OfflineTtsLike> {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    const root = await ensureKokoroModel();
    const sherpa = require("sherpa-onnx-node") as SherpaModule;
    const lexicons = ["lexicon-us-en.txt", "lexicon-zh.txt"]
      .map((name) => path.join(/* turbopackIgnore: true */ root, name));
    return sherpa.OfflineTts.createAsync({
      model: {
        kokoro: {
          model: path.join(/* turbopackIgnore: true */ root, "model.onnx"),
          voices: path.join(/* turbopackIgnore: true */ root, "voices.bin"),
          tokens: path.join(/* turbopackIgnore: true */ root, "tokens.txt"),
          dataDir: path.join(/* turbopackIgnore: true */ root, "espeak-ng-data"),
          lexicon: lexicons.join(","),
        },
        debug: false,
        numThreads: Math.max(2, Math.min(6, os.cpus().length - 2)),
        provider: "cpu",
      },
      maxNumSentences: 2,
    });
  })().catch((error) => {
    ttsPromise = null;
    throw error;
  });
  return ttsPromise;
}

export async function synthesize(options: {
  text: string;
  voice: string;
  speed: number;
}): Promise<Buffer> {
  const task = ttsQueue.then(async () => {
    const [tts, sherpa] = await Promise.all([
      getTts(),
      Promise.resolve(require("sherpa-onnx-node") as SherpaModule),
    ]);
    const audio = await tts.generateAsync({
      text: options.text,
      // Electron's Node runtime forbids external buffers (memory backed by the
      // native addon). Keep this false so sherpa copies samples into a regular
      // JS buffer; true crashes the packaged app with "External buffers are not
      // allowed".
      enableExternalBuffer: false,
      generationConfig: new sherpa.GenerationConfig({
        sid: VOICE_IDS[options.voice] ?? VOICE_IDS.af_heart,
        speed: options.speed,
        silenceScale: 0.2,
      }),
    });
    return wav(audio.samples, audio.sampleRate);
  });
  ttsQueue = task.catch(() => undefined);
  return task;
}
