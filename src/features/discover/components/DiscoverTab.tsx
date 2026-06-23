"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Select from "@/components/ui/Select";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import ProviderBadge from "@/components/ui/ProviderBadge";
import Disclosure from "@/components/ui/Disclosure";
import type { PhraseCandidate } from "@/lib/cards/schema";
import { saveApkg } from "@/features/cards/downloadApkg";
import { ENGLISH_LEVELS, GENERATION_TIMEOUT_MS, SOURCE_KINDS } from "@/features/discover/constants";
import type { DiscoverResult, DiscoverSourceKind, EnglishLevel, TranscriptSegment } from "@/features/discover/types";
import { curateDiscoverSegments, extractDiscoverSource, generateDiscoverDeck } from "@/features/discover/api";

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
  const { settings, loading: settingsLoading } = useAiSettings();
  const [sourceKind, setSourceKind] = useState<DiscoverSourceKind>("youtube");
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

  const [providerOverride, setProviderOverride] = useState<ProviderKind | null>(null);
  const [ollamaModel, setOllamaModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState<string | null>(null);

  // Visual model picker: list the user's installed Ollama models when Ollama is available.
  const providers = settings.providers;
  const provider = providerOverride ?? settings.defaultProvider;
  const activeProvider = providers.find((item) => item.kind === provider);
  const providerReady = activeProvider?.available === true;
  const ollamaModels = settings.ollama.models;
  // Effective choice: the user's pick if still installed, else default to the first model.
  // Derived (not stored) so we never sync state in an effect.
  const selectedModel =
    ollamaModel && ollamaModels.includes(ollamaModel)
      ? ollamaModel
      : settings.ollama.model || ollamaModels[0] || "";
  const showModelPicker = provider === "ollama" && ollamaModels.length > 0;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRequestRef = useRef(0);
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationTimedOutRef = useRef(false);

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
      if (pollRef.current) window.clearInterval(pollRef.current);
      audioRef.current?.pause();
    },
    [],
  );

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
    async (index: number, seg: TranscriptSegment) => {
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

  const hasSource = sourceKind === "pdf" ? file !== null : url.trim().length > 0;
  const canRun = hasSource && providerReady;

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
      const data = await extractDiscoverSource({ sourceKind, url, file });
      setResult(data);

      setCurating(true);
      try {
        const { selectedIndexes: selected, count } = await curateDiscoverSegments({
          provider,
          selectedModel,
          sourceKind,
          result: data,
          url,
          focus,
          targetLevel,
        });
        setKept(new Set(selected));
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
    if (!result || kept.size === 0 || !providerReady || generationAbortRef.current) return;
    const controller = new AbortController();
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
      const data = await generateDiscoverDeck({
        provider,
        selectedModel,
        result,
        candidates,
        signal: controller.signal,
      });

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

      if (!data.apkg) throw new Error("Cards were generated, but the Anki package was missing.");
      const fileNote = await saveApkg(data.filename || `${result.title || "deck"}.apkg`, data.apkg);

      const count = data.count ?? data.cards?.length ?? 0;
      setGenDone(
        `${count} card${count === 1 ? "" : "s"} exported — ${fileNote}${savedNote}.`,
      );
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setGenError(
          generationTimedOutRef.current
            ? "Generation took too long and was stopped. Try fewer phrases or another provider."
            : "Generation cancelled. Your selected phrases are still here.",
        );
      } else {
        setGenError(
          err instanceof Error ? err.message : "Failed to generate cards.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
      setGenerating(false);
    }
  }, [result, kept, provider, providerReady, selectedModel]);

  const cancelGeneration = useCallback(() => {
    generationTimedOutRef.current = false;
    generationAbortRef.current?.abort();
  }, []);

  const generationStage =
    generationSeconds < 8
      ? "Creating focused cards…"
      : generationSeconds < 25
        ? "Reviewing card quality…"
        : generationSeconds < 90
          ? "Preparing audio and the Anki deck…"
          : "Still working — local models and audio clips can take a while…";

  return (
    <div className="space-y-5 correct-tab-enter">
      {/* Input card */}
      <div
        className="app-panel p-5 space-y-4"
        style={{
          backgroundColor: "var(--surface-card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Source type */}
        <div
          className="app-segmented discover-source-picker"
          role="radiogroup"
          aria-label="Source type"
          style={{ "--segment-index": SOURCE_KINDS.findIndex(({ kind }) => kind === sourceKind) } as CSSProperties}
        >
          <span className="discover-source-indicator" aria-hidden="true" />
          {SOURCE_KINDS.map(({ kind, label }) => {
            const active = sourceKind === kind;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={kind}
                onClick={() => {
                  if (result && !window.confirm("Discard the current Discover results?")) return;
                  setSourceKind(kind);
                  setError(null);
                  setResult(null);
                  setCurationNote(null);
                }}
                disabled={loading}
                data-active={active}
                style={{ cursor: loading ? "not-allowed" : "pointer" }}
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

        <div className="space-y-1.5 max-w-52">
          <label className="field-label">English level</label>
          <Select
            value={targetLevel}
            onChange={(value) => setTargetLevel(value as EnglishLevel)}
            options={ENGLISH_LEVELS}
            disabled={loading}
          />
        </div>

        <Disclosure
          title="Advanced options"
          description="Guide curation or temporarily use a different AI model."
          nested
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="field-label">Focus <span className="normal-case tracking-normal opacity-70">— optional</span></label>
              <input
                type="text"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. phrasal verbs, business vocabulary…"
                className="app-field"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ai-picker-grid">
          {providers.length > 1 && (
            <div className="ai-picker-field">
              <div className="ai-picker-label-row">
                <label className="field-label mb-0">AI provider</label>
                {activeProvider && <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} />}
              </div>
              <Select
                value={provider}
                onChange={(value) => setProviderOverride(value as ProviderKind)}
                options={providers.map((p) => ({
                  value: p.kind,
                  label: `${p.label}${p.available ? "" : " — unavailable"}`,
                }))}
                disabled={loading}
              />
            </div>
          )}

          {showModelPicker && (
            <div className="ai-picker-field">
              <div className="ai-picker-label-row">
                <label className="field-label mb-0">Ollama model</label>
              </div>
              <Select
                value={selectedModel}
                onChange={setOllamaModel}
                options={ollamaModels.map((m) => ({ value: m, label: m }))}
                disabled={loading}
              />
            </div>
          )}

            </div>
          </div>
        </Disclosure>

        {!providerReady && !settingsLoading && (
          <div className="app-notice" data-tone="error" role="status">
            {activeProvider?.label ?? "The selected AI provider"} is unavailable. Open Settings with the gear button to connect it, or choose Local heuristic.
          </div>
        )}

        <button
          onClick={extract}
          disabled={loading || !canRun}
          className="primary-button w-full min-h-10 flex items-center justify-center gap-2"
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
            Preparing audio discovery for the first time… this may take a
            minute.
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
          className="app-panel overflow-hidden"
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
            className="sticky top-0 z-10 px-5 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-card)" }}
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
              <button
                onClick={generating ? cancelGeneration : generateCards}
                disabled={!generating && (kept.size === 0 || !providerReady)}
                className="primary-button text-xs shrink-0 flex items-center gap-1.5"
                style={{
                  cursor:
                    !generating && (kept.size === 0 || !providerReady) ? "not-allowed" : "pointer",
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
