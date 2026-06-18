import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 300;

const TTS_SERVER = getTtsServerUrl();
const PUBLIC_DISCOVER_ERROR =
  "Couldn't process this source right now. Try again in a moment.";
const PUBLIC_DISCOVER_TIMEOUT =
  "Processing is taking longer than expected. Try a shorter source.";

function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s.slice(0, 2048);
  } catch {
    return null;
  }
}

function safeLang(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  // ISO 639-1 (e.g. "en", "pt"); null = auto-detect.
  return /^[a-z]{2}$/.test(s) ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const bodyObj = isPlainObject(body) ? body : null;
    const url = safeUrl(bodyObj?.url);
    if (!url) {
      return NextResponse.json(
        { error: "Provide a valid http(s) URL." },
        { status: 400 },
      );
    }
    const lang = safeLang(bodyObj?.lang);

    const res = await fetch(`${TTS_SERVER}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, lang }),
      // Whisper transcription can take a while on long videos.
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Discover backend error:", res.status, data);
      return NextResponse.json(
        { error: PUBLIC_DISCOVER_ERROR },
        { status: 502 },
      );
    }

    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    console.error("Discover proxy error:", err);
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? PUBLIC_DISCOVER_TIMEOUT
        : PUBLIC_DISCOVER_ERROR;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
