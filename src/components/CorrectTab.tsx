"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/Select";
import { saveCorrectionDeck } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { useOllamaModels } from "@/lib/cards/useOllamaModels";
import type { Card, ErrorEvent, ErrorType } from "@/lib/cards/schema";

/**
 * E1/E2 — the correction ingestion surface. Turns mistakes into ErrorEvents, then runs
 * the same provider pipeline the Discover tab uses to make vetted cards, persist them,
 * and export an .apkg.
 *
 * Three ways in:
 *   • Avaliar (IA) — write or speak free text; the LLM finds the mistakes (E2).
 *   • Escrever — type one correction (original → corrected) by hand.
 *   • Colar JSON — import a correction tool's JSON output.
 */

type InputMode = "ai" | "manual" | "json";

const ERROR_TYPES: ErrorType[] = [
  "collocation",
  "preposition",
  "tense",
  "article",
  "word-order",
  "idiom",
  "vocabulary",
  "register",
  "other",
];
const ERROR_TYPE_SET = new Set<string>(ERROR_TYPES);
const AI_TOOLBAR_BUTTON_CLASS =
  "h-10 shrink-0 rounded px-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap";
const AI_PRIMARY_BUTTON_CLASS =
  "h-10 shrink-0 rounded px-4 text-sm font-medium transition-colors ml-auto whitespace-nowrap";

interface ProviderInfo {
  kind: string;
  label: string;
  available: boolean;
}

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

function newDraft(): {
  original: string;
  corrected: string;
  errorTypes: ErrorType[];
  rationale: string;
} {
  return { original: "", corrected: "", errorTypes: [], rationale: "" };
}

/** Best-effort parse of the correction tool's JSON output into ErrorEvents. */
function parseErrorsJson(raw: string): ErrorEvent[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const now = Date.now();
  const out: ErrorEvent[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const original = typeof o.original === "string" ? o.original.trim() : "";
    const corrected = typeof o.corrected === "string" ? o.corrected.trim() : "";
    if (!original || !corrected) continue;
    const types = Array.isArray(o.errorTypes)
      ? o.errorTypes.filter((t): t is ErrorType => typeof t === "string" && ERROR_TYPE_SET.has(t))
      : [];
    out.push({
      id: crypto.randomUUID(),
      original,
      corrected,
      errorTypes: types.length > 0 ? [...new Set(types)] : ["other"],
      sourceLang: typeof o.sourceLang === "string" ? o.sourceLang : "pt",
      targetLang: typeof o.targetLang === "string" ? o.targetLang : "en",
      rationale: typeof o.rationale === "string" && o.rationale.trim() ? o.rationale.trim() : undefined,
      createdAt: now,
    });
  }
  return out;
}

