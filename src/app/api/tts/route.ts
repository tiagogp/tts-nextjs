import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { isPlainObject } from "@/lib/isObject";
import { sanitizeFilename } from "@/lib/sanitizeFilename";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 300;

const TTS_SERVER = getTtsServerUrl();

const MAX_TEXT_CHARS = 4096;
const MAX_ITEMS = 250;
const MAX_TOTAL_CHARS = 80_000;
const DEFAULT_SPEED = 1.15;
const DEFAULT_VOICE = "af_heart";
const PUBLIC_TTS_ERROR =
  "Couldn't generate audio right now. Try again in a moment.";
const PUBLIC_TTS_TIMEOUT =
  "Audio generation is taking longer than expected. Try again with a shorter text.";

class PublicRouteError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeSpeed(v: unknown): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return DEFAULT_SPEED;
  return clamp(n, 0.5, 2.0);
}

function safeVoice(v: unknown): string {
  const s =
    typeof v === "string"
      ? v.trim()
      : v === null || v === undefined
        ? ""
        : String(v).trim();
  if (!s) return DEFAULT_VOICE;
  return s.slice(0, 64);
}

function normalizeLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    out.push(t);
  }
  return out;
}

function extractLinesFromJson(value: unknown, textKey: string): string[] {
  if (Array.isArray(value)) {
    const strings = normalizeLines(value);
    if (strings.length > 0) return strings;

    const out: string[] = [];
    for (const item of value) {
      if (typeof item === "string") continue;
      if (!isPlainObject(item)) continue;
      const v = item[textKey];
      if (typeof v === "string" && v.trim()) out.push(v.trim());
    }
    return out;
  }

  if (isPlainObject(value)) {
    const items = value.items ?? value.lines ?? value.texts;
    if (Array.isArray(items)) return extractLinesFromJson(items, textKey);
  }

  return [];
}

async function synthOne(text: string, speed: number, voice: string): Promise<Buffer> {
  if (text.length > MAX_TEXT_CHARS) {
    throw new PublicRouteError(`Text exceeds ${MAX_TEXT_CHARS} characters.`, 400);
  }

  const ttsRes = await fetch(`${TTS_SERVER}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.trim(),
      voice,
      speed,
      engine: "kokoro",
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!ttsRes.ok) {
    const data = await ttsRes.json().catch(() => ({}));
    console.error("TTS backend error:", ttsRes.status, data);
    throw new PublicRouteError(PUBLIC_TTS_ERROR, 502);
  }

  return Buffer.from(await ttsRes.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const bodyObj = isPlainObject(body) ? body : null;
    const speed = safeSpeed(bodyObj?.speed);
    const voice = safeVoice(bodyObj?.voice);

    const lines =
      Array.isArray(body)
        ? extractLinesFromJson(body, "text")
        : Array.isArray(bodyObj?.lines)
          ? normalizeLines(bodyObj.lines)
          : bodyObj?.json !== undefined
            ? extractLinesFromJson(bodyObj.json, String(bodyObj.textKey ?? "text"))
            : [];

    if (lines.length > 0) {
      if (lines.length > MAX_ITEMS) {
        return NextResponse.json(
          { error: `Too many items (max ${MAX_ITEMS}).` },
          { status: 400 },
        );
      }
      const totalChars = lines.reduce((sum, t) => sum + t.length, 0);
      if (totalChars > MAX_TOTAL_CHARS) {
        return NextResponse.json(
          { error: `Total text too large (max ${MAX_TOTAL_CHARS} characters).` },
          { status: 400 },
        );
      }

      const zip = new JSZip();
      const counts: Record<string, number> = {};

      for (let i = 0; i < lines.length; i++) {
        const t = lines[i];
        const wav = await synthOne(t, speed, voice);
        const base = sanitizeFilename(t);
        const count = counts[base] ?? 0;
        counts[base] = count + 1;
        const filename =
          count === 0
            ? `${String(i + 1).padStart(3, "0")} - ${base}.wav`
            : `${String(i + 1).padStart(3, "0")} - ${base} (${count}).wav`;
        zip.file(filename, wav);
      }

      const out = await zip.generateAsync({ type: "nodebuffer" });
      const zipBody = out.buffer.slice(
        out.byteOffset,
        out.byteOffset + out.byteLength,
      ) as ArrayBuffer;
      return new NextResponse(zipBody, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="tts.zip"',
          "Content-Length": out.byteLength.toString(),
        },
      });
    }

    const text = bodyObj?.text;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            'Provide either "text" (string), "lines" (string[]), or "json" (array/object).',
        },
        { status: 400 },
      );
    }

    const buffer = await synthOne(text, speed, voice);
    const wavBody = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(wavBody, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="speech.wav"',
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    console.error("TTS proxy error:", err);
    if (err instanceof PublicRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? PUBLIC_TTS_TIMEOUT
        : PUBLIC_TTS_ERROR;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
