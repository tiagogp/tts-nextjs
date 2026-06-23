import "server-only";

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { Deck, Model, Note, Package } from "ankipack";
import { audioPathFor } from "./discovery";
import { decodeAudio, sliceDecodedAudio, type DecodedAudio } from "./audio";
import { synthesize } from "./speech";

const require = createRequire(import.meta.url);
let sqlPromise: Promise<SqlJsStatic> | null = null;

function sqlWasmPath(): string {
  const moduleEntry = require.resolve("sql.js");
  const candidates = [
    path.join(path.dirname(moduleEntry), "sql-wasm.wasm"),
    path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
  ];
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, "native", "sql-wasm.wasm"));
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function sql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => sqlWasmPath() });
  return sqlPromise;
}

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function stableId(namespace: string, name: string): number {
  return Number.parseInt(sha1(`${namespace}|${name}`).slice(0, 8), 16) & 0x7fffffff;
}

function logApkg(step: string, details: Record<string, unknown> = {}): void {
  console.info("[apkg]", step, details);
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
  return new Model({
    id: stableId("anki_model", "Basic (TTS Import)"),
    name: "Basic (TTS Import)",
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
  return new Model({
    id: stableId("anki_model", "PhraseLoop Cards"),
    name: "PhraseLoop Cards",
    fields: ["Front", "Back", "Audio", "Concept", "ErrorType", "Source"].map((name) => ({ name })),
    templates: [{
      name: "Card 1",
      questionFormat: "{{Front}}",
      answerFormat: '{{FrontSide}}<hr id="answer">{{Back}}<br>{{Audio}}{{#Concept}}<div class="concept">🎯 {{Concept}}</div>{{/Concept}}{{#ErrorType}}<div class="errortype">{{ErrorType}}</div>{{/ErrorType}}',
    }],
    css: ".card { font-family: arial; font-size: 22px; text-align: left; color: black; background-color: white; } hr#answer { margin: 12px 0; } .concept { margin-top: 12px; font-size: 14px; color: #ff5600; } .errortype { margin-top: 4px; font-size: 12px; color: #888; text-transform: uppercase; }",
  });
}

async function output(pkg: Package): Promise<Buffer> {
  const start = Date.now();
  const bytes = Buffer.from(await pkg.toUint8Array(await sql()));
  logApkg("package finalized", {
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
  logApkg("csv export started", {
    deck: options.deck,
    rows: rows.length,
    voice: options.voice,
    speed: options.speed,
  });
  for (const row of rows) {
    throwIfAborted(options.signal);
    const pt = column(row, options.ptCol, !options.noHeader);
    const en = column(row, options.enCol, !options.noHeader);
    if (!pt && !en) continue;
    let front = en || "(empty)";
    if (en) {
      const filename = `anki_tts_en_${sha1(`${options.voice}|${options.speed}|${en}`).slice(0, 12)}.wav`;
      if (!media.has(filename)) {
        pkg.addMedia(filename, await (options.synthesizer ?? synthesize)({
          text: en,
          voice: options.voice,
          speed: options.speed,
        }));
        media.add(filename);
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
  }
  if (notes === 0) {
    throw new Error("No usable notes were found for the Anki deck.");
  }
  pkg.addDeck(deck);
  logApkg("csv notes ready", {
    deck: options.deck,
    notes,
    media: media.size,
    durationMs: Date.now() - startedAt,
  });
  return output(pkg);
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
  logApkg("card export started", {
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
        if (!sourcePath) return null;
        return decode(await readAudio(sourcePath));
      })().catch((error) => {
        console.error("Failed to decode source audio for card clip:", error);
        return null;
      });
      decodedBySourceId.set(sourceId, cached);
    }
    return cached;
  };
  for (const card of options.cards) {
    throwIfAborted(options.signal);
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
        audio = sliceDecodedAudio(decoded, startMs, endMs);
        filename = `clip_${mediaFilenamePart(sourceId)}_${Math.round(startMs)}_${Math.round(endMs)}.wav`;
      }
    }
    if (!audio) {
      throwIfAborted(options.signal);
      const text = String(card.audioText ?? back).trim() || back;
      filename = `anki_tts_en_${sha1(`${options.voice}|${options.speed ?? 1.15}|${text}`).slice(0, 12)}.wav`;
      audio = await (options.synthesizer ?? synthesize)({
        text,
        voice: options.voice,
        speed: options.speed ?? 1.15,
      });
      throwIfAborted(options.signal);
    }
    if (!media.has(filename)) {
      pkg.addMedia(filename, audio);
      media.add(filename);
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
  }
  if (notes === 0) {
    throw new Error("No usable notes were found for the Anki deck.");
  }
  pkg.addDeck(deck);
  logApkg("card notes ready", {
    deck: options.deck,
    notes,
    media: media.size,
    decodedSources: decodedBySourceId.size,
    durationMs: Date.now() - startedAt,
  });
  return output(pkg);
}
