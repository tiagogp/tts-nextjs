import { NextRequest, NextResponse } from "next/server";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";

const TTS_SERVER = getTtsServerUrl();
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
    const res = await fetch(`${TTS_SERVER}/discover/audio/${sourceId}`, {
      headers: range ? { Range: range } : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.error("Discover audio backend error:", res.status);
      return NextResponse.json(
        { error: PUBLIC_AUDIO_ERROR },
        { status: res.status },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "audio/mpeg");
    headers.set("Cache-Control", "private, max-age=3600");
    for (const name of ["accept-ranges", "content-range", "content-length"]) {
      const value = res.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new NextResponse(res.body, {
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
