import type { PronunciationAssessment } from "@/lib/pronunciation/types";

export async function assessPronunciation(input: {
  blob: Blob;
  targetText: string;
  targetLang?: string;
  referenceDurationMs?: number;
  filename?: string;
}): Promise<PronunciationAssessment> {
  const ext = input.filename?.includes(".")
    ? input.filename.split(".").pop()!.toLowerCase()
    : input.blob.type.includes("ogg")
      ? "ogg"
      : input.blob.type.includes("mp4")
        ? "mp4"
        : "webm";
  const form = new FormData();
  form.append("file", input.blob, input.filename || `pronunciation.${ext}`);
  form.append("targetText", input.targetText);
  form.append("targetLang", input.targetLang || "en");
  if (input.referenceDurationMs && input.referenceDurationMs > 0) {
    form.append("referenceDurationMs", String(Math.round(input.referenceDurationMs)));
  }
  const response = await fetch("/api/pronunciation/assess", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as PronunciationAssessment & {
    error?: string;
    code?: string;
    downloading?: boolean;
    progress?: number;
  };
  if (!response.ok) {
    let message = data.error ?? `Não consegui avaliar a pronúncia agora (erro ${response.status}).`;
    if (data.code === "model_not_ready" && data.downloading && (data.progress ?? 0) > 0) {
      message += ` ${Math.round((data.progress ?? 0) * 100)}% baixado.`;
    }
    throw new Error(message);
  }
  return data;
}
