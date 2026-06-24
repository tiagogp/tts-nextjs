import { NextRequest, NextResponse } from "next/server";
import { localJson } from "@/server/localRuntime";
import { httpUrl, readJsonObject } from "@/server/http/validation";
import { MAX_SETTINGS_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const PUBLIC_DISCOVER_ERROR =
  "Couldn't process this source right now. Try again in a moment.";
const PUBLIC_DISCOVER_TIMEOUT =
  "Processing is taking longer than expected. Try a shorter source.";

function safeLang(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  // ISO 639-1 (e.g. "en", "pt"); null = auto-detect.
  return /^[a-z]{2}$/.test(s) ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const bodyObj = await readJsonObject(req, { maxBytes: MAX_SETTINGS_JSON_BYTES });
    const url = httpUrl(bodyObj?.url);
    if (!url) {
      return NextResponse.json(
        { error: "Provide a valid http(s) URL." },
        { status: 400 },
      );
    }
    const lang = safeLang(bodyObj?.lang);

    const res = await localJson("/discover", { url, lang }, 300_000);

    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, body: res.body.toString("utf8") }, "Discover runtime error");
      return NextResponse.json(
        { error: PUBLIC_DISCOVER_ERROR },
        { status: 502 },
      );
    }

    return NextResponse.json(res.json());
  } catch (err: unknown) {
    logger.error({ err }, "Discover proxy error");
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? PUBLIC_DISCOVER_TIMEOUT
        : PUBLIC_DISCOVER_ERROR;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
