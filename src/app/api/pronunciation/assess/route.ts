import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { MAX_AUDIO_UPLOAD_BYTES } from "@/lib/constants";
import { localRequest } from "@/server/localRuntime";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TARGET_TEXT_CHARS = 500;
const PUBLIC_PRONUNCIATION_ERROR =
  "Não consegui avaliar a pronúncia agora. Tente uma gravação mais curta e mais clara.";
const AUDIO_TOO_LARGE_ERROR = "Áudio grande demais (máximo 25 MB).";

function formText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Grave um áudio primeiro." }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      return NextResponse.json({ error: AUDIO_TOO_LARGE_ERROR }, { status: 413 });
    }

    const targetText = formText(formData.get("targetText"));
    if (!targetText) {
      return NextResponse.json({ error: "Escolha uma frase para avaliar." }, { status: 400 });
    }
    if (targetText.length > MAX_TARGET_TEXT_CHARS) {
      return NextResponse.json({ error: "A frase é longa demais para o treino de pronúncia." }, { status: 400 });
    }
    const targetLang = formText(formData.get("targetLang")).slice(0, 16) || "en";
    const referenceDurationMs = Number(formText(formData.get("referenceDurationMs")).slice(0, 16));

    const res = await localRequest("/pronunciation/assess", {
      method: "POST",
      body: Buffer.from(await file.arrayBuffer()),
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Suffix": path.extname(file.name || "clip.webm") || ".webm",
        "X-Target-Text": encodeURIComponent(targetText),
        "X-Target-Lang": targetLang,
        ...(Number.isFinite(referenceDurationMs) && referenceDurationMs > 0
          ? { "X-Reference-Duration-Ms": String(referenceDurationMs) }
          : {}),
      },
      timeoutMs: 120_000,
    });
    const data = res.json<{
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
          error: data.error ?? PUBLIC_PRONUNCIATION_ERROR,
          code: data.code,
          downloading: data.downloading,
          progress: data.progress,
        },
        { status: 409 },
      );
    }
    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, data }, "Pronunciation runtime error");
      return NextResponse.json(
        { error: res.status === 413 ? AUDIO_TOO_LARGE_ERROR : PUBLIC_PRONUNCIATION_ERROR },
        { status: res.status === 413 ? 413 : 502 },
      );
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    logger.error({ err }, "Pronunciation proxy error");
    return NextResponse.json({ error: PUBLIC_PRONUNCIATION_ERROR }, { status: 502 });
  }
}
