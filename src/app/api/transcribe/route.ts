/**
 * E2 (speech) — proxy a recorded audio clip to the Python TTS/Whisper server's
 * /transcribe endpoint and hand back the plain text. The client then feeds that text
 * to /api/cards/correct, so speech and typing share the exact same correction path.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTS_SERVER = getTtsServerUrl();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${TTS_SERVER}/transcribe`, {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as { text?: string; detail?: string };
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Transcription failed." },
        { status: res.status === 413 ? 413 : 502 },
      );
    }
    return NextResponse.json({ text: data.text ?? "" });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the transcription server. Is the backend running?" },
      { status: 502 },
    );
  }
}
