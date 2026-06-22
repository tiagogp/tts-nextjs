import "server-only";

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { Innertube, UniversalCache } from "youtubei.js";
import { discoverCacheDir } from "./data";
import { transcribe } from "./speech";

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
    .filter((name) => name.startsWith(`${id}.`) && !name.endsWith(".json") && !name.endsWith(".partial"))
    .sort();
  return matches[0] ? path.join(root, matches[0]) : null;
}

export async function discoverYouTube(url: string, lang?: string | null): Promise<DiscoverResult> {
  const root = discoverCacheDir();
  await mkdir(root, { recursive: true });
  const id = sourceId(url);
  const cacheFile = path.join(root, `${id}.json`);
  try {
    return JSON.parse(await readFile(cacheFile, "utf8")) as DiscoverResult;
  } catch {}

  const youtube = await Innertube.create({ cache: new UniversalCache(false) });
  const info = await youtube.getInfo(videoId(url));
  const title = info.basic_info.title || "Untitled";
  const audioFile = path.join(root, `${id}.m4a`);
  try {
    await stat(audioFile);
  } catch {
    const stream = await info.download({ type: "audio", quality: "best", format: "mp4" });
    const partial = `${audioFile}.partial`;
    await pipeline(Readable.fromWeb(stream as never), createWriteStream(partial));
    await import("node:fs/promises").then(({ rename }) => rename(partial, audioFile));
  }

  let segments: Segment[] | null = null;
  try {
    let transcript = await info.getTranscript();
    if (lang) {
      const candidate = transcript.languages.find((value) => value.toLowerCase().startsWith(lang));
      if (candidate) transcript = await transcript.selectLanguage(candidate);
    }
    const items = transcript.transcript.content?.body?.initial_segments ?? [];
    segments = items.flatMap((item) => {
      const text = item.snippet?.toString?.().trim?.() || "";
      if (!text) return [];
      return [{ text, startMs: Number(item.start_ms) || 0, endMs: Number(item.end_ms) || 0 }];
    });
  } catch {}
  if (!segments?.length) {
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