export default function CorrectTab() {
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [mode, setMode] = useState<InputMode>("ai");
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

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("ollama");
  const [ollamaModel, setOllamaModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState<string | null>(null);

  // The heuristic Local provider can't judge open text; any model-backed provider can.
  // This gates the AI-evaluate affordance.
  const hasEvaluator = providers.some((p) => p.kind !== "local");

  // Visual model picker: list the user's installed Ollama models when Ollama is in play.
  const ollamaAvailable = providers.some((p) => p.kind === "ollama");
  const { models: ollamaModels, note: ollamaNote } = useOllamaModels(ollamaAvailable);
  // Effective choice: the user's pick if still installed, else default to the first model.
  // Derived (not stored) so we never sync state in an effect.
  const selectedModel =
    ollamaModel && ollamaModels.includes(ollamaModel) ? ollamaModel : (ollamaModels[0] ?? "");
  const showModelPicker = provider === "ollama" && ollamaModels.length > 0;

  // Same provider discovery as the Discover tab: local always; cloud needs a key.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/cards/providers")
      .then((r) => r.json())
      .then((data: { providers?: ProviderInfo[] }) => {
        if (cancelled || !data.providers) return;
        const available = data.providers.filter((p) => p.available);
        setProviders(available);
        const preferred = available.find((p) => p.kind !== "local") ?? available[0];
        if (preferred) setProvider(preferred.kind);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (events.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setGenDone(null);

    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ollamaModel: selectedModel || undefined,
          deck: "English - Corrections",
          // JSON back (cards + base64 .apkg) so we can persist the deck locally.
          persist: true,
          errors: events,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        cards?: Card[];
        count?: number;
        filename?: string;
        apkg?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      // Persist the ErrorEvents (source of truth) + cards so the Study tab and
      // weakness analysis pick them up alongside the discovery path.
      let savedNote = "";
      if (isStoreAvailable() && data.cards) {
        try {
          await saveCorrectionDeck(data.cards, events);
          savedNote = " · saved for study";
        } catch {
          savedNote = " · couldn't save locally";
        }
      }

      if (data.apkg) {
        const bytes = Uint8Array.from(atob(data.apkg), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "English - Corrections.apkg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      const count = data.count ?? data.cards?.length ?? 0;
      setGenDone(
        `${count} card${count === 1 ? "" : "s"} exported — check your downloads${savedNote}.`,
      );
      setEvents([]);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Failed to generate cards.");
    } finally {
      setGenerating(false);
    }
  }, [events, provider, selectedModel]);

  // E2 — hand the text to the LLM and append the mistakes it finds.
  const evaluate = useCallback(async () => {
    const text = aiText.trim();
    if (!text || evaluating) return;
    setEvaluating(true);
    setAiNote(null);
    setGenDone(null);
    try {
      const res = await fetch("/api/cards/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ollamaModel: selectedModel || undefined,
          text,
          sourceLang: "pt",
          targetLang: "en",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        events?: ErrorEvent[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const found = data.events ?? [];
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
  }, [aiText, evaluating, provider, selectedModel]);

  // E2 (speech) — send a recorded clip to Whisper, then drop the text into the box so
  // the learner can review/edit before it's evaluated (human-in-the-loop, like Discover).
  const transcribeBlob = useCallback(async (blob: Blob, filename?: string) => {
    setTranscribing(true);
    setAiNote(null);
    try {
      // Uploaded files carry their real extension; recordings only carry a MIME type.
      const ext = filename?.includes(".")
        ? filename.split(".").pop()!.toLowerCase()
        : blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mp4")
            ? "mp4"
            : "webm";
      const fd = new FormData();
      fd.append("file", blob, filename || `clip.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status})`);
      const text = (data.text ?? "").trim();
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
    <div className="space-y-5">
      {/* Input card */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{ backgroundColor: "var(--surface-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Add a correction
          </p>
          <div className="flex items-center gap-1">
            {(
              [
                ["ai", "Avaliar (IA)"],
                ["manual", "Escrever"],
                ["json", "Colar JSON"],
              ] as [InputMode, string][]
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
                  className="text-xs font-medium px-2.5 py-1 rounded transition-colors"
                  style={{
                    border: `1px solid ${active ? "#ff5600" : "var(--border)"}`,
                    color: active ? "#ff5600" : "var(--text-muted)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "ai" ? (
          <div className="space-y-2">
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
                    Parar gravação
                  </>
                ) : transcribing ? (
                  <>
                    <SpinnerIcon />
                    Transcrevendo…
                  </>
                ) : (
                  <>
                    <MicrophoneIcon />
                    Gravar fala
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
                Enviar áudio
              </button>
              {providers.length > 1 && (
                <div className="w-40">
                  <Select
                    value={provider}
                    onChange={setProvider}
                    options={providers.map((p) => ({ value: p.kind, label: p.label }))}
                    disabled={evaluating}
                  />
                </div>
              )}
              {showModelPicker && (
                <div className="w-44">
                  <Select
                    value={selectedModel}
                    onChange={setOllamaModel}
                    options={ollamaModels.map((m) => ({ value: m, label: m }))}
                    disabled={evaluating}
                  />
                </div>
              )}
              <button
                onClick={evaluate}
                disabled={!aiText.trim() || evaluating || transcribing}
                className={AI_PRIMARY_BUTTON_CLASS}
                style={{
                  backgroundColor: aiText.trim() && !evaluating ? "#ff5600" : "var(--border)",
                  color: aiText.trim() && !evaluating ? "#ffffff" : "var(--text-muted)",
                  cursor: aiText.trim() && !evaluating ? "pointer" : "not-allowed",
                }}
              >
                {evaluating ? "Avaliando…" : "Avaliar com IA →"}
              </button>
            </div>
            {!hasEvaluator && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                A avaliação por IA precisa de um modelo: escolha Ollama, Claude ou GPT.
                O provedor Local (heurístico) não avalia texto livre.
              </p>
            )}
            {provider === "ollama" && ollamaModels.length === 0 && ollamaNote && (
              <p className="text-xs" style={{ color: "#c41c1c" }}>
                {ollamaNote}
              </p>
            )}
          </div>
        ) : mode === "json" ? (
          <div className="space-y-2">
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
          <div className="space-y-3">
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
      </div>

      {/* Collected corrections / generate */}
      {events.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--surface-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                Corrections to drill
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {events.length} correction{events.length === 1 ? "" : "s"} ready
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {providers.length > 1 && (
                <div className="w-44">
                  <Select
                    value={provider}
                    onChange={setProvider}
                    options={providers.map((p) => ({ value: p.kind, label: p.label }))}
                    disabled={generating}
                  />
                </div>
              )}
              {showModelPicker && (
                <div className="w-44">
                  <Select
                    value={selectedModel}
                    onChange={setOllamaModel}
                    options={ollamaModels.map((m) => ({ value: m, label: m }))}
                    disabled={generating}
                  />
                </div>
              )}
              <button
                onClick={generateCards}
                disabled={generating}
                className="text-xs font-medium px-3 py-1.5 transition-all shrink-0 flex items-center gap-1.5"
                style={{
                  backgroundColor: generating ? "var(--border)" : "#ff5600",
                  color: generating ? "var(--text-muted)" : "#ffffff",
                  borderRadius: "4px",
                  cursor: generating ? "not-allowed" : "pointer",
                }}
              >
                {generating ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  "Generate cards →"
                )}
              </button>
            </div>
          </div>

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
                className="px-5 py-3 flex items-start gap-3"
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
                  className="shrink-0 text-xs font-medium px-2.5 py-1 rounded transition-colors mt-0.5"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
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
