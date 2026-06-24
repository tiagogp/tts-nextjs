/**
 * E2 (speech) — pass a recorded audio clip to the local whisper.cpp runtime and
 * hand back plain text. The client then feeds that text
 * to /api/cards/correct, so speech and typing share the exact same correction path.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { localRequest } from "@/server/localRuntime";
import { MAX_AUDIO_UPLOAD_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PUBLIC_TRANSCRIBE_ERROR =
  "Couldn't transcribe this audio right now. Try again with a shorter or clearer recording.";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Attach an audio file." }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Audio too large (max 25 MB)." }, { status: 413 });
    }
    const res = await localRequest("/transcribe", {
      method: "POST",
      body: Buffer.from(await file.arrayBuffer()),
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Suffix": path.extname(file.name || "clip.webm") || ".webm",
      },
      timeoutMs: 120_000,
    });
    const data = res.json<{ text?: string; detail?: string }>();
    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, data }, "Transcription runtime error");
      return NextResponse.json(
        {
          error:
            res.status === 413
              ? "Audio too large (max 25 MB)."
              : PUBLIC_TRANSCRIBE_ERROR,
        },
        { status: res.status === 413 ? 413 : 502 },
      );
    }
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err: unknown) {
    logger.error({ err }, "Transcription proxy error");
    return NextResponse.json(
      { error: PUBLIC_TRANSCRIBE_ERROR },
      { status: 502 },
    );
  }
}
