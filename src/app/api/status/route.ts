import { NextResponse } from "next/server";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTS_SERVER = getTtsServerUrl();

export async function GET() {
  try {
    const res = await fetch(`${TTS_SERVER}/status`, {
      signal: AbortSignal.timeout(3_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ downloading_model: false });
  }
}
