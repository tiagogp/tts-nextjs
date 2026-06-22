import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCardsDeck, buildCsvDeck } from "./native/apkg";
import { dataDir } from "./native/data";
import { audioPathFor, discoverArticle, discoverPdf, discoverYouTube } from "./native/discovery";
import { modelStatus } from "./native/models";
import { synthesize, transcribe } from "./native/speech";

export interface LocalResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  json<T>(): T;
}

interface LocalRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
  timeoutMs?: number;
}

function response(status: number, body: Buffer | string | object = Buffer.alloc(0), headers: Record<string, string> = {}): LocalResponse {
  const data = Buffer.isBuffer(body)
    ? body
    : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  return {
    status,
    headers: { "content-length": String(data.byteLength), ...headers },
    body: data,
    json<T>() { return JSON.parse(data.toString("utf8") || "{}") as T; },
  };
}

function parseJson(body?: Buffer | string): Record<string, unknown> {
  const value = JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : body || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON object required");
  return value;
}

async function dispatch(requestPath: string, options: LocalRequestOptions): Promise<LocalResponse> {
  const method = options.method ?? "GET";
  if (requestPath === "/health") return response(200, { status: "ok", ready: true });
  if (requestPath === "/status") return response(200, modelStatus());

  const voiceFile = path.join(dataDir(), "voice-reference.wav");
  const voiceName = path.join(dataDir(), "voice-reference.name");
  if (requestPath === "/voice-upload") {
    await mkdir(dataDir(), { recursive: true });
    if (method === "DELETE") {
      await Promise.all([rm(voiceFile, { force: true }), rm(voiceName, { force: true })]);
      return response(200, { status: "ok" });
    }
    if (method === "POST") {
      const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body || "");
      if (!body.length) return response(400, { detail: "empty audio" });
      const name = decodeURIComponent(options.headers?.["X-File-Name"] || "voice-reference.wav");
      await Promise.all([writeFile(voiceFile, body), writeFile(voiceName, name)]);
      return response(200, { name });
    }
    try {
      return response(200, { name: (await readFile(voiceName, "utf8")).trim() || "voice-reference.wav" });
    } catch {
      return response(200, { name: null });
    }
  }

  if (requestPath.startsWith("/discover/audio/")) {
    const file = await audioPathFor(requestPath.split("/").at(-1) || "");
    if (!file) return response(404, { detail: "audio not found" });
    const data = await readFile(file);
    const type = file.endsWith(".m4a") ? "audio/mp4" : file.endsWith(".webm") ? "audio/webm" : "application/octet-stream";
    const range = options.headers?.Range || options.headers?.range;
    if (range?.startsWith("bytes=")) {
      const [rawStart, rawEnd] = range.slice(6).split("-");
      const start = Number(rawStart || 0);
      const end = Math.min(data.length - 1, rawEnd ? Number(rawEnd) : data.length - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= data.length) {
        return response(416, Buffer.alloc(0), { "content-range": `bytes */${data.length}` });
      }
      return response(206, data.subarray(start, end + 1), {
        "content-type": type,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${data.length}`,
      });
    }
    return response(200, data, { "content-type": type, "accept-ranges": "bytes" });
  }

  if (method !== "POST") return response(404, { detail: "not found" });
  if (requestPath === "/tts") {
    const value = parseJson(options.body);
    const text = String(value.text || "").trim();
    if (!text || text.length > 4096) return response(400, { detail: "invalid text" });
    const body = await synthesize({ text, voice: String(value.voice || "af_heart"), speed: Number(value.speed) || 1.15 });
    return response(200, body, { "content-type": "audio/wav" });
  }
  if (requestPath === "/transcribe") {
    const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body || "");
    const result = await transcribe({ audio: body, language: options.headers?.["X-Language"] || null });
    return response(200, { text: result.text });
  }
  if (requestPath === "/discover") {
    const value = parseJson(options.body);
    return response(200, await discoverYouTube(
      String(value.url || ""),
      typeof value.lang === "string" ? value.lang : null,
    ));
  }
  if (requestPath === "/discover/article") {
    return response(200, await discoverArticle(String(parseJson(options.body).url || "")));
  }
  if (requestPath === "/discover/pdf") {
    const body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body || "");
    const name = decodeURIComponent(options.headers?.["X-File-Name"] || "upload.pdf");
    return response(200, await discoverPdf(body, name));
  }
  if (requestPath === "/anki/apkg") {
    const value = parseJson(options.body);
    const body = await buildCsvDeck({
      csv: Buffer.from(String(value.csvBase64 || ""), "base64"),
      deck: String(value.deck || "PhraseLoop"),
      ptCol: String(value.ptCol || "pt"),
      enCol: String(value.enCol || "en"),
      delimiter: String(value.delimiter || ",").slice(0, 1),
      noHeader: value.noHeader === true,
      voice: String(value.voice || "af_heart"),
      speed: Number(value.speed) || 1.15,
    });
    return response(200, body, { "content-type": "application/octet-stream" });
  }
  if (requestPath === "/cards/apkg") {
    const value = parseJson(options.body);
    const body = await buildCardsDeck({
      cards: Array.isArray(value.cards) ? value.cards : [],
      deck: String(value.deck || "PhraseLoop"),
      voice: String(value.voice || "af_heart"),
      speed: Number(value.speed) || 1.15,
    });
    return response(200, body, { "content-type": "application/octet-stream" });
  }
  return response(404, { detail: "not found" });
}

export async function localRequest(
  requestPath: string,
  options: LocalRequestOptions = {},
): Promise<LocalResponse> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise<LocalResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("PhraseLoop local request timed out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
    dispatch(requestPath, options).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function localJson(requestPath: string, value: unknown, timeoutMs?: number): Promise<LocalResponse> {
  return localRequest(requestPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    timeoutMs,
  });
}
