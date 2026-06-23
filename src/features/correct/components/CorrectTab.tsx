"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import ProviderBadge from "@/components/ui/ProviderBadge";
import Disclosure from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import { fadeRise } from "@/lib/motion";
import { saveCorrectionDeck } from "@/lib/store/repository";
import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import { DECK_GENERATION_TIMEOUT_MS } from "@/features/cards/constants";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { useDeckGeneration } from "@/features/cards/hooks/useDeckGeneration";
import { exportAndSaveDeck } from "@/features/cards/exportDeck";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { useKokoroModel } from "@/features/speech/hooks/useKokoroModel";
import { MAX_UPLOAD_BYTES, newDraft, parseErrorsJson, type CorrectionInputMode } from "@/features/correct/model";
import { DeckGenerationError, evaluateCorrectionText, generateCorrectionDeck, transcribeAudio } from "@/features/correct/api";
import { AiEvaluateForm } from "@/features/correct/components/AiEvaluateForm";
import { ManualEntryForm } from "@/features/correct/components/ManualEntryForm";
import { JsonImportForm } from "@/features/correct/components/JsonImportForm";
import { CorrectionList } from "@/features/correct/components/CorrectionList";

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

export default function CorrectTab() {
  // The deck export synthesizes audio locally, so it needs the Kokoro model on
  // disk. Surface its download state here too — not just in the Anki Export tab.
  const kokoro = useKokoroModel();
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [mode, setMode] = useState<CorrectionInputMode>("ai");
  const [draft, setDraft] = useState(newDraft());
  const [json, setJson] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);

  // E2 — AI-evaluate mode (typed or transcribed speech).
  const [aiText, setAiText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // The heuristic Local provider can't judge open text; any model-backed provider can —
  // `fallbackToEvaluator` makes the hook fall back to one and expose `hasEvaluator`, which
  // gates the AI-evaluate affordance.
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, providerReady, hasEvaluator, ollamaModels, selectedModel } = selection;

  const generation = useDeckGeneration({
    timeoutMs: DECK_GENERATION_TIMEOUT_MS,
    timeoutMessage:
      "Generation took too long and was stopped. Try fewer corrections or another provider.",
    cancelMessage: "Generation cancelled. Your corrections are still here.",
    stages: [
      { untilSeconds: 10, label: "Creating focused cards…" },
      { untilSeconds: 40, label: "Reviewing card quality…" },
      { untilSeconds: 90, label: "Preparing audio and the Anki deck…" },
      { untilSeconds: Infinity, label: "Still working — local models are slow with several corrections. Hang tight…" },
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

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

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
        createdAt: Date.now(),
      },
    ]);
    setDraft(newDraft());
    setGenDone(null);
  };

  const importJson = () => {
    setImportNote(null);
    try {
      const parsed = parseErrorsJson(json);
      if (parsed.length === 0) {
        setImportNote("No usable corrections found (need `original` + `corrected`).");
        return;
      }
      setEvents((prev) => [...prev, ...parsed]);
      setJson("");
      setImportNote(null);
      setGenDone(null);
    } catch {
      setImportNote("Couldn't parse that — expected JSON (an object or an array of them).");
    }
  };

  const removeEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setGenDone(null);
  };

  const generateCards = useCallback(async () => {
    if (events.length === 0 || !providerReady) return;
    const sourceEvents = [...events];
    const ok = await run(async (signal) => {
      const data = await generateCorrectionDeck({ provider, selectedModel, events: sourceEvents, signal });
      // Persist the ErrorEvents (source of truth) + cards so the Study tab and
      // weakness analysis pick them up alongside the discovery path.
      return exportAndSaveDeck(data, {
        defaultFilename: "English - Corrections.apkg",
        persist: (cards) => saveCorrectionDeck(cards, sourceEvents),
      });
    });
    if (ok) setEvents([]);
  }, [events, provider, providerReady, selectedModel, run]);

  // E2 — hand the text to the LLM and append the mistakes it finds.
  const evaluate = useCallback(async () => {
    const text = aiText.trim();
    if (!text || evaluating || !hasEvaluator) return;
    setEvaluating(true);
    setAiNote(null);
    setGenDone(null);
    try {
      const found = await evaluateCorrectionText({ provider, selectedModel, text });
      if (found.length === 0) {
        setAiNote("No mistakes found — that already reads natural. 🎉");
        return;
      }
      setEvents((prev) => [...prev, ...found]);
      setAiText("");
    } catch (err: unknown) {
      setAiNote(err instanceof Error ? err.message : "Couldn't evaluate the text.");
    } finally {
      setEvaluating(false);
    }
  }, [aiText, evaluating, hasEvaluator, provider, selectedModel, setGenDone]);

  // E2 (speech) — send a recorded clip to Whisper, then drop the text into the box so
  // the learner can review/edit before it's evaluated (human-in-the-loop, like Discover).
  const transcribeBlob = useCallback(async (blob: Blob, filename?: string) => {
    setTranscribing(true);
    setAiNote(null);
    try {
      const text = await transcribeAudio(blob, filename);
      if (!text) {
        setAiNote("Couldn't make out any speech in that clip.");
        return;
      }
      setAiText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err: unknown) {
      setAiNote(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setAiNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) void transcribeBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setAiNote("Couldn't access the microphone. Check the browser's permission.");
    }
  }, [transcribeBlob]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // E2 (speech) — same Whisper path, but from an existing audio file instead of the mic.
  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-picking the same file
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        setAiNote("Áudio muito grande (máx. 25 MB).");
        return;
      }
      void transcribeBlob(file, file.name);
    },
    [transcribeBlob],
  );

  const evaluatorHint = !hasEvaluator
    ? provider === "local"
      ? "The Local heuristic cannot evaluate free-form text. Choose Ollama, Claude, or OpenAI."
      : `${activeProvider?.label ?? "This provider"} is unavailable. Open Settings with the gear button to connect it.`
    : null;
  const ollamaOffline = provider === "ollama" && ollamaModels.length === 0;

  const switchMode = (next: CorrectionInputMode) => {
    setMode(next);
    setImportNote(null);
    setAiNote(null);
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Add a correction</p>
          <Segmented<CorrectionInputMode>
            label="Correction input mode"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "ai", label: "Evaluate (AI)" },
              { value: "manual", label: "Write manually" },
            ]}
          />
        </div>

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
          description="Import correction JSON or temporarily change the AI provider."
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
        />
      )}

      {events.length === 0 && genDone && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 text-xs text-ink-soft">{genDone}</div>
      )}
    </div>
  );
}
