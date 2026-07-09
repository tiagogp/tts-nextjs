import { NextRequest, NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";

const PUBLIC_CLIP_ERROR = "O áudio desta frase não está disponível agora.";

/**
 * Serves the native audio slice for one saved phrase (startMs–endMs of a
 * Discover source). Cards persisted without an AI provider point their
 * `audioClipPath` here so Study and the pronunciation coach can play the
 * original clip instead of the whole source file.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await params;
  const startMs = Number(req.nextUrl.searchParams.get("startMs"));
  const endMs = Number(req.nextUrl.searchParams.get("endMs"));
  if (
    !/^[a-z0-9]{12}$/.test(sourceId) ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs < 0 ||
    endMs <= startMs
  ) {
    return NextResponse.json({ error: PUBLIC_CLIP_ERROR }, { status: 400 });
  }

  try {
    const res = await localRequest(
      `/discover/clip/${sourceId}?startMs=${Math.floor(startMs)}&endMs=${Math.ceil(endMs)}`,
      { timeoutMs: 60_000 },
    );
    if (res.status < 200 || res.status >= 300) {
      return NextResponse.json({ error: PUBLIC_CLIP_ERROR }, { status: res.status });
    }
    return new NextResponse(new Uint8Array(res.body), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    console.error("Discover clip proxy error:", err);
    return NextResponse.json({ error: PUBLIC_CLIP_ERROR }, { status: 500 });
  }
}
