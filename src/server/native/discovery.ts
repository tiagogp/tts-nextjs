import "server-only";

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { discoverCacheDir } from "./data";
import { transcribe } from "./speech";

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
    const value = chunk.trim().slice(0, 1000);
    const key = value.replace(/\W+/gu, " ").trim().toLocaleLowerCase();
    if (value.length < 8 || !key || seen.has(key)) return [];
    seen.add(key);
    return [{ text: value, startMs: 0, endMs: 0 }];
  });
}

export function dedupeSegments(segments: Segment[]): Segment[] {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    const key = segment.text.replace(/\W+/gu, " ").trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function vttTimestampMs(value: string): number {
  const match = value.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})/);
  if (!match) return 0;
  return (((Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000) + Number(match[4]);
}

/** Parse a WebVTT track into timed segments, stripping YouTube's inline word-timing tags. */
export function parseVtt(content: string): Segment[] {
  const segments: Segment[] = [];
  for (const block of content.replace(/\r/g, "").split("\n\n")) {
    const lines = block.split("\n");
    const cue = lines.find((line) => line.includes("-->"));
    if (!cue) continue;
    const [rawStart, rawEnd] = cue.split("-->");
    const text = lines
      .slice(lines.indexOf(cue) + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "") // <00:00:01.000>, <c>…</c> word timing
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({ text, startMs: vttTimestampMs(rawStart), endMs: vttTimestampMs(rawEnd) });
  }
  return segments;
}

/** Pick the best downloaded .vtt for `id`, preferring the requested language, and parse it. */
async function readSubtitleSegments(
  root: string,
  id: string,
  lang?: string | null,
): Promise<Segment[]> {
  const vtts = (await readdir(root)).filter(
    (name) => name.startsWith(`${id}.`) && name.endsWith(".vtt"),
  );
  if (vtts.length === 0) return [];
  const preferred =
    (lang && vtts.find((name) => name.includes(`.${lang}`))) ||
    vtts.find((name) => name.includes(".en")) ||
    vtts[0];
  return parseVtt(await readFile(path.join(root, preferred), "utf8"));
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

export async function discoverYouTube(url: string, lang?: string | null): Promise<DiscoverResult> {
  const root = discoverCacheDir();
  await mkdir(root, { recursive: true });
  const id = sourceId(url);
  const cacheFile = path.join(root, `${id}.json`);
  try {
    return JSON.parse(await readFile(cacheFile, "utf8")) as DiscoverResult;
  } catch {}

  // youtubei.js can no longer decipher stream URLs (YouTube cipher changes), so download
  // with yt-dlp, which keeps its signature handling current. Audio is essential; subtitles
  // are a best-effort optimization (a sub failure must not abort the audio we need).
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

  await run([
    "-f", "bestaudio/best",
    ...(ffmpeg ? ["--extract-audio", "--audio-format", "m4a", "--ffmpeg-location", ffmpeg] : []),
    "--print-to-file", "%(title)s", path.join(root, `${id}.title`),
  ]);
  const audioFile = await downloadedAudio(root, id);
  if (!audioFile) throw new Error("yt-dlp did not produce an audio file");

  // Best-effort original captions (not auto-translations); failure just falls back to Whisper.
  const subLangs = lang ? `${lang}-orig,${lang},en-orig,en` : "en-orig,en";
  try {
    await run([
      "--skip-download", "--write-subs", "--write-auto-subs",
      "--sub-langs", subLangs, "--convert-subs", "vtt",
    ]);
  } catch (error) {
    console.error("Subtitle fetch failed; will transcribe instead:", error);
  }

  let title = "Untitled";
  try {
    title = (await readFile(path.join(root, `${id}.title`), "utf8")).trim() || title;
  } catch {}

  // Prefer subtitles (fast, real timestamps); fall back to Whisper for caption-less videos.
  let segments = await readSubtitleSegments(root, id, lang);
  if (!segments.length) {
    segments = (await transcribe({ audio: await readFile(audioFile), language: lang })).segments;
  }

  const result = { sourceId: id, title, segments: dedupeSegments(segments), hasAudio: true };
  await writeFile(cacheFile, JSON.stringify(result));
  return result;
}

export async function discoverArticle(url: string): Promise<DiscoverResult> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Article request failed (${response.status})`);
  const html = await response.text();
  if (html.length > 10_000_000) throw new Error("Article is too large");
  const document = new JSDOM(html, { url }).window.document;
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
