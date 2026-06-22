import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { localJson } from "@/server/localRuntime";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const res = await localJson("/discover", { url, lang }, 300_000);

    if (res.status < 200 || res.status >= 300) {
      console.error("Discover runtime error:", res.status, res.body.toString("utf8"));
      return NextResponse.json(
        { error: PUBLIC_DISCOVER_ERROR },
        { status: 502 },
      );
    }

    return NextResponse.json(res.json());
  } catch (err: unknown) {
    console.error("Discover proxy error:", err);
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? PUBLIC_DISCOVER_TIMEOUT
        : PUBLIC_DISCOVER_ERROR;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
