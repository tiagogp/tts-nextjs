import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import type { ProviderKind } from "@/lib/cards/provider";
import type { DiscoverResult, DiscoverSourceKind, EnglishLevel } from "@/features/discover/types";
import { getLearnerLangs } from "@/features/settings/learningProfile";

export async function extractDiscoverSource(input: {
  sourceKind: DiscoverSourceKind;
  url: string;
  file: File | null;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<DiscoverResult> {
  if (input.sourceKind === "pdf") {
    const form = new FormData();
    form.append("file", input.file as File);
    const response = await fetch("/api/discover/pdf", { method: "POST", body: form });
    const data = (await response.json()) as DiscoverResult & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
  }

  if (input.sourceKind === "article") {
    const response = await fetch("/api/discover/article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.url.trim() }),
    });
    const data = (await response.json()) as DiscoverResult & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
  }

  // YouTube — SSE stream with progress events
  const response = await fetch("/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: input.url.trim() }),
  });
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as {
        type: "progress" | "done" | "error";
        percent?: number;
        stage?: string;
        result?: DiscoverResult;
        message?: string;
      };
      if (event.type === "progress" && typeof event.percent === "number") {
        input.onProgress?.(event.percent, event.stage ?? "");
      } else if (event.type === "done" && event.result) {
        return event.result;
      } else if (event.type === "error") {
        throw new Error(event.message ?? "Couldn't process this source right now.");
      }
    }
  }

  throw new Error("Stream ended without a result.");
}

export async function curateDiscoverSegments(input: {
  provider: ProviderKind;
  selectedModel?: string;
  sourceKind: DiscoverSourceKind;
  result: DiscoverResult;
  url: string;
  focus: string;
  targetLevel: EnglishLevel;
}): Promise<{ selectedIndexes: number[]; count: number }> {
  const { nativeLang, targetLang } = getLearnerLangs();
  const response = await fetch("/api/cards/mine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      sourceKind: input.sourceKind,
      sourceId: input.result.sourceId,
      title: input.result.title,
      url: input.url.trim() || undefined,
      segments: input.result.segments,
      focus: input.focus.trim() || undefined,
      targetLevel: input.targetLevel,
      sourceLang: nativeLang,
      targetLang,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    selectedIndexes?: number[];
    count?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Auto-selection failed.");
  const selectedIndexes = (data.selectedIndexes ?? []).filter(
    (index) => Number.isInteger(index) && index >= 0 && index < input.result.segments.length,
  );
  return { selectedIndexes, count: data.count ?? selectedIndexes.length };
}

export async function generateDiscoverDeck(input: {
  provider: ProviderKind;
  selectedModel?: string;
  result: DiscoverResult;
  candidates: PhraseCandidate[];
  signal: AbortSignal;
}): Promise<{
  cards?: Card[];
  count?: number;
  filename?: string;
  apkg?: string;
  error?: string;
  debugId?: string;
  debugLog?: string;
}> {
  const { nativeLang, targetLang, level } = getLearnerLangs();
  const response = await fetch("/api/cards/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      sourceId: input.result.sourceId,
      deck: input.result.title || "Discover",
      persist: true,
      sourceLang: nativeLang,
      targetLang,
      level,
      candidates: input.candidates,
    }),
    signal: input.signal,
  });
  const data = (await response.json().catch(() => ({}))) as {
    cards?: Card[];
    count?: number;
    filename?: string;
    apkg?: string;
    error?: string;
    debugId?: string;
    debugLog?: string;
  };
  if (!response.ok) {
    const debug = data.debugId ? ` Debug: ${data.debugId}` : "";
    throw new Error(`${data.error ?? `Request failed (${response.status})`}${debug}`);
  }
  return data;
}
