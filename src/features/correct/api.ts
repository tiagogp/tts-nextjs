import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { ProviderKind } from "@/lib/cards/provider";

export interface DeckGenerationResult {
  cards?: Card[];
  count?: number;
  filename?: string;
  apkg?: string;
  error?: string;
  code?: string;
}

/** Error carrying the server's machine-readable `code` (e.g. "model_not_ready"). */
export class DeckGenerationError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "DeckGenerationError";
    this.code = code;
  }
}

export async function generateCorrectionDeck(input: {
  provider: ProviderKind;
  selectedModel?: string;
  events: ErrorEvent[];
  signal: AbortSignal;
}): Promise<DeckGenerationResult> {
  const response = await fetch("/api/cards/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      deck: "English - Corrections",
      persist: true,
      errors: input.events,
    }),
    signal: input.signal,
  });
  const data = (await response.json().catch(() => ({}))) as DeckGenerationResult;
  if (!response.ok) {
    throw new DeckGenerationError(
      data.error ?? `Request failed (${response.status})`,
      data.code,
    );
  }
  return data;
}

export async function evaluateCorrectionText(input: {
  provider: ProviderKind;
  selectedModel?: string;
  text: string;
}): Promise<ErrorEvent[]> {
  const response = await fetch("/api/cards/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      text: input.text,
      sourceLang: "pt",
      targetLang: "en",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    events?: ErrorEvent[];
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data.events ?? [];
}

export async function transcribeAudio(blob: Blob, filename?: string): Promise<string> {
  const ext = filename?.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("mp4")
        ? "mp4"
        : "webm";
  const form = new FormData();
  form.append("file", blob, filename || `clip.${ext}`);
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Transcription failed (${response.status})`);
  return (data.text ?? "").trim();
}
