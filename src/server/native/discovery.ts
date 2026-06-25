import "server-only";

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { discoverCacheDir } from "./data";
import { transcribe, transcriptText } from "./speech";

const execFileAsync = promisify(execFile);

export interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface DiscoverResult {
  sourceId: string;
  title: string;
  segments: Segment[];
  hasAudio: boolean;
}

function normalizeDiscoverResult(result: DiscoverResult): DiscoverResult {
  return {
    ...result,
    segments: dedupeSegments(Array.isArray(result.segments) ? result.segments : []),
  };
}

function sourceId(value: string | Buffer): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function videoId(url: string): string {
  const parsed = new URL(url);
  const id = parsed.hostname === "youtu.be"
    ? parsed.pathname.slice(1).split("/")[0]
    : parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!id || !/^[\w-]{6,20}$/.test(id)) throw new Error("Invalid YouTube URL");
  return id;
}

export function segmentText(text: string): Segment[] {
  const chunks = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z"'(À-ſ])/u);
  const seen = new Set<string>();
  return chunks.flatMap((chunk) => {
    const value = transcriptText(chunk).slice(0, 1000);
    const key = value.replace(/\W+/gu, " ").trim().toLocaleLowerCase();
    if (value.length < 8 || !key || seen.has(key)) return [];
    seen.add(key);
    return [{ text: value, startMs: 0, endMs: 0 }];
  });
}

function wordOverlapLen(a: string[], b: string[]): number {
  const maxLen = Math.min(a.length, b.length);
  for (let len = maxLen; len >= 2; len--) {
    if (a.slice(-len).join(" ") === b.slice(0, len).join(" ")) return len;
  }
  return 0;
}

export function dedupeSegments(segments: Segment[]): Segment[] {
  // Pass 1: normalize and exact-dedup
  const seen = new Set<string>();
  const normalized: Array<Segment & { key: string }> = [];
  for (const segment of segments) {
    const text = transcriptText(segment.text);
    const key = text.replace(/\W+/gu, " ").trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ ...segment, text, key });
  }

  // Pass 2: remove rolling-window duplicates (Whisper sliding-window pattern).
  // A segment is dropped when it is either a strict prefix of the next segment,
  // or when it overlaps significantly (≥4 words and ≥40% of its length) with
  // the tail of the previously kept segment.
  const result: Array<Segment & { key: string }> = [];
  for (let i = 0; i < normalized.length; i++) {
    const curr = normalized[i];
    const next = normalized[i + 1];
    if (next && next.key.startsWith(curr.key + " ")) continue;
    const prev = result[result.length - 1];
    if (prev) {
      const currWords = curr.key.split(" ");
      const overlap = wordOverlapLen(prev.key.split(" "), currWords);
      if (overlap >= 4 && overlap / currWords.length >= 0.4) continue;
    }
    result.push(curr);
  }

  return result.map(({ key: _key, ...s }) => s);
}

export async function audioPathFor(id: string): Promise<string | null> {
  if (!/^[a-z0-9]{12}$/i.test(id)) return null;
  const root = discoverCacheDir();
  await mkdir(root, { recursive: true });
  const matches = (await readdir(root))
    .filter((name) => name.startsWith(`${id}.`) && !/\.(json|vtt|title|partial)$/.test(name))
    .sort();
  return matches[0] ? path.join(root, matches[0]) : null;
}

/** Resolve a binary, preferring an env override, then common Homebrew/system paths, then PATH. */
function findBinary(name: string, envVar: string, candidates: string[]): string {
  const override = process.env[envVar];
  if (override && existsSync(override)) return override;
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return name; // fall back to PATH lookup
}

function ytDlpBinary(): string {
  return findBinary("yt-dlp", "YTDLP_PATH", [
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ]);
}

/** Directory holding ffmpeg, passed to yt-dlp via --ffmpeg-location (null = rely on PATH). */
function ffmpegDir(): string | null {
  for (const dir of ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]) {
    if (existsSync(path.join(dir, "ffmpeg"))) return dir;
  }
  return null;
}


