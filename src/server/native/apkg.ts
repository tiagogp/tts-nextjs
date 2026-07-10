import "server-only";

import { createHash, randomFillSync } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type initSqlJsType from "sql.js";
import type { SqlJsStatic } from "sql.js";
import { Deck, Model, Note, Package } from "ankipack";
import { audioPathFor } from "./discovery";
import { decodeAudio, sliceDecodedAudio, type DecodedAudio } from "./audio";
import { writeApkgDebug } from "./apkgDebug";
import { synthesize } from "./speech";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js/dist/sql-asm.js") as typeof initSqlJsType;
let sqlPromise: Promise<SqlJsStatic> | null = null;

function sql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs();
  return sqlPromise;
}

const nativeCrypto = globalThis.crypto;
const nativeDigest = nativeCrypto?.subtle?.digest?.bind(nativeCrypto.subtle);

function digestAlgorithmName(algorithm: AlgorithmIdentifier): string {
  return typeof algorithm === "string" ? algorithm : algorithm.name;
}

function digestData(data: BufferSource): Buffer {
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

async function nodeDigest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
  const normalized = digestAlgorithmName(algorithm).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized === "SHA1") {
    const digest = createHash("sha1").update(digestData(data)).digest();
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
  }
  if (nativeDigest) return nativeDigest(algorithm, data);
  throw new Error(`Unsupported digest algorithm: ${digestAlgorithmName(algorithm)}`);
}

function nodeGetRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (array) {
    randomFillSync(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return array;
}

function installAnkipackCryptoShim(): void {
  const subtle = Object.create(nativeCrypto?.subtle ?? null) as SubtleCrypto;
  Object.defineProperty(subtle, "digest", {
    configurable: true,
    value: nodeDigest,
  });
  const crypto = Object.create(nativeCrypto ?? null) as Crypto;
  Object.defineProperties(crypto, {
    subtle: {
      configurable: true,
      value: subtle,
    },
    getRandomValues: {
      configurable: true,
      value: nodeGetRandomValues,
    },
  });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: crypto,
  });
}

installAnkipackCryptoShim();

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function stableId(namespace: string, name: string): number {
  return Number.parseInt(sha1(`${namespace}|${name}`).slice(0, 8), 16) & 0x7fffffff;
}

function logApkg(debugId: string | undefined, step: string, details: Record<string, unknown> = {}): void {
  writeApkgDebug(debugId, step, details);
}

function mediaFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[\\/]/g, "_")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "audio"
  );
}

function basicModel(): Model {
  const name = "Basic (TTS Import - English Front)";
  return new Model({
    id: stableId("anki_model", name),
    name,
    fields: [{ name: "Front" }, { name: "Back" }],
    templates: [{
      name: "Card 1",
      questionFormat: "{{Front}}",
      answerFormat: '{{FrontSide}}<hr id="answer">{{Back}}',
    }],
    css: ".card { font-family: arial; font-size: 22px; text-align: left; color: black; background-color: white; } hr#answer { margin: 12px 0; }",
  });
}

function cardModel(): Model {
  const name = "PhraseLoop Cards (English Front)";
  return new Model({
    id: stableId("anki_model", name),
    name,
    fields: ["Front", "Back", "Audio", "Concept", "ErrorType", "Source"].map((name) => ({ name })),
    templates: [{
      name: "Card 1",
      questionFormat: "{{Front}}",
      answerFormat: '{{FrontSide}}<hr id="answer">{{Back}}<br>{{Audio}}{{#Concept}}<div class="concept">🎯 {{Concept}}</div>{{/Concept}}{{#ErrorType}}<div class="errortype">{{ErrorType}}</div>{{/ErrorType}}',
    }],
    css: ".card { font-family: arial; font-size: 22px; text-align: left; color: black; background-color: white; } hr#answer { margin: 12px 0; } .concept { margin-top: 12px; font-size: 14px; color: #ff5600; } .errortype { margin-top: 4px; font-size: 12px; color: #888; text-transform: uppercase; }",
  });
}

async function output(pkg: Package, debugId?: string): Promise<Buffer> {
  const start = Date.now();
  logApkg(debugId, "package-finalize-started");
  const sqlInstance = await sql();
  logApkg(debugId, "sql-initialized");
  const bytes = Buffer.from(await pkg.toUint8Array(sqlInstance));
  logApkg(debugId, "package-finalized", {
    bytes: bytes.byteLength,
    durationMs: Date.now() - start,
  });
  return bytes;
}

