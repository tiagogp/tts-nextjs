"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import ProviderBadge from "@/components/ui/ProviderBadge";
import Disclosure from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import { fadeRise } from "@/lib/motion";
import { saveCorrectionDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import type { AdvancedReview, ErrorEvent, ErrorType } from "@/lib/cards/schema";
import { normalizeContext } from "@/lib/cards/context";
import { DECK_GENERATION_TIMEOUT_MS } from "@/features/cards/constants";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { useDeckGeneration } from "@/features/cards/hooks/useDeckGeneration";
import type { DeckPayload } from "@/features/cards/exportDeck";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { DeckPreview } from "@/features/cards/components/DeckPreview";
import { useKokoroModel } from "@/features/speech/hooks/useKokoroModel";
import { CORRECTION_INPUT_OPTIONS } from "@/features/correct/constants";
import type { CorrectionInputMode } from "@/features/correct/types";
import { newDraft, parseErrorsJson } from "@/features/correct/utils";
import { DeckGenerationError, generateCorrectionDeck, reviewAdvancedText } from "@/features/correct/api";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { AiEvaluateForm } from "@/features/correct/components/AiEvaluateForm";
import { ManualEntryForm } from "@/features/correct/components/ManualEntryForm";
import { JsonImportForm } from "@/features/correct/components/JsonImportForm";
import { CorrectionList } from "@/features/correct/components/CorrectionList";
import { NaturalnessReview } from "@/features/correct/components/NaturalnessReview";

/**
 * E1/E2 — the correction ingestion surface. Turns mistakes into ErrorEvents, then runs
 * the same provider pipeline the Discover tab uses to make vetted cards, persist them,
 * and export an .apkg.
 *
 * Three ways in:
 *   • Evaluate (AI) — write or speak free text; the LLM finds the mistakes (E2).
 *   • Write manually — type one correction (original → corrected) by hand.
 *   • Paste JSON — import a correction tool's JSON output.
 */

export default function CorrectTab({
  onOpenSettings,
  onStudyNow,
}: {
  onOpenSettings?: () => void;
  onStudyNow?: () => void;
}) {
  // The deck export synthesizes audio locally, so it needs the Kokoro model on
  // disk. Surface its download state here too — not just in the Anki Export tab.
  const kokoro = useKokoroModel();
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [deckPreview, setDeckPreview] = useState<{
    data: DeckPayload;
    events: ErrorEvent[];
  } | null>(null);
  const [advancedReview, setAdvancedReview] = useState<AdvancedReview | null>(null);
  const [mode, setMode] = useState<CorrectionInputMode>("ai");
  // Session-level situational context: one conversation/situation = one context. It stamps
  // every mistake captured below (manual, AI, or JSON) so weak spots group by situation.
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState(newDraft());
  const [json, setJson] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);

  // E2 — AI-evaluate mode (typed or transcribed speech).
  const [aiText, setAiText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const {
    fileInputRef,
    recording,
    transcribing,
    startRecording,
    stopRecording,
    onPickFile,
  } = useCorrectionAudio({ onNote: setAiNote, onText: setAiText });

  // The AI-evaluate affordance needs a configured, available provider; `fallbackToEvaluator`
  // makes the hook fall back to the first available one and expose `hasEvaluator`, which gates
  // the affordance.
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, providerReady, hasEvaluator, ollamaModels, selectedModel } = selection;

  const generation = useDeckGeneration({
    timeoutMs: DECK_GENERATION_TIMEOUT_MS,
    timeoutMessage:
      "Está demorando mais do que o esperado. Tente menos correções ou uma IA mais rápida.",
    cancelMessage: "Geração cancelada. Suas correções continuam aqui.",
    stages: [
      { untilSeconds: 10, label: "Criando frases focadas para praticar…" },
      { untilSeconds: 40, label: "Revisando a qualidade das frases…" },
      { untilSeconds: 90, label: "Preparando áudio e export para Anki…" },
      { untilSeconds: Infinity, label: "Ainda trabalhando — modelos locais demoram com várias correções…" },
    ],
    // The voice model wasn't ready: the server just kicked off the download, so start
    // tracking progress (the notice below shows the live bar).
    onError: (err) => {
      if (err instanceof DeckGenerationError && err.code === "model_not_ready") {
        void kokoro.refresh();
      }
    },
  });
  const {
    generating,
    genError,
    genDone,
    generationSeconds,
    generationStage,
    run,
    cancelGeneration,
    setGenDone,
  } = generation;

  const toggleType = (t: ErrorType) =>
    setDraft((d) => ({
      ...d,
      errorTypes: d.errorTypes.includes(t)
        ? d.errorTypes.filter((x) => x !== t)
        : [...d.errorTypes, t],
    }));

  const addDraft = () => {
    const original = draft.original.trim();
    const corrected = draft.corrected.trim();
    if (!original || !corrected) return;
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        original,
        corrected,
        errorTypes: draft.errorTypes.length > 0 ? draft.errorTypes : ["other"],
        sourceLang: "pt",
        targetLang: "en",
        rationale: draft.rationale.trim() || undefined,
        context: normalizeContext(context),
        createdAt: Date.now(),
      },
    ]);
    setDraft(newDraft());
    setAdvancedReview(null);
    setGenDone(null);
    setDeckPreview(null);
  };

  const importJson = () => {
    setImportNote(null);
    try {
      const parsed = parseErrorsJson(json);
      if (parsed.length === 0) {
        setImportNote("No usable corrections found (need `original` + `corrected`).");
        return;
      }
      // The session context fills in for any imported event that didn't carry its own.
      const sessionContext = normalizeContext(context);
      const stamped = sessionContext
        ? parsed.map((e) => (e.context ? e : { ...e, context: sessionContext }))
        : parsed;
      setEvents((prev) => [...prev, ...stamped]);
      setAdvancedReview(null);
      setJson("");
      setImportNote(null);
      setGenDone(null);
      setDeckPreview(null);
    } catch {
      setImportNote("Couldn't parse that — expected JSON (an object or an array of them).");
    }
  };

  const removeEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setGenDone(null);
    setDeckPreview(null);
  };

  const generateCards = useCallback(async () => {
    if (events.length === 0 || !providerReady) return;
    const sourceEvents = [...events];
    await run(async (signal) => {
      const data = await generateCorrectionDeck({ provider, selectedModel, events: sourceEvents, signal });
      setDeckPreview({ data, events: sourceEvents });
      const count = data.count ?? data.cards?.length ?? 0;
      return `${count} practice phrase${count === 1 ? "" : "s"} ready to save.`;
    });
  }, [events, provider, providerReady, selectedModel, run]);

  // E2 — hand the text to the LLM and append the mistakes it finds.
  const evaluate = useCallback(async () => {
    const text = aiText.trim();
    if (!text || evaluating || !hasEvaluator) return;
    setEvaluating(true);
    setAiNote(null);
    setAdvancedReview(null);
    setGenDone(null);
    try {
      const review = await reviewAdvancedText({ provider, selectedModel, text, context });
      setAdvancedReview(review);
      if (review.errors.length === 0 && review.refinements.length === 0) {
        setAiNote("No mistakes found — that already sounds natural. 🎉");
        return;
      }
      if (review.errors.length > 0) {
        setEvents((prev) => [...prev, ...review.errors]);
        setAiText("");
      }
      if (review.errors.length === 0 && review.refinements.length > 0) {
        setAiNote("No errors found — see the naturalness upgrades below.");
      }
      setDeckPreview(null);
    } catch (err: unknown) {
      setAiNote(err instanceof Error ? err.message : "Couldn't evaluate the text.");
    } finally {
      setEvaluating(false);
    }
  }, [aiText, context, evaluating, hasEvaluator, provider, selectedModel, setGenDone]);

  const evaluatorHint = !hasEvaluator
    ? `${activeProvider?.label ?? "IA"} is unavailable. Open Settings with the gear button to connect one.`
    : null;
  const ollamaOffline = provider === "ollama" && ollamaModels.length === 0;

  const switchMode = (next: CorrectionInputMode) => {
    setMode(next);
    setImportNote(null);
    setAiNote(null);
    setAdvancedReview(null);
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Turn mistakes into review</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Paste, speak, or enter what you produced. Save only the corrections worth reviewing.
            </p>
          </div>
          <Segmented<CorrectionInputMode>
            label="Correction input mode"
            value={mode}
            onChange={switchMode}
            options={CORRECTION_INPUT_OPTIONS}
          />
        </div>

        <Field
          label={
            <>
              Situation <span className="font-normal lowercase opacity-70">— optional</span>
            </>
          }
          hint="Tags every mistake below, so your weak spots group by situation — not just grammar."
        >
          <Input
            type="text"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="work, travel, ordering at a restaurant…"
          />
        </Field>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            variants={fadeRise}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {mode === "ai" ? (
              <AiEvaluateForm
                value={aiText}
                onChange={setAiText}
                evaluating={evaluating}
                transcribing={transcribing}
                recording={recording}
                note={aiNote}
                evaluatorHint={evaluatorHint}
                ollamaOffline={ollamaOffline}
                fileInputRef={fileInputRef}
                onToggleRecord={recording ? stopRecording : startRecording}
                onPickFile={onPickFile}
                onEvaluate={evaluate}
                onOpenSettings={onOpenSettings}
              />
            ) : mode === "json" ? (
              <JsonImportForm value={json} onChange={setJson} importNote={importNote} onImport={importJson} />
            ) : (
              <ManualEntryForm
                draft={draft}
                onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                onToggleType={toggleType}
                onAdd={addDraft}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <Disclosure
          title="Advanced options"
          description="Import correction JSON or temporarily change the IA."
          badge={activeProvider ? <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} /> : undefined}
          nested
        >
          <div className="space-y-4">
            <Button
              variant="secondary"
              className={cn(mode === "json" && "border-accent text-accent")}
              onClick={() => switchMode("json")}
            >
              {mode === "json" ? "JSON import selected" : "Paste correction JSON"}
            </Button>
            <ProviderPicker selection={selection} disabled={evaluating || generating} />
          </div>
        </Disclosure>
      </Card>

      {advancedReview && (
        <NaturalnessReview
          refinements={advancedReview.refinements}
          overall={advancedReview.overall}
        />
      )}

      {events.length > 0 && (
        <CorrectionList
          events={events}
          generating={generating}
          genError={genError}
          genDone={genDone}
          generationStage={generationStage}
          generationSeconds={generationSeconds}
          providerReady={providerReady}
          kokoro={kokoro}
          onGenerate={generateCards}
          onCancel={cancelGeneration}
          onRemove={removeEvent}
          onOpenSettings={onOpenSettings}
        />
      )}

      {deckPreview && (
        <DeckPreview
          title="Correction study list preview"
          data={deckPreview.data}
          defaultFilename="English - Corrections.apkg"
          persist={async (cards) => {
            await saveCorrectionDeck(cards, deckPreview.events);
            void emitActivity("correction_generated", { cardsCreated: cards.length, source: "ai" });
            void emitActivity("cards_created", { count: cards.length, source: "correct" });
          }}
          onStudyNow={onStudyNow}
          onDismiss={() => setDeckPreview(null)}
          onExported={() => setEvents([])}
        />
      )}

      {events.length === 0 && genDone && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 text-xs text-ink-soft">{genDone}</div>
      )}
    </div>
  );
}