/** Locate the audio file yt-dlp produced for `id` (extension may vary if ffmpeg is absent). */
async function downloadedAudio(root: string, id: string): Promise<string | null> {
  const match = (await readdir(root)).find(
    (name) =>
      name.startsWith(`${id}.`) &&
      !/\.(json|vtt|title|partial)$/.test(name),
  );
  return match ? path.join(root, match) : null;
}

export async function discoverYouTube(
  url: string,
  lang?: string | null,
  onProgress?: (percent: number, stage: string) => void,
): Promise<DiscoverResult> {
  const root = discoverCacheDir();
  await mkdir(root, { recursive: true });
  const id = sourceId(url);
  const cacheFile = path.join(root, `${id}.json`);
  try {
    const cached = normalizeDiscoverResult(JSON.parse(await readFile(cacheFile, "utf8")) as DiscoverResult);
    void writeFile(cacheFile, JSON.stringify(cached)).catch(() => {});
    return cached;
  } catch {}

  // youtubei.js can no longer decipher stream URLs (YouTube cipher changes), so download
  // with yt-dlp, which keeps its signature handling current. Audio is essential; subtitles
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId(url)}`;
  const ffmpeg = ffmpegDir();
  const bin = ytDlpBinary();
  const run = async (extraArgs: string[]) => {
    try {
      await execFileAsync(bin, [
        "--no-playlist", "--no-warnings", "--no-progress", "--quiet", "--no-abort-on-error",
        "-o", path.join(root, `${id}.%(ext)s`), ...extraArgs, canonicalUrl,
      ], { maxBuffer: 32 * 1024 * 1024, timeout: 270_000 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new Error("yt-dlp is not installed. Install it (e.g. `brew install yt-dlp`) to import YouTube videos.");
      }
      throw error;
    }
  };

  onProgress?.(0, "download");
  await run([
    "-f", "bestaudio/best",
    ...(ffmpeg ? ["--extract-audio", "--audio-format", "m4a", "--ffmpeg-location", ffmpeg] : []),
    "--print-to-file", "%(title)s", path.join(root, `${id}.title`),
  ]);
  const audioFile = await downloadedAudio(root, id);
  if (!audioFile) throw new Error("yt-dlp did not produce an audio file");

  let title = "Untitled";
  try {
    title = (await readFile(path.join(root, `${id}.title`), "utf8")).trim() || title;
  } catch {}

  // Map Whisper progress (0–100) into the transcription slice (20–97% overall).
  const onWhisperProgress = onProgress
    ? (pct: number) => onProgress(20 + Math.round(pct * 0.77), "transcribe")
    : undefined;
  onProgress?.(20, "transcribe");
  const segments = (await transcribe({ audio: await readFile(audioFile), language: lang, onProgress: onWhisperProgress })).segments;
  onProgress?.(98, "transcribe");

  const result = normalizeDiscoverResult({ sourceId: id, title, segments, hasAudio: true });
  await writeFile(cacheFile, JSON.stringify(result));
  return result;
}

export async function discoverArticle(url: string): Promise<DiscoverResult> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Article request failed (${response.status})`);
  const html = await response.text();
  if (html.length > 10_000_000) throw new Error("Article is too large");
  const { document } = parseHTML(html);
  if (!document.querySelector("base")) {
    const base = document.createElement("base");
    base.href = url;
    document.head.prepend(base);
  }
  const article = new Readability(document).parse();
  if (!article?.textContent?.trim()) throw new Error("No readable article text found");
  return {
    sourceId: sourceId(url),
    title: article.title || "Article",
    segments: segmentText(article.textContent),
    hasAudio: false,
  };
}

export async function discoverPdf(data: Buffer, filename: string): Promise<DiscoverResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  const text = pages.join("\n").trim();
  if (!text) throw new Error("No extractable PDF text found");
  return {
    sourceId: sourceId(data),
    title: filename.replace(/\.pdf$/i, "") || "PDF",
    segments: segmentText(text),
    hasAudio: false,
  };
}
