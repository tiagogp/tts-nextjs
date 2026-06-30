"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Chip } from "@/components/ui/Chip";
import { Notice } from "@/components/ui/Notice";
import type { PhraseCandidate } from "@/lib/cards/schema";
import type { Card as GeneratedCard } from "@/lib/cards/schema";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { DeckPreview } from "@/features/cards/components/DeckPreview";
import type { DeckPayload } from "@/features/cards/exportDeck";

interface ThemeResponse {
  sourceId: string;
  title: string;
  candidates: PhraseCandidate[];
  error?: string;
}

interface GenerateResponse extends DeckPayload {
  error?: string;
  cards?: GeneratedCard[];
}

export default function ThemePhraseGenerator({ embedded = false }: { embedded?: boolean }) {
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, selectedModel, providerReady } = selection;
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThemeResponse | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [deckPreview, setDeckPreview] = useState<{
    data: DeckPayload;
    candidates: PhraseCandidate[];
  } | null>(null);

  const keptCandidates = useMemo(
    () => (result?.candidates ?? []).filter((candidate) => kept.has(candidate.id)),
    [kept, result?.candidates],
  );

  const generatePhrases = async () => {
    if (!theme.trim() || !providerReady) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDeckPreview(null);
    try {
      const { nativeLang, targetLang, level } = getLearnerLangs();
      const response = await fetch("/api/cards/generate-from-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          count,
          provider,
          ollamaModel: selectedModel || undefined,
          sourceLang: nativeLang,
          targetLang,
          level,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ThemeResponse;
      if (!response.ok) throw new Error(data.error ?? "Could not generate phrases.");
      setResult(data);
      setKept(new Set(data.candidates.map((candidate) => candidate.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate phrases.");
    } finally {
      setLoading(false);
    }
  };

  const generateDeck = async () => {
    if (!result || keptCandidates.length === 0 || !providerReady) return;
    setGenerating(true);
    setError(null);
    setDeckPreview(null);
    try {
      const { nativeLang, targetLang, level } = getLearnerLangs();
      const response = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ollamaModel: selectedModel || undefined,
          sourceId: result.sourceId,
          deck: result.title,
          persist: true,
          sourceLang: nativeLang,
          targetLang,
          level,
          candidates: keptCandidates.map((candidate) => ({ ...candidate, status: "accepted" })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as GenerateResponse;
      if (!response.ok) throw new Error(data.error ?? "Could not generate cards.");
      setDeckPreview({ data, candidates: keptCandidates });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate cards.");
    } finally {
      setGenerating(false);
    }
  };

  const toggle = (id: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-4 rounded-lg border border-line bg-card p-5"}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
        <Field label="Theme" htmlFor="theme-phrase-input">
          <Input
            id="theme-phrase-input"
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="ordering at a restaurant"
            disabled={loading || generating}
          />
        </Field>
        <Field label="Phrases" htmlFor="theme-phrase-count">
          <Input
            id="theme-phrase-count"
            type="number"
            min={3}
            max={20}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            disabled={loading || generating}
          />
        </Field>
        <div className="flex items-end">
          <Button
            variant="primary"
            className="h-10"
            disabled={!theme.trim() || loading || generating || !providerReady}
            onClick={() => void generatePhrases()}
          >
            {loading ? <Spinner className="h-3.5 w-3.5" /> : "Generate"}
          </Button>
        </div>
      </div>

      <ProviderPicker selection={selection} disabled={loading || generating} />

      {error && <Notice tone="error">{error}</Notice>}

      {result && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">{result.title}</p>
            <Button
              variant="primary"
              size="sm"
              disabled={keptCandidates.length === 0 || generating}
              onClick={() => void generateDeck()}
            >
              {generating ? "Creating…" : `Make study list (${keptCandidates.length})`}
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {result.candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{candidate.text}</p>
                  {candidate.note && <p className="text-xs text-ink-muted">{candidate.note}</p>}
                </div>
                <Chip active={kept.has(candidate.id)} onClick={() => toggle(candidate.id)}>
                  {kept.has(candidate.id) ? "Saved" : "Save"}
                </Chip>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {deckPreview && (
        <DeckPreview
          title="Theme study list preview"
          data={deckPreview.data}
          defaultFilename={`${result?.title || "Theme study list"}.apkg`}
          persist={(cards) => saveGeneratedDeck(cards, deckPreview.candidates)}
          onDismiss={() => setDeckPreview(null)}
        />
      )}
    </div>
  );
}
