import { NextRequest, NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";

const PUBLIC_AUDIO_ERROR = "Audio is not available right now.";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await params;
  if (!/^[a-z0-9]{12}$/.test(sourceId)) {
    return NextResponse.json({ error: PUBLIC_AUDIO_ERROR }, { status: 400 });
  }

  try {
    const range = req.headers.get("range");
    const res = await localRequest(`/discover/audio/${sourceId}`, {
      headers: range ? { Range: range } : undefined,
      timeoutMs: 60_000,
    });
    if (res.status < 200 || res.status >= 300) {
      console.error("Discover audio runtime error:", res.status);
      return NextResponse.json(
        { error: PUBLIC_AUDIO_ERROR },
        { status: res.status },
      );
    }

    const headers = new Headers();
    const contentType = res.headers["content-type"];
    headers.set("Content-Type", typeof contentType === "string" ? contentType : "audio/mpeg");
    headers.set("Cache-Control", "private, max-age=3600");
    for (const name of ["accept-ranges", "content-range", "content-length"]) {
      const value = res.headers[name];
      if (typeof value === "string") headers.set(name, value);
    }

    return new NextResponse(new Uint8Array(res.body), {
      status: res.status,
      headers,
    });
  } catch (err: unknown) {
    console.error("Discover audio proxy error:", err);
    return NextResponse.json(
      { error: PUBLIC_AUDIO_ERROR },
      { status: 500 },
    );
  }
}
