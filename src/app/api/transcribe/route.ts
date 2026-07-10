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
  "Não consegui transcrever esse áudio agora. Tente uma gravação mais curta ou mais clara.";
const AUDIO_TOO_LARGE_ERROR = "Áudio grande demais (máximo 25 MB).";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Grave ou anexe um áudio primeiro." }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      return NextResponse.json({ error: AUDIO_TOO_LARGE_ERROR }, { status: 413 });
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
    const data = res.json<{
      text?: string;
      detail?: string;
      error?: string;
      code?: string;
      downloading?: boolean;
      progress?: number;
    }>();
    if (res.status === 409 && data.code === "model_not_ready") {
      // One-time Whisper download in flight: surface the runtime's PT-BR copy
      // and progress so the UI can show a download notice instead of hanging.
      return NextResponse.json(
        {
          error: data.error ?? PUBLIC_TRANSCRIBE_ERROR,
          code: data.code,
          downloading: data.downloading,
          progress: data.progress,
        },
        { status: 409 },
      );
    }
    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, data }, "Transcription runtime error");
      return NextResponse.json(
        {
          error:
            res.status === 413
              ? AUDIO_TOO_LARGE_ERROR
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
