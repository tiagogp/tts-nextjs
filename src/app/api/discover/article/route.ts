import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 120;

const TTS_SERVER = getTtsServerUrl();

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

    const res = await fetch(`${TTS_SERVER}/discover/article`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        (data as { detail?: string }).detail ?? `Extraction error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    console.error("Article proxy error:", err);
    const isConnRefused =
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"));
    const message = isConnRefused
      ? "The backend is not running. Run: uvicorn tts_server:app --port 5002"
      : err instanceof Error
        ? err.message
        : "Failed to extract the article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
