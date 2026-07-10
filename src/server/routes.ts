import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCardsDeck, buildCsvDeck } from "./native/apkg";
import { createApkgDebugId } from "./native/apkgDebug";
import { decodeAudio, sliceDecodedAudio, type DecodedAudio } from "./native/audio";
import { dataDir } from "./native/data";
import { audioPathFor, discoverArticle, discoverPdf, discoverYouTube } from "./native/discovery";
import { ensureKokoroModel, ensureWhisperModel, kokoroInstalled, modelStatus, whisperInstalled } from "./native/models";
import { assessPronunciation } from "./native/pronunciation";
import { synthesize, transcribe } from "./native/speech";
import { logger } from "@/lib/logger";

export interface LocalResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  json<T>(): T;
}

export interface LocalRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
  timeoutMs?: number;
  signal?: AbortSignal;
  debugId?: string;
  onProgress?: (percent: number, stage: string) => void;
}

export type RouteHandler = (options: LocalRequestOptions) => Promise<LocalResponse>;

export function response(
  status: number,
  body: Buffer | string | object = Buffer.alloc(0),
  headers: Record<string, string> = {},
): LocalResponse {
  const data = Buffer.isBuffer(body)
    ? body
    : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  return {
    status,
    headers: { "content-length": String(data.byteLength), ...headers },
    body: data,
    json<T>() {
      return JSON.parse(data.toString("utf8") || "{}") as T;
    },
  };
}

