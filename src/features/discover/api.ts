import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import type { ProviderKind } from "@/lib/cards/provider";
import type { DiscoverResult, DiscoverSourceKind, EnglishLevel } from "@/features/discover/types";

export async function extractDiscoverSource(input: {
  sourceKind: DiscoverSourceKind;
  url: string;
  file: File | null;
}): Promise<DiscoverResult> {
  let response: Response;
  if (input.sourceKind === "pdf") {
    const form = new FormData();
    form.append("file", input.file as File);
    response = await fetch("/api/discover/pdf", { method: "POST", body: form });
  } else {
    const endpoint = input.sourceKind === "article" ? "/api/discover/article" : "/api/discover";
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.url.trim() }),
    });
  }
  const data = (await response.json()) as DiscoverResult & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
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
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    selectedIndexes?: number[];
    count?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Curation failed.");
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
}): Promise<{ cards?: Card[]; count?: number; filename?: string; apkg?: string; error?: string }> {
  const response = await fetch("/api/cards/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      sourceId: input.result.sourceId,
      deck: input.result.title || "English - Discover",
      persist: true,
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
  };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}
