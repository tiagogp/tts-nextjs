"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/Select";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { useOllamaModels } from "@/lib/cards/useOllamaModels";
import type { Card, PhraseCandidate } from "@/lib/cards/schema";

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

interface DiscoverResult {
  sourceId: string;
  title: string;
  segments: Segment[];
  /** False for text-only sources (article / PDF): no audio, no native clips. */
  hasAudio: boolean;
}

type SourceKind = "youtube" | "article" | "pdf";
type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const SOURCE_KINDS: { kind: SourceKind; label: string }[] = [
  { kind: "youtube", label: "YouTube" },
  { kind: "article", label: "Article / URL" },
  { kind: "pdf", label: "PDF" },
];

const ENGLISH_LEVELS: { value: EnglishLevel; label: string }[] = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
];

interface ProviderInfo {
  kind: string;
  label: string;
  available: boolean;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function waitForAudioEvent(
  audio: HTMLAudioElement,
  eventName: "loadedmetadata" | "seeked",
  timeoutMs = 4000,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeEventListener(eventName, finish);
      audio.removeEventListener("error", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    audio.addEventListener(eventName, finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

export default function DiscoverTab() {
  const [sourceKind, setSourceKind] = useState<SourceKind>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [focus, setFocus] = useState("");
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>("B2");
  const [loading, setLoading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curationNote, setCurationNote] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState<number | null>(null);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("local");
  const [ollamaModel, setOllamaModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState<string | null>(null);

  // Visual model picker: list the user's installed Ollama models when Ollama is available.
  const ollamaAvailable = providers.some((p) => p.kind === "ollama");
  const { models: ollamaModels } = useOllamaModels(ollamaAvailable);
  // Effective choice: the user's pick if still installed, else default to the first model.
  // Derived (not stored) so we never sync state in an effect.
  const selectedModel =
    ollamaModel && ollamaModels.includes(ollamaModel) ? ollamaModel : (ollamaModels[0] ?? "");
  const showModelPicker = provider === "ollama" && ollamaModels.length > 0;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRequestRef = useRef(0);

  // Load which generation providers are usable (local always; cloud needs an API key).
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/cards/providers")
      .then((r) => r.json())
      .then((data: { providers?: ProviderInfo[] }) => {
        if (cancelled || !data.providers) return;
        const available = data.providers.filter((p) => p.available);
        setProviders(available);
        // Prefer a cloud provider when configured (better cards), else local.
        const preferred =
          available.find((p) => p.kind !== "local") ?? available[0];
        if (preferred) setProvider(preferred.kind);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop clip playback at the segment boundary.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (stopAtRef.current != null && audio.currentTime >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
        setPlaying(null);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [result]);

  const playClip = useCallback(
    async (index: number, seg: Segment) => {
      const audio = audioRef.current;
      if (!audio) return;
      const requestId = playRequestRef.current + 1;
      playRequestRef.current = requestId;

      if (playing === index) {
        audio.pause();
        stopAtRef.current = null;
        setPlaying(null);
        return;
      }

      const start = Math.max(0, seg.startMs / 1000);
      const end = Math.max(start + 0.25, seg.endMs / 1000);

      audio.pause();
      stopAtRef.current = null;
      setPlaying(null);

      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        audio.load();
        await waitForAudioEvent(audio, "loadedmetadata");
        if (playRequestRef.current !== requestId) return;
      }

      audio.currentTime = start;
      if (audio.seeking) {
        await waitForAudioEvent(audio, "seeked");
        if (playRequestRef.current !== requestId) return;
      }

      stopAtRef.current = end;
      try {
        await audio.play();
        if (playRequestRef.current === requestId) setPlaying(index);
      } catch {
        if (playRequestRef.current === requestId) {
          stopAtRef.current = null;
          setPlaying(null);
        }
      }
    },
    [playing],
  );

  const canRun = sourceKind === "pdf" ? file !== null : url.trim().length > 0;

  const extract = useCallback(async () => {
    if (sourceKind === "pdf" ? !file : !url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setKept(new Set());
    setPlaying(null);
    setCurationNote(null);
    setGenError(null);
    setGenDone(null);

    // Only the YouTube path may download the one-time Whisper model.
    if (sourceKind === "youtube") {
      const poll = async () => {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          if (data.downloading_whisper) setDownloadingModel(true);
        } catch {}
      };
      pollRef.current = setInterval(poll, 2000);
    }

    try {
      let res: Response;
      if (sourceKind === "pdf") {
        const form = new FormData();
        form.append("file", file as File);
        res = await fetch("/api/discover/pdf", { method: "POST", body: form });
      } else {
        const endpoint =
          sourceKind === "article" ? "/api/discover/article" : "/api/discover";
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
      }
      const data = (await res.json()) as DiscoverResult & { error?: string };
      if (!res.ok)
        throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);

      setCurating(true);
      try {
        const mineRes = await fetch("/api/cards/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            ollamaModel: selectedModel || undefined,
            sourceKind,
            sourceId: data.sourceId,
            title: data.title,
            url: url.trim() || undefined,
            segments: data.segments,
            focus: focus.trim() || undefined,
            targetLevel,
          }),
        });
        const mined = (await mineRes.json().catch(() => ({}))) as {
          selectedIndexes?: number[];
          count?: number;
          error?: string;
        };
        if (!mineRes.ok) throw new Error(mined.error ?? "Curation failed.");
        const selected = (mined.selectedIndexes ?? []).filter(
          (i) => Number.isInteger(i) && i >= 0 && i < data.segments.length,
        );
        setKept(new Set(selected));
        const count = mined.count ?? selected.length;
        setCurationNote(
          count > 0
            ? `${count} segment${count === 1 ? "" : "s"} preselected for ${targetLevel}.`
            : `No segments preselected for ${targetLevel}.`,
        );
      } catch (mineErr: unknown) {
        setCurationNote(
          mineErr instanceof Error
            ? `Curation skipped: ${mineErr.message}`
            : "Curation skipped.",
        );
      } finally {
        setCurating(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setCurating(false);
      setDownloadingModel(false);
    }
  }, [sourceKind, url, file, provider, selectedModel, focus, targetLevel]);

  const toggleKeep = (index: number) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setGenDone(null);
  };

  const generateCards = useCallback(async () => {
    if (!result || kept.size === 0) return;
    setGenerating(true);
    setGenError(null);
    setGenDone(null);

    // Accepted phrases → PhraseCandidates (the source of truth we persist, D1).
    // Timestamps drive the native clip, so they only travel for audio sources;
    // text sources (article / PDF) fall back to TTS.
    const now = Date.now();
    const candidates: PhraseCandidate[] = [...kept].map((i) => {
      const seg = result.segments[i];
      return {
        id: `${result.sourceId}-${i}`,
        sourceId: result.sourceId,
        text: seg.text,
        status: "accepted",
        startMs: result.hasAudio ? seg.startMs : undefined,
        endMs: result.hasAudio ? seg.endMs : undefined,
        createdAt: now,
      };
    });

    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ollamaModel: selectedModel || undefined,
          sourceId: result.sourceId,
          deck: result.title || "English - Discover",
          // Ask for JSON (cards + base64 .apkg) so we can persist the deck locally.
          persist: true,
          candidates,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        cards?: Card[];
        count?: number;
        filename?: string;
        apkg?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error ?? `Request failed (${res.status})`);

      // Persist sources + generated cards locally so they're ready for the Study tab.
      let savedNote = "";
      if (isStoreAvailable() && data.cards) {
        try {
          await saveGeneratedDeck(data.cards, candidates);
          savedNote = " · saved for study";
        } catch {
          savedNote = " · couldn't save locally";
        }
      }

      // Trigger the .apkg download from the base64 payload.
      if (data.apkg) {
        const bytes = Uint8Array.from(atob(data.apkg), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `${result.title || "deck"}.apkg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      const count = data.count ?? data.cards?.length ?? 0;
      setGenDone(
        `${count} card${count === 1 ? "" : "s"} exported — check your downloads${savedNote}.`,
      );
    } catch (err: unknown) {
      setGenError(
        err instanceof Error ? err.message : "Failed to generate cards.",
      );
    } finally {
      setGenerating(false);
    }
  }, [result, kept, provider, selectedModel]);

  return (
    <div className="space-y-5">
      {/* Input card */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{
          backgroundColor: "var(--surface-card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Source type */}
        <div className="flex gap-1.5">
          {SOURCE_KINDS.map(({ kind, label }) => {
            const active = sourceKind === kind;
            return (
              <button
                key={kind}
                onClick={() => {
                  setSourceKind(kind);
                  setError(null);
                  setResult(null);
                  setCurationNote(null);
                }}
                disabled={loading}
                className="text-xs font-medium px-3 py-1.5 transition-colors"
                style={{
                  borderRadius: "4px",
                  border: `1px solid ${active ? "#ff5600" : "var(--border)"}`,
                  color: active ? "#ff5600" : "var(--text-muted)",
                  backgroundColor: "transparent",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {sourceKind === "pdf" ? (
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              PDF file
            </label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-medium file:cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              {sourceKind === "article" ? "Article URL" : "YouTube URL"}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                sourceKind === "article"
                  ? "https://example.com/some-article"
                  : "https://www.youtube.com/watch?v=…"
              }
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                caretColor: "#ff5600",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label
            className="block text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
          >
            Focus{" "}
            <span className="normal-case tracking-normal opacity-70">
              — optional, guides AI curation (next step)
            </span>
          </label>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. phrasal verbs, business vocabulary…"
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              caretColor: "#ff5600",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.length > 1 && (
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                AI provider
              </label>
              <Select
                value={provider}
                onChange={setProvider}
                options={providers.map((p) => ({
                  value: p.kind,
                  label: p.label,
                }))}
                disabled={loading}
              />
            </div>
          )}

          {showModelPicker && (
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                Ollama model
              </label>
              <Select
                value={selectedModel}
                onChange={setOllamaModel}
                options={ollamaModels.map((m) => ({ value: m, label: m }))}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              English level
            </label>
            <Select
              value={targetLevel}
              onChange={(value) => setTargetLevel(value as EnglishLevel)}
              options={ENGLISH_LEVELS}
              disabled={loading}
            />
          </div>
        </div>

        <button
          onClick={extract}
          disabled={loading || !canRun}
          className="w-full py-2.5 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2"
          style={{
            backgroundColor: loading || !canRun ? "var(--border)" : "#111111",
            color: loading || !canRun ? "var(--text-muted)" : "#ffffff",
            borderRadius: "4px",
            cursor: loading || !canRun ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
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
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              {curating
                ? "Curating…"
                : sourceKind === "youtube"
                  ? "Transcribing…"
                  : "Extracting…"}
            </>
          ) : sourceKind === "youtube" ? (
            "Transcribe audio"
          ) : (
            "Extract text"
          )}
        </button>

        {downloadingModel && (
          <div
            className="rounded px-3 py-2.5 text-xs flex items-center gap-2"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              borderRadius: "4px",
            }}
          >
            <svg
              className="w-3 h-3 animate-spin shrink-0"
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
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Downloading the speech-recognition model for the first time… this
            may take a minute.
          </div>
        )}

        {error && (
          <div
            className="rounded px-3 py-2.5 text-xs"
            style={{
              backgroundColor: "#fff1f0",
              border: "1px solid #ffccc7",
              color: "#c41c1c",
              borderRadius: "4px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Transcript / review */}
      {result && (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "1px solid var(--border)",
          }}
        >
          {result.hasAudio && (
            <audio
              key={result.sourceId}
              ref={audioRef}
              src={`/api/discover/audio/${result.sourceId}`}
              preload="metadata"
            />
          )}

          <div
            className="px-5 py-3 flex items-center justify-between gap-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {result.title}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {result.segments.length} segments · {kept.size} kept
                {curationNote ? ` · ${curationNote}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {providers.length > 1 && (
                <div className="w-44">
                  <Select
                    value={provider}
                    onChange={setProvider}
                    options={providers.map((p) => ({
                      value: p.kind,
                      label: p.label,
                    }))}
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
                disabled={kept.size === 0 || generating}
                className="text-xs font-medium px-3 py-1.5 transition-all shrink-0 flex items-center gap-1.5"
                style={{
                  backgroundColor:
                    kept.size === 0 || generating ? "var(--border)" : "#ff5600",
                  color:
                    kept.size === 0 || generating
                      ? "var(--text-muted)"
                      : "#ffffff",
                  borderRadius: "4px",
                  cursor:
                    kept.size === 0 || generating ? "not-allowed" : "pointer",
                }}
              >
                {generating ? (
                  <>
                    <svg
                      className="w-3 h-3 animate-spin"
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
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
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
            {result.segments.map((seg, i) => {
              const isKept = kept.has(i);
              const isPlaying = playing === i;
              return (
                <li
                  key={i}
                  className="px-5 py-2.5 flex items-start gap-3 transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: isKept ? "var(--surface)" : "transparent",
                  }}
                >
                  {result.hasAudio && (
                    <button
                      onClick={() => playClip(i, seg)}
                      className="shrink-0 w-7 h-7 rounded flex items-center justify-center mt-0.5"
                      style={{
                        border: "1px solid var(--border)",
                        color: isPlaying ? "#ff5600" : "var(--text-muted)",
                      }}
                      aria-label={isPlaying ? "Pause clip" : "Play clip"}
                    >
                      {isPlaying ? (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6 4l10 6-10 6z" />
                        </svg>
                      )}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {seg.text}
                    </p>
                    {result.hasAudio && (
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatTime(seg.startMs)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleKeep(i)}
                    className="shrink-0 text-xs font-medium px-2.5 py-1 rounded transition-colors mt-0.5"
                    style={{
                      border: `1px solid ${isKept ? "#ff5600" : "var(--border)"}`,
                      color: isKept ? "#ff5600" : "var(--text-muted)",
                      backgroundColor: "transparent",
                    }}
                  >
                    {isKept ? "Kept" : "Keep"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