export function parseJson(body?: Buffer | string): Record<string, unknown> {
  const value = JSON.parse(
    Buffer.isBuffer(body) ? body.toString("utf8") : body || "{}",
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("JSON object required");
  return value;
}

export function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

const MODEL_NOT_READY_MESSAGE =
  "O modelo de voz (Kokoro, ~349MB) ainda não está pronto. O download começou — acompanhe o progresso e refaça o export quando concluir.";

function kokoroNotReadyMessage(
  status: Awaited<ReturnType<typeof modelStatus>>,
): string {
  if (status.error && !status.loading_kokoro) {
    return `Falha ao baixar/preparar o modelo de voz neste sistema: ${status.error}. Tente baixar novamente; se persistir, verifique a conexão com GitHub e permissões da pasta de dados.`;
  }
  if (status.error) {
    return `O modelo de voz está sendo baixado novamente. Último erro: ${status.error}`;
  }
  return MODEL_NOT_READY_MESSAGE;
}

async function requireKokoro(): Promise<LocalResponse | null> {
  if (await kokoroInstalled()) return null;
  void ensureKokoroModel().catch(() => {});
  const status = await modelStatus();
  return response(409, {
    error: kokoroNotReadyMessage(status),
    code: "model_not_ready",
    downloading: status.downloading_kokoro || status.loading_kokoro,
    progress: status.download_progress ?? 0,
    modelError: status.error,
  });
}

const WHISPER_NOT_READY_MESSAGE =
  "O reconhecimento de voz (Whisper, ~488MB) ainda está sendo preparado. O download começou — tente de novo quando concluir.";

/**
 * Same contract as `requireKokoro`: never block a request on the one-time
 * Whisper download. Kick it off, tell the client it's in flight (409 +
 * progress) and let the UI show a download notice instead of a frozen spinner.
 */
async function requireWhisper(): Promise<LocalResponse | null> {
  if (await whisperInstalled()) return null;
  void ensureWhisperModel().catch(() => {});
  const status = await modelStatus();
  return response(409, {
    error:
      status.error && !status.loading_whisper && !status.downloading_whisper
        ? `Falha ao baixar o modelo de reconhecimento de voz: ${status.error}. Verifique a conexão e tente de novo.`
        : WHISPER_NOT_READY_MESSAGE,
    code: "model_not_ready",
    downloading: status.downloading_whisper || status.loading_whisper,
    progress: status.download_progress ?? 0,
    modelError: status.error,
  });
}

function synthesisFailure(error: unknown): LocalResponse {
  logger.error({ err: error }, "APKG build failed");
  return response(500, {
    error:
      "Falha ao sintetizar o áudio dos cards. Confira o log do servidor para o erro técnico.",
    code: "synthesis_failed",
  });
}

// ---------------------------------------------------------------------------
// Route handlers — each handles exactly one path (or path prefix)
// ---------------------------------------------------------------------------

const handleHealth: RouteHandler = async () =>
  response(200, { status: "ok", ready: true });

const handleStatus: RouteHandler = async () =>
  response(200, await modelStatus());

const handleKokoroEnsure: RouteHandler = async () => {
  void ensureKokoroModel().catch(() => {});
  return response(202, await modelStatus());
};

const handleWhisperEnsure: RouteHandler = async () => {
  void ensureWhisperModel().catch(() => {});
  return response(202, await modelStatus());
};

const handleVoiceUpload: RouteHandler = async (options) => {
  const method = options.method ?? "GET";
  const voiceFile = path.join(dataDir(), "voice-reference.wav");
  const voiceName = path.join(dataDir(), "voice-reference.name");
  await mkdir(dataDir(), { recursive: true });
  if (method === "DELETE") {
    await Promise.all([rm(voiceFile, { force: true }), rm(voiceName, { force: true })]);
    return response(200, { status: "ok" });
  }
  if (method === "POST") {
    const body = Buffer.isBuffer(options.body)
      ? options.body
      : Buffer.from(options.body || "");
    if (!body.length) return response(400, { detail: "empty audio" });
    const name = decodeURIComponent(
      options.headers?.["X-File-Name"] || "voice-reference.wav",
    );
    await Promise.all([writeFile(voiceFile, body), writeFile(voiceName, name)]);
    return response(200, { name });
  }
  try {
    return response(200, {
      name: (await readFile(voiceName, "utf8")).trim() || "voice-reference.wav",
    });
  } catch {
    return response(200, { name: null });
  }
};

const handleTts: RouteHandler = async (options) => {
  const notReady = await requireKokoro();
  if (notReady) return notReady;
  let value: Record<string, unknown>;
  try {
    value = parseJson(options.body);
  } catch {
    return response(400, { error: "Invalid TTS request.", code: "invalid_request" });
  }
  const text = String(value.text || "").trim();
  if (!text || text.length > 4096)
    return response(400, { error: "Invalid text.", code: "invalid_text" });
  try {
    const body = await synthesize({
      text,
      voice: String(value.voice || "af_heart"),
      speed: Number(value.speed) || 1.15,
    });
    return response(200, body, { "content-type": "audio/wav" });
  } catch (error) {
    if (isAbort(error)) throw error;
    logger.error({ err: error }, "TTS synthesis failed");
    return response(500, {
      error:
        "Falha ao gerar áudio com Kokoro neste sistema. Confira o log do servidor para o erro técnico.",
      code: "tts_failed",
      detail: error instanceof Error ? error.message : "unknown",
    });
  }
};

const handleTranscribe: RouteHandler = async (options) => {
  const notReady = await requireWhisper();
  if (notReady) return notReady;
  const body = Buffer.isBuffer(options.body)
    ? options.body
    : Buffer.from(options.body || "");
  try {
    const result = await transcribe({
      audio: body,
      language: options.headers?.["X-Language"] || null,
    });
    return response(200, { text: result.text });
  } catch (error) {
    logger.error({ err: error }, "Transcription failed");
    return response(500, {
      detail: "transcription failed",
      code: "transcription_failed",
    });
  }
};

const handlePronunciationAssess: RouteHandler = async (options) => {
  const notReady = await requireWhisper();
  if (notReady) return notReady;
  const body = Buffer.isBuffer(options.body)
    ? options.body
    : Buffer.from(options.body || "");
  const targetText = decodeURIComponent(options.headers?.["X-Target-Text"] || "").trim();
  if (!body.length) return response(400, { detail: "empty audio" });
  if (!targetText) return response(400, { detail: "empty target" });
  try {
    const referenceDurationMs = Number(options.headers?.["X-Reference-Duration-Ms"] || 0);
    return response(200, await assessPronunciation({
      audio: body,
      targetText,
      targetLang: options.headers?.["X-Target-Lang"] || "en",
      referenceDurationMs: Number.isFinite(referenceDurationMs) && referenceDurationMs > 0
        ? referenceDurationMs
        : undefined,
    }));
  } catch (error) {
    logger.error({ err: error }, "Pronunciation assessment failed");
    return response(500, {
      detail: "pronunciation assessment failed",
      code: "pronunciation_failed",
    });
  }
};

const handleDiscover: RouteHandler = async (options) => {
  const value = parseJson(options.body);
  return response(
    200,
    await discoverYouTube(
      String(value.url || ""),
      typeof value.lang === "string" ? value.lang : null,
      options.onProgress,
    ),
  );
};

const handleDiscoverArticle: RouteHandler = async (options) => {
  return response(
    200,
    await discoverArticle(String(parseJson(options.body).url || "")),
  );
};

const handleDiscoverPdf: RouteHandler = async (options) => {
  const body = Buffer.isBuffer(options.body)
    ? options.body
    : Buffer.from(options.body || "");
  const name = decodeURIComponent(options.headers?.["X-File-Name"] || "upload.pdf");
  return response(200, await discoverPdf(body, name));
};

const handleAnkiApkg: RouteHandler = async (options) => {
  const notReady = await requireKokoro();
  if (notReady) return notReady;
  const value = parseJson(options.body);
  const debugId =
    typeof value.debugId === "string" ? value.debugId : createApkgDebugId();
  try {
    const body = await buildCsvDeck({
      csv: Buffer.from(String(value.csvBase64 || ""), "base64"),
      deck: String(value.deck || "PhraseLoop"),
      ptCol: String(value.ptCol || "pt"),
      enCol: String(value.enCol || "en"),
      delimiter: String(value.delimiter || ",").slice(0, 1),
      noHeader: value.noHeader === true,
      voice: String(value.voice || "af_heart"),
      speed: Number(value.speed) || 1.15,
      signal: options.signal,
      debugId,
    });
    return response(200, body, {
      "content-type": "application/octet-stream",
      "x-phraseloop-apkg-debug-id": debugId,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return synthesisFailure(error);
  }
};

const handleCardsApkg: RouteHandler = async (options) => {
  const notReady = await requireKokoro();
  if (notReady) return notReady;
  const value = parseJson(options.body);
  const debugId =
    typeof value.debugId === "string" ? value.debugId : createApkgDebugId();
  try {
    const body = await buildCardsDeck({
      cards: Array.isArray(value.cards) ? value.cards : [],
      deck: String(value.deck || "PhraseLoop"),
      voice: String(value.voice || "af_heart"),
      speed: Number(value.speed) || 1.15,
      signal: options.signal,
      debugId,
    });
    return response(200, body, {
      "content-type": "application/octet-stream",
      "x-phraseloop-apkg-debug-id": debugId,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return synthesisFailure(error);
  }
};

// ---------------------------------------------------------------------------
// Registry — exact-path POST routes (prefix routes are handled in dispatch)
// ---------------------------------------------------------------------------

/** POST-only routes keyed by exact path. */
export const POST_ROUTES: Record<string, RouteHandler> = {
  "/models/kokoro/ensure": handleKokoroEnsure,
  "/models/whisper/ensure": handleWhisperEnsure,
  "/tts": handleTts,
  "/transcribe": handleTranscribe,
  "/pronunciation/assess": handlePronunciationAssess,
  "/discover": handleDiscover,
  "/discover/article": handleDiscoverArticle,
  "/discover/pdf": handleDiscoverPdf,
  "/anki/apkg": handleAnkiApkg,
  "/cards/apkg": handleCardsApkg,
};

/** Any-method routes keyed by exact path. */
export const ANY_ROUTES: Record<string, RouteHandler> = {
  "/health": handleHealth,
  "/status": handleStatus,
  "/voice-upload": handleVoiceUpload,
};

// Per-phrase clips decode the whole source file; studying a deck replays clips
// from the same source back to back, so keep the last decoded source around.
const MAX_CLIP_DURATION_MS = 30_000;
let lastDecodedSource: { file: string; decoded: DecodedAudio } | null = null;

async function handleDiscoverClip(requestPath: string): Promise<LocalResponse> {
  const [cleanPath, query = ""] = requestPath.split("?");
  const sourceId = cleanPath.split("/").at(-1) || "";
  const params = new URLSearchParams(query);
  const startMs = Number(params.get("startMs"));
  const endMs = Number(params.get("endMs"));
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs < 0 ||
    endMs <= startMs ||
    endMs - startMs > MAX_CLIP_DURATION_MS
  ) {
    return response(400, { detail: "invalid clip range" });
  }
  const file = await audioPathFor(sourceId);
  if (!file) return response(404, { detail: "audio not found" });
  try {
    if (lastDecodedSource?.file !== file) {
      lastDecodedSource = { file, decoded: await decodeAudio(await readFile(file)) };
    }
    const clip = sliceDecodedAudio(lastDecodedSource.decoded, startMs, endMs);
    return response(200, clip, { "content-type": "audio/wav" });
  } catch (error) {
    logger.error({ err: error, sourceId }, "Clip slicing failed");
    return response(500, { detail: "clip slicing failed" });
  }
}

export async function dispatch(
  requestPath: string,
  options: LocalRequestOptions,
): Promise<LocalResponse> {
  const method = options.method ?? "GET";

  // Any-method exact routes.
  if (ANY_ROUTES[requestPath]) return ANY_ROUTES[requestPath](options);

  // Per-phrase clip slicing — prefix match, any method.
  if (requestPath.startsWith("/discover/clip/")) {
    return handleDiscoverClip(requestPath);
  }

  // Audio streaming — prefix match, any method.
  if (requestPath.startsWith("/discover/audio/")) {
    const file = await audioPathFor(requestPath.split("/").at(-1) || "");
    if (!file) return response(404, { detail: "audio not found" });
    const data = await readFile(file);
    const type = file.endsWith(".m4a")
      ? "audio/mp4"
      : file.endsWith(".webm")
        ? "audio/webm"
        : "application/octet-stream";
    const range = options.headers?.Range || options.headers?.range;
    if (range?.startsWith("bytes=")) {
      const [rawStart, rawEnd] = range.slice(6).split("-");
      const start = Number(rawStart || 0);
      const end = Math.min(
        data.length - 1,
        rawEnd ? Number(rawEnd) : data.length - 1,
      );
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        start > end ||
        start >= data.length
      ) {
        return response(416, Buffer.alloc(0), {
          "content-range": `bytes */${data.length}`,
        });
      }
      return response(206, data.subarray(start, end + 1), {
        "content-type": type,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${data.length}`,
      });
    }
    return response(200, data, {
      "content-type": type,
      "accept-ranges": "bytes",
    });
  }

  // POST-only routes.
  if (method !== "POST") return response(404, { detail: "not found" });
  const handler = POST_ROUTES[requestPath];
  if (handler) return handler(options);

  return response(404, { detail: "not found" });
}
