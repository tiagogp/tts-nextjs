import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { localJson } from "@/server/localRuntime";

export const runtime = "nodejs";
export const maxDuration = 120;

const PUBLIC_ARTICLE_ERROR =
  "Couldn't extract this article right now. Try another link or try again later.";

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

    const res = await localJson("/discover/article", { url }, 120_000);

    if (res.status < 200 || res.status >= 300) {
      console.error("Article runtime error:", res.status, res.body.toString("utf8"));
      return NextResponse.json(
        { error: PUBLIC_ARTICLE_ERROR },
        { status: res.status },
      );
    }

    return NextResponse.json(res.json());
  } catch (err: unknown) {
    console.error("Article proxy error:", err);
    return NextResponse.json({ error: PUBLIC_ARTICLE_ERROR }, { status: 500 });
  }
}
