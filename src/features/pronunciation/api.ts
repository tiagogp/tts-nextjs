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
  const data = (await response.json().catch(() => ({}))) as PronunciationAssessment & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Pronunciation failed (${response.status})`);
  return data;
}
