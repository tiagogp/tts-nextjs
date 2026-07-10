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

const NON_SPEECH_MARKER = String.raw`(?:blank[_\s-]*audio|no[_\s-]*(?:audio|speech)|silence)`;
const BRACKETED_NON_SPEECH_RE = new RegExp(String.raw`[\[(]\s*${NON_SPEECH_MARKER}\s*[\])]`, "giu");
const PLAIN_NON_SPEECH_RE = new RegExp(String.raw`^\s*${NON_SPEECH_MARKER}\s*$`, "iu");

export function transcriptText(value: unknown): string {
  const text = String(value ?? "")
    .replace(BRACKETED_NON_SPEECH_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return PLAIN_NON_SPEECH_RE.test(text) ? "" : text;
}

function whisperAddonDir(platform = process.platform, arch = process.arch): string {
  if (platform === "darwin" && (arch === "arm64" || arch === "x64")) return `mac-${arch}`;
  if (platform === "linux" && arch === "x64") return "linux-x64";
  if (platform === "win32" && arch === "x64") return "win32-x64";
  throw new Error(`Native transcription is not bundled for ${platform} ${arch}`);
}

function whisper(): (options: Record<string, unknown>) => Promise<unknown> {
  if (whisperCall) return whisperCall;
  // Locate the addon and dlopen it directly. Three traps:
  //   1. Don't use `require.resolve` (the bundler-bound `require`): turbopack
  //      rewrites it to a numeric module id, so path.dirname() later throws
  //      "path argument must be of type string. Received type number".
  //   2. Don't use the package's own `transcribe` export: older builds used a
  //      darwin/mac folder mismatch, and direct dlopen lets us keep one stable
  //      path resolver for standalone Next.
  //   3. Don't `require.resolve` the package entry either: Next's standalone
  //      build only traces the platform dist folders (the globs in next.config.ts), so
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
    whisperAddonDir(),
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

function normalizeKey(text: string): string {
  return text.replace(/\W+/gu, " ").trim().toLowerCase();
}

// Whisper's sliding-window decoder produces two artifacts:
//   1. Same-startMs pairs where the shorter text is a substring of the longer one.
//   2. Consecutive segments where the start of segment[i+1] duplicates the tail of segment[i].
// This pass collapses both.
function collapseWhisperOverlaps(segments: SpeechSegment[]): SpeechSegment[] {
  // Step 1: for segments sharing the same startMs, keep only the longest.
  const deduped: SpeechSegment[] = [];
  for (const seg of segments) {
    const last = deduped.at(-1);
    if (last && last.startMs === seg.startMs) {
      if (seg.text.length > last.text.length) deduped[deduped.length - 1] = seg;
    } else {
      deduped.push(seg);
    }
  }

  // Step 2: drop any segment whose normalised text is fully contained in the previous one.
  const result: SpeechSegment[] = [];
  for (const seg of deduped) {
    const prev = result.at(-1);
    if (prev && normalizeKey(prev.text).includes(normalizeKey(seg.text))) continue;
    result.push(seg);
  }
  return result;
}

function normalizeWhisper(value: unknown): Transcription {
  const raw = (value && typeof value === "object" && "transcription" in value)
    ? (value as { transcription: unknown }).transcription
    : [];
  const segments: SpeechSegment[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (Array.isArray(item)) {
        const text = transcriptText(item.at(-1));
        if (!text) continue;
        segments.push({ text, startMs: timestampMs(item[0]), endMs: timestampMs(item[1]) });
      } else {
        const text = transcriptText(item);
        if (text) segments.push({ text, startMs: 0, endMs: 0 });
      }
    }
  }
  const collapsed = collapseWhisperOverlaps(segments);
  return { text: collapsed.map((segment) => segment.text).join(" ").trim(), segments: collapsed };
}

export async function transcribe(options: {
  audio: Buffer | Uint8Array;
  language?: string | null;
  onProgress?: (percent: number) => void;
}): Promise<Transcription> {
  const [model, decoded] = await Promise.all([
    ensureWhisperModel(),
    decodeAudio(options.audio),
  ]);

  let timer: ReturnType<typeof setInterval> | null = null;
  if (options.onProgress) {
    const audioDurationMs = (decoded.samples.length / decoded.sampleRate) * 1000;
    // Conservative estimate: GPU ~8x realtime, CPU ~1.5x realtime
    const speedFactor = process.platform !== "linux" ? 8 : 1.5;
    const estimatedMs = Math.max(3000, audioDurationMs / speedFactor);
    const startedAt = Date.now();
    options.onProgress(0);
    timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(95, Math.round((elapsed / estimatedMs) * 95));
      options.onProgress!(pct);
    }, 400);
  }

  try {
    const result = await whisper()({
      pcmf32: resample(decoded, 16_000),
      model,
      language: options.language || "auto",
      translate: false,
      use_gpu: process.platform !== "linux",
      no_prints: true,
      no_timestamps: false,
      n_threads: Math.max(2, Math.min(8, os.cpus().length - 2)),
    });
    return normalizeWhisper(result);
  } finally {
    if (timer) clearInterval(timer);
    options.onProgress?.(100);
  }
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
