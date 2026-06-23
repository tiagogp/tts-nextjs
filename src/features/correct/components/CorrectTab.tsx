"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import { saveCorrectionDeck } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import ProviderBadge from "@/components/ui/ProviderBadge";
import Disclosure from "@/components/ui/Disclosure";
import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import { DECK_GENERATION_TIMEOUT_MS } from "@/features/cards/constants";
import { saveApkg } from "@/features/cards/downloadApkg";
import { ERROR_TYPES, newDraft, parseErrorsJson, type CorrectionInputMode } from "@/features/correct/model";
import { evaluateCorrectionText, generateCorrectionDeck, transcribeAudio } from "@/features/correct/api";

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

const AI_TOOLBAR_BUTTON_CLASS =
  "h-10 shrink-0 rounded px-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap";
const AI_PRIMARY_BUTTON_CLASS =
  "h-10 shrink-0 rounded px-4 text-sm font-medium transition-colors ml-auto whitespace-nowrap";
const GENERATION_TIMEOUT_MS = DECK_GENERATION_TIMEOUT_MS;

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
      />
    </svg>
  );
}

export default function CorrectTab() {
  const { settings } = useAiSettings();
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
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationTimedOutRef = useRef(false);

  const [providerOverride, setProviderOverride] = useState<ProviderKind | null>(null);
  const [ollamaModel, setOllamaModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState<string | null>(null);

  // The heuristic Local provider can't judge open text; any model-backed provider can.
  // This gates the AI-evaluate affordance.
  const providers = settings.providers;
  const requestedProvider = providerOverride ?? settings.defaultProvider;
  const fallbackEvaluator = providers.find(
    (item) => item.kind !== "local" && item.available,
  )?.kind;
  const provider =
    requestedProvider === "local" && providerOverride == null
      ? (fallbackEvaluator ?? requestedProvider)
      : requestedProvider;
  const activeProvider = providers.find((item) => item.kind === provider);
  const providerReady = activeProvider?.available === true;
  const hasEvaluator = provider !== "local" && providerReady;

  // Visual model picker: list the user's installed Ollama models when Ollama is in play.
  const ollamaModels = settings.ollama.models;
  // Effective choice: the user's pick if still installed, else default to the first model.
  // Derived (not stored) so we never sync state in an effect.
  const selectedModel =
    ollamaModel && ollamaModels.includes(ollamaModel)
      ? ollamaModel
      : settings.ollama.model || ollamaModels[0] || "";
  const showModelPicker = provider === "ollama" && ollamaModels.length > 0;

  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [generating]);

  useEffect(
    () => () => {
      generationAbortRef.current?.abort();
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
    if (events.length === 0 || !providerReady || generationAbortRef.current) return;
    const controller = new AbortController();
    const sourceEvents = [...events];
    generationAbortRef.current = controller;
    generationTimedOutRef.current = false;
    setGenerationSeconds(0);
    setGenerating(true);
    setGenError(null);
    setGenDone(null);

    const timeout = window.setTimeout(() => {
      generationTimedOutRef.current = true;
      controller.abort();
    }, GENERATION_TIMEOUT_MS);

    try {
      const data = await generateCorrectionDeck({
        provider,
        selectedModel,
        events: sourceEvents,
        signal: controller.signal,
      });

      // Persist the ErrorEvents (source of truth) + cards so the Study tab and
      // weakness analysis pick them up alongside the discovery path.
      let savedNote = "";
      if (isStoreAvailable() && data.cards) {
        try {
          await saveCorrectionDeck(data.cards, sourceEvents);
          savedNote = " · saved for study";
        } catch {
          savedNote = " · couldn't save locally";
        }
      }

      if (!data.apkg) throw new Error("Cards were generated, but the Anki package was missing.");
      const fileNote = await saveApkg(data.filename || "English - Corrections.apkg", data.apkg);

      const count = data.count ?? data.cards?.length ?? 0;
      setGenDone(
        `${count} card${count === 1 ? "" : "s"} exported — ${fileNote}${savedNote}.`,
      );
      setEvents([]);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setGenError(
          generationTimedOutRef.current
            ? "Generation took too long and was stopped. Try fewer corrections or another provider."
            : "Generation cancelled. Your corrections are still here.",
        );
      } else {
        setGenError(err instanceof Error ? err.message : "Failed to generate cards.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
      setGenerating(false);
    }
  }, [events, provider, providerReady, selectedModel]);

  const cancelGeneration = useCallback(() => {
    generationTimedOutRef.current = false;
    generationAbortRef.current?.abort();
  }, []);

  const generationStage =
    generationSeconds < 10
      ? "Creating focused cards…"
      : generationSeconds < 40
        ? "Reviewing card quality…"
        : generationSeconds < 90
          ? "Preparing audio and the Anki deck…"
          : "Still working — local models are slow with several corrections. Hang tight…";

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
  }, [aiText, evaluating, hasEvaluator, provider, selectedModel]);

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
      if (file.size > 25 * 1024 * 1024) {
        setAiNote("Áudio muito grande (máx. 25 MB).");
        return;
      }
      void transcribeBlob(file, file.name);
    },
    [transcribeBlob],
  );

  const fieldStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    caretColor: "#ff5600",
  } as const;
  const labelStyle = { color: "var(--text-muted)", letterSpacing: "0.8px" } as const;

  return (
    <div className="space-y-5 correct-tab-enter">
      {/* Input card */}
      <div
        className="app-panel p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="app-section-title">
            Add a correction
          </p>
          <div className="app-segmented">
            {(
              [
                ["ai", "Evaluate (AI)"],
                ["manual", "Write manually"],
              ] as [CorrectionInputMode, string][]
            ).map(([m, label]) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setImportNote(null);
                    setAiNote(null);
                  }}
                  data-active={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "ai" ? (
          <div className="space-y-2 correct-mode-enter" key="ai-mode">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Write — or record — a few sentences in English. The AI finds what a native would say differently."
              rows={6}
              disabled={evaluating}
              className="w-full resize-none rounded-lg px-4 py-3 text-sm leading-relaxed outline-none transition-colors"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {aiNote && (
              <p
                className="text-xs"
                style={{ color: aiNote.includes("🎉") ? "var(--text-secondary)" : "#c41c1c" }}
              >
                {aiNote}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={evaluating || transcribing}
                className={AI_TOOLBAR_BUTTON_CLASS}
                style={{
                  border: `1px solid ${recording ? "#c41c1c" : "var(--border)"}`,
                  backgroundColor: "var(--surface-input)",
                  color: recording ? "#c41c1c" : "var(--text-secondary)",
                  cursor: evaluating || transcribing ? "not-allowed" : "pointer",
                  opacity: evaluating || transcribing ? 0.6 : 1,
                }}
              >
                {recording ? (
                  <>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#c41c1c" }} />
                    Stop recording
                  </>
                ) : transcribing ? (
                  <>
                    <SpinnerIcon />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <MicrophoneIcon />
                    Record speech
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={recording || evaluating || transcribing}
                className={AI_TOOLBAR_BUTTON_CLASS}
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-input)",
                  color: "var(--text-secondary)",
                  cursor: recording || evaluating || transcribing ? "not-allowed" : "pointer",
                  opacity: recording || evaluating || transcribing ? 0.6 : 1,
                }}
              >
                <UploadIcon />
                Upload audio
              </button>
              <button
                onClick={evaluate}
                disabled={!aiText.trim() || evaluating || transcribing || !hasEvaluator}
                className={`${AI_PRIMARY_BUTTON_CLASS} primary-button`}
                style={{
                  cursor: aiText.trim() && !evaluating && hasEvaluator ? "pointer" : "not-allowed",
                }}
              >
                {evaluating ? "Evaluating…" : "Evaluate with AI →"}
              </button>
            </div>
            {!hasEvaluator && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {provider === "local"
                  ? "The Local heuristic cannot evaluate free-form text. Choose Ollama, Claude, or OpenAI."
                  : `${activeProvider?.label ?? "This provider"} is unavailable. Open Settings with the gear button to connect it.`}
              </p>
            )}
            {provider === "ollama" && ollamaModels.length === 0 && (
              <p className="text-xs" style={{ color: "#c41c1c" }}>
                Ollama is offline or has no installed models. Open Settings to check the connection.
              </p>
            )}
          </div>
        ) : mode === "json" ? (
          <div className="space-y-2 correct-mode-enter" key="json-mode">
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={`Paste the correction tool's output, e.g.\n[{ "original": "I have 25 years", "corrected": "I'm 25 years old", "errorTypes": ["collocation"], "rationale": "age uses 'be', not 'have'" }]`}
              rows={7}
              className="w-full resize-none rounded-lg px-4 py-3 text-sm font-mono leading-relaxed outline-none transition-colors"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {importNote && (
              <p className="text-xs" style={{ color: "#c41c1c" }}>
                {importNote}
              </p>
            )}
            <button
              onClick={importJson}
              disabled={!json.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: json.trim() ? "#ff5600" : "var(--text-muted)",
                cursor: json.trim() ? "pointer" : "not-allowed",
              }}
            >
              Import corrections
            </button>
          </div>
        ) : (
          <div className="space-y-3 correct-mode-enter" key="manual-mode">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-widest" style={labelStyle}>
                  What you said
                </label>
                <textarea
                  value={draft.original}
                  onChange={(e) => setDraft((d) => ({ ...d, original: e.target.value }))}
                  placeholder="I have 25 years"
                  rows={2}
                  className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  style={fieldStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-widest" style={labelStyle}>
                  Native-correct version
                </label>
                <textarea
                  value={draft.corrected}
                  onChange={(e) => setDraft((d) => ({ ...d, corrected: e.target.value }))}
                  placeholder="I'm 25 years old"
                  rows={2}
                  className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  style={fieldStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-widest" style={labelStyle}>
                Error type <span className="normal-case tracking-normal opacity-70">— optional</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ERROR_TYPES.map((t) => {
                  const active = draft.errorTypes.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className="text-xs font-medium px-2.5 py-1 transition-colors"
                      style={{
                        borderRadius: "4px",
                        border: `1px solid ${active ? "#ff5600" : "var(--border)"}`,
                        color: active ? "#ff5600" : "var(--text-muted)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-widest" style={labelStyle}>
                Why it was wrong <span className="normal-case tracking-normal opacity-70">— optional</span>
              </label>
              <input
                type="text"
                value={draft.rationale}
                onChange={(e) => setDraft((d) => ({ ...d, rationale: e.target.value }))}
                placeholder="age uses 'be', not 'have'"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={fieldStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            <button
              onClick={addDraft}
              disabled={!draft.original.trim() || !draft.corrected.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: draft.original.trim() && draft.corrected.trim() ? "#ff5600" : "var(--text-muted)",
                cursor: draft.original.trim() && draft.corrected.trim() ? "pointer" : "not-allowed",
              }}
            >
              + Add to list
            </button>
          </div>
        )}

        <Disclosure
          title="Advanced options"
          description="Import correction JSON or temporarily change the AI provider."
          badge={activeProvider ? <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} /> : undefined}
          nested
        >
          <div className="space-y-4">
            <button
              type="button"
              className="secondary-button"
              data-active={mode === "json"}
              onClick={() => {
                setMode("json");
                setImportNote(null);
                setAiNote(null);
              }}
            >
              {mode === "json" ? "JSON import selected" : "Paste correction JSON"}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providers.length > 1 && (
                <div className="space-y-1.5">
                  <label className="field-label">AI provider</label>
                  <Select
                    value={provider}
                    onChange={(value) => setProviderOverride(value as ProviderKind)}
                    options={providers.map((p) => ({
                      value: p.kind,
                      label: `${p.label}${p.available ? "" : " — unavailable"}`,
                    }))}
                    disabled={evaluating || generating}
                  />
                </div>
              )}
              {showModelPicker && (
                <div className="space-y-1.5">
                  <label className="field-label">Ollama model</label>
                  <Select
                    value={selectedModel}
                    onChange={setOllamaModel}
                    options={ollamaModels.map((m) => ({ value: m, label: m }))}
                    disabled={evaluating || generating}
                  />
                </div>
              )}
            </div>
          </div>
        </Disclosure>
      </div>

      {/* Collected corrections / generate */}
      {events.length > 0 && (
        <div className="app-panel overflow-hidden correct-list-enter">
          <div className="sticky top-0 z-10 px-5 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-card)" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                Corrections to drill
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {events.length} correction{events.length === 1 ? "" : "s"} ready
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                onClick={generating ? cancelGeneration : generateCards}
                disabled={!generating && !providerReady}
                className="text-xs font-medium px-3 py-1.5 transition-all shrink-0 flex items-center gap-1.5 correct-action-button"
                style={{
                  backgroundColor: !generating && !providerReady ? "var(--border)" : generating ? "var(--surface-input)" : "#ff5600",
                  color: !generating && !providerReady ? "var(--text-muted)" : generating ? "#c41c1c" : "#ffffff",
                  border: generating ? "1px solid #c41c1c" : "1px solid transparent",
                  borderRadius: "4px",
                  cursor: !generating && !providerReady ? "not-allowed" : "pointer",
                }}
              >
                {generating ? (
                  <>
                    <span aria-hidden="true">×</span>
                    Cancel
                  </>
                ) : (
                  "Generate cards →"
                )}
              </button>
            </div>
          </div>

          {generating && (
            <div
              className="px-5 py-3 generation-status"
              style={{ borderBottom: "1px solid var(--border)" }}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: "var(--text-secondary)" }}>{generationStage}</span>
                <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {generationSeconds}s
                </span>
              </div>
              <div className="generation-track" aria-hidden="true">
                <span className="generation-bar" />
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Larger decks can take a little longer while audio is created. You can cancel safely.
              </p>
            </div>
          )}

          {(genError || genDone) && (
            <div
              className="px-5 py-2.5 text-xs"
              style={{
                borderBottom: "1px solid var(--border)",
                color: genError ? "#c41c1c" : "var(--text-secondary)",
                backgroundColor: genError ? "#fff1f0" : "var(--surface)",
              }}
            >
              {genError ?? genDone}
            </div>
          )}

          <ul className="max-h-[28rem] overflow-y-auto">
            {events.map((e) => (
              <li
                key={e.id}
                className="px-5 py-3 flex items-start gap-3 correction-row"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)", textDecoration: "line-through" }}>
                    {e.original}
                  </p>
                  <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--text-primary)" }}>
                    {e.corrected}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {e.errorTypes.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        {t}
                      </span>
                    ))}
                    {e.rationale && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {e.rationale}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeEvent(e.id)}
                  disabled={generating}
                  className="shrink-0 text-xs font-medium px-2.5 py-1 rounded transition-colors mt-0.5"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)", opacity: generating ? 0.5 : 1 }}
                  aria-label="Remove correction"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {events.length === 0 && genDone && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          {genDone}
        </div>
      )}
    </div>
  );
}
