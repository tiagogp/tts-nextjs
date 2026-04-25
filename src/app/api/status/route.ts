import { NextResponse } from "next/server";

const TTS_SERVER = "http://localhost:5002";

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
