"use client";

import { useEffect, useState } from "react";

interface OllamaModels {
  /** Model tags installed on the running server (e.g. "llama3.1:latest"). */
  models: string[];
  /** A hint when the list is empty: not configured, server down, or nothing pulled. */
  note: string | null;
}

/**
 * Fetch the models installed on the user's Ollama server for a visual picker. Only runs
 * when `enabled` (i.e. Ollama is an available provider), so tabs that never touch Ollama
 * pay nothing. The endpoint always resolves 200, surfacing connection problems as `note`.
 */
export function useOllamaModels(enabled: boolean): OllamaModels {
  const [models, setModels] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to fetch until Ollama is a usable provider; initial state stays empty.
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/cards/ollama/models")
      .then((r) => r.json())
      .then((data: { models?: string[]; note?: string }) => {
        if (cancelled) return;
        setModels(data.models ?? []);
        setNote(data.note ?? null);
      })
      .catch(() => {
        if (!cancelled) setNote("Não foi possível listar os modelos do Ollama.");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { models, note };
}
