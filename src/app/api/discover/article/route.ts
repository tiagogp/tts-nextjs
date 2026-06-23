import { NextRequest, NextResponse } from "next/server";
import { localJson } from "@/server/localRuntime";
import { httpUrl, readJsonObject } from "@/server/http/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const PUBLIC_ARTICLE_ERROR =
  "Couldn't extract this article right now. Try another link or try again later.";

export async function POST(req: NextRequest) {
  try {
    const bodyObj = await readJsonObject(req);
    const url = httpUrl(bodyObj?.url);
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