function column(row: unknown, key: string, hasHeader: boolean): string {
  if (hasHeader) {
    if (!row || typeof row !== "object") return "";
    return String((row as Record<string, unknown>)[key] ?? "").trim();
  }
  const index = Number.parseInt(key, 10);
  return Array.isArray(row) && Number.isInteger(index) ? String(row[index] ?? "").trim() : "";
}

function abortError(): Error {
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export async function buildCsvDeck(options: {
  csv: Buffer;
  deck: string;
  ptCol: string;
  enCol: string;
  delimiter: string;
  noHeader: boolean;
  voice: string;
  speed: number;
  synthesizer?: typeof synthesize;
  signal?: AbortSignal;
  debugId?: string;
}): Promise<Buffer> {
  const startedAt = Date.now();
  const text = options.csv.toString("utf8").replace(/^\uFEFF/, "");
  const rows = parse(text, {
    columns: options.noHeader ? false : true,
    delimiter: options.delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as unknown[];
  const model = basicModel();
  const deck = new Deck({ id: stableId("anki_deck", options.deck), name: options.deck, config: null });
  const pkg = new Package();
  const media = new Set<string>();
  let notes = 0;
  logApkg(options.debugId, "csv-export-started", {
    deck: options.deck,
    rows: rows.length,
    voice: options.voice,
    speed: options.speed,
  });
  for (const row of rows) {
    throwIfAborted(options.signal);
    const rowStartedAt = Date.now();
    const pt = column(row, options.ptCol, !options.noHeader);
    const en = column(row, options.enCol, !options.noHeader);
    if (!pt && !en) continue;
    let front = en || "(empty)";
    if (en) {
      const filename = `anki_tts_en_${sha1(`${options.voice}|${options.speed}|${en}`).slice(0, 12)}.wav`;
      if (!media.has(filename)) {
        logApkg(options.debugId, "csv-tts-started", {
          row: notes + 1,
          filename,
          textChars: en.length,
        });
        const audio = await (options.synthesizer ?? synthesize)({
          text: en,
          voice: options.voice,
          speed: options.speed,
        });
        logApkg(options.debugId, "csv-tts-finished", {
          row: notes + 1,
          filename,
          audioBytes: audio.byteLength,
          durationMs: Date.now() - rowStartedAt,
        });
        pkg.addMedia(filename, audio);
        media.add(filename);
        logApkg(options.debugId, "csv-media-added", {
          row: notes + 1,
          filename,
          media: media.size,
        });
      }
      front += `<br>[sound:${filename}]`;
    }
    deck.addNote(new Note({
      model,
      fields: [front, pt || "(empty)"],
      guid: sha1(`${options.deck}|${front}|${pt}`),
      tags: ["tts-import"],
    }));
    notes += 1;
    logApkg(options.debugId, "csv-note-added", {
      row: notes,
      hasAudio: Boolean(en),
      durationMs: Date.now() - rowStartedAt,
    });
  }
  if (notes === 0) {
    throw new Error("No usable notes were found for the Anki deck.");
  }
  pkg.addDeck(deck);
  logApkg(options.debugId, "csv-notes-ready", {
    deck: options.deck,
    notes,
    media: media.size,
    durationMs: Date.now() - startedAt,
  });
  return output(pkg, options.debugId);
}

interface ExportCard {
  front?: unknown;
  back?: unknown;
  audioText?: unknown;
  concept?: unknown;
  errorType?: unknown;
  source?: { kind?: unknown; id?: unknown };
  clip?: { sourceId?: unknown; startMs?: unknown; endMs?: unknown };
}

export async function buildCardsDeck(options: {
  cards: ExportCard[];
  deck: string;
  voice: string;
  speed?: number;
  audioPathResolver?: typeof audioPathFor;
  audioReader?: (path: string) => Promise<Buffer>;
  audioDecoder?: typeof decodeAudio;
  synthesizer?: typeof synthesize;
  signal?: AbortSignal;
  debugId?: string;
}): Promise<Buffer> {
  const startedAt = Date.now();
  const model = cardModel();
  const deck = new Deck({ id: stableId("anki_deck", options.deck), name: options.deck, config: null });
  const pkg = new Package();
  const media = new Set<string>();
  const decodedBySourceId = new Map<string, Promise<DecodedAudio | null>>();
  let notes = 0;
  const resolveAudioPath = options.audioPathResolver ?? audioPathFor;
  const readAudio = options.audioReader ?? readFile;
  const decode = options.audioDecoder ?? decodeAudio;
  logApkg(options.debugId, "card-export-started", {
    deck: options.deck,
    cards: options.cards.length,
    voice: options.voice,
    speed: options.speed ?? 1.15,
  });
  const getDecodedSource = (sourceId: string): Promise<DecodedAudio | null> => {
    let cached = decodedBySourceId.get(sourceId);
    if (!cached) {
      cached = (async () => {
        const sourcePath = await resolveAudioPath(sourceId);
        logApkg(options.debugId, "card-source-audio-resolved", {
          sourceId,
          sourcePath,
        });
        if (!sourcePath) return null;
        const sourceAudio = await readAudio(sourcePath);
        logApkg(options.debugId, "card-source-audio-read", {
          sourceId,
          bytes: sourceAudio.byteLength,
        });
        return decode(sourceAudio);
      })().catch((error) => {
        console.error("Failed to decode source audio for card clip:", error);
        logApkg(options.debugId, "card-source-audio-decode-failed", {
          sourceId,
          error: error instanceof Error ? error.message : "unknown",
        });
        return null;
      });
      decodedBySourceId.set(sourceId, cached);
    }
    return cached;
  };
  for (const card of options.cards) {
    throwIfAborted(options.signal);
    const cardStartedAt = Date.now();
    const front = String(card.front ?? "").trim();
    const back = String(card.back ?? "").trim();
    if (!front || !back) continue;
    const source = card.source
      ? `${String(card.source.kind ?? "")}:${String(card.source.id ?? "")}`
      : "";
    let audio: Buffer | null = null;
    let filename = "";
    const sourceId = String(card.clip?.sourceId ?? "");
    const startMs = Number(card.clip?.startMs);
    const endMs = Number(card.clip?.endMs);
    if (sourceId && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      const decoded = await getDecodedSource(sourceId);
      throwIfAborted(options.signal);
      if (decoded) {
        logApkg(options.debugId, "card-clip-slice-started", {
          card: notes + 1,
          sourceId,
          startMs,
          endMs,
        });
        audio = sliceDecodedAudio(decoded, startMs, endMs);
        filename = `clip_${mediaFilenamePart(sourceId)}_${Math.round(startMs)}_${Math.round(endMs)}.wav`;
        logApkg(options.debugId, "card-clip-slice-finished", {
          card: notes + 1,
          filename,
          audioBytes: audio.byteLength,
        });
      }
    }
    if (!audio) {
      throwIfAborted(options.signal);
      const text = String(card.audioText ?? back).trim() || back;
      filename = `anki_tts_en_${sha1(`${options.voice}|${options.speed ?? 1.15}|${text}`).slice(0, 12)}.wav`;
      logApkg(options.debugId, "card-tts-started", {
        card: notes + 1,
        filename,
        textChars: text.length,
      });
      audio = await (options.synthesizer ?? synthesize)({
        text,
        voice: options.voice,
        speed: options.speed ?? 1.15,
      });
      logApkg(options.debugId, "card-tts-finished", {
        card: notes + 1,
        filename,
        audioBytes: audio.byteLength,
      });
      throwIfAborted(options.signal);
    }
    if (!media.has(filename)) {
      pkg.addMedia(filename, audio);
      media.add(filename);
      logApkg(options.debugId, "card-media-added", {
        card: notes + 1,
        filename,
        media: media.size,
      });
    }
    deck.addNote(new Note({
      model,
      fields: [
        front,
        back,
        `[sound:${filename}]`,
        String(card.concept ?? "").trim(),
        String(card.errorType ?? "").trim(),
        source,
      ],
      guid: sha1(`${options.deck}|${front}|${back}|${source}`),
      tags: ["card-pipeline"],
    }));
    notes += 1;
    logApkg(options.debugId, "card-note-added", {
      card: notes,
      filename,
      durationMs: Date.now() - cardStartedAt,
    });
  }
  if (notes === 0) {
    throw new Error("No usable notes were found for the Anki deck.");
  }
  pkg.addDeck(deck);
  logApkg(options.debugId, "card-notes-ready", {
    deck: options.deck,
    notes,
    media: media.size,
    decodedSources: decodedBySourceId.size,
    durationMs: Date.now() - startedAt,
  });
  return output(pkg, options.debugId);
}
