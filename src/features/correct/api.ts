import type { AdvancedReview, Card, ErrorEvent } from "@/lib/cards/schema";
import type { ProviderKind, TaskAssessment } from "@/lib/cards/provider";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import { watchModelNotReady } from "@/features/speech/modelStore";
import { modelJudge, type JudgeStamp } from "@/lib/evaluation/judge";

export interface DeckGenerationResult {
  cards?: Card[];
  count?: number;
  filename?: string;
  apkg?: string;
  error?: string;
  code?: string;
  debugId?: string;
  debugLog?: string;
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
  const { nativeLang, targetLang, level } = getLearnerLangs();
  const response = await fetch("/api/cards/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      deck: "Corrections",
      persist: true,
      sourceLang: nativeLang,
      targetLang,
      level,
      errors: input.events,
    }),
    signal: input.signal,
  });
  const data = (await response.json().catch(() => ({}))) as DeckGenerationResult;
  if (!response.ok) {
    // The debug id stays in the console for support; the user sees only the copy.
    if (data.debugId) console.error("Deck generation failed. Debug:", data.debugId, data.debugLog);
    throw new DeckGenerationError(
      data.error ?? `Não consegui gerar os cards agora (erro ${response.status}).`,
      data.code,
    );
  }
  return data;
}

interface CorrectionResponse {
  events: ErrorEvent[];
  task?: TaskAssessment;
  /** Which model and rubric produced this verdict. Stamped onto whatever the caller saves. */
  judge?: JudgeStamp;
}

interface CorrectionInput {
  provider: ProviderKind;
  selectedModel?: string;
  text: string;
  /** Situational context to stamp on the mistakes found (e.g. "work", "travel"). */
  context?: string;
  /** CEFR level; B2+ gets target-language rationales. */
  level?: string;
  /** Optional lesson task, evaluated independently from language correctness. */
  task?: string;
}

async function requestCorrection(input: CorrectionInput): Promise<CorrectionResponse> {
  const { nativeLang, targetLang, level } = getLearnerLangs();
  const response = await fetch("/api/cards/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      text: input.text,
      sourceLang: nativeLang,
      targetLang,
      context: input.context || undefined,
      level: input.level || level || undefined,
      task: input.task || undefined,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    events?: ErrorEvent[];
    task?: TaskAssessment | null;
    judge?: JudgeStamp;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return {
    events: data.events ?? [],
    task: data.task ?? undefined,
    // Fall back to a provider-only stamp: knowing a model judged, without knowing which,
    // still separates this verdict from a deterministic one.
    judge: data.judge ?? modelJudge({ provider: input.provider, model: input.selectedModel }),
  };
}

/** Generic correction remains errors-only for free-text surfaces. */
export async function evaluateCorrectionText(input: CorrectionInput): Promise<ErrorEvent[]> {
  return (await requestCorrection(input)).events;
}

/** Guided lessons additionally need to know whether the learner answered the task itself. */
export async function evaluateGuidedLessonResponse(input: CorrectionInput & { task: string }): Promise<CorrectionResponse> {
  return requestCorrection(input);
}

export async function reviewAdvancedText(input: {
  provider: ProviderKind;
  selectedModel?: string;
  text: string;
  /** Situational context to stamp on mistakes/refinements found (e.g. "work", "travel"). */
  context?: string;
  /** CEFR level; B2+ gets target-language rationales. */
  level?: string;
}): Promise<AdvancedReview> {
  const { nativeLang, targetLang, level } = getLearnerLangs();
  const response = await fetch("/api/cards/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      text: input.text,
      sourceLang: nativeLang,
      targetLang,
      context: input.context || undefined,
      level: input.level || level || undefined,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<AdvancedReview> & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return {
    errors: data.errors ?? [],
    refinements: data.refinements ?? [],
    overall: data.overall,
  };
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
  const data = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    code?: string;
    model?: string;
    downloading?: boolean;
    progress?: number;
  };
  if (!response.ok) {
    let message = data.error ?? `Não consegui transcrever o áudio agora (erro ${response.status}).`;
    if (data.code === "model_not_ready") {
      // The runtime just started the download; put it on the app-wide bar so
      // the learner can watch it instead of only reading "try again later".
      watchModelNotReady(data.model);
      if (data.downloading && (data.progress ?? 0) > 0) {
        message += ` ${Math.round((data.progress ?? 0) * 100)}% baixado.`;
      }
    }
    throw new Error(message);
  }
  return (data.text ?? "").trim();
}
