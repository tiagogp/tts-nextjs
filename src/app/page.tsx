"use client";

import { useState, useCallback, useRef } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import HistoryPanel from "@/components/HistoryPanel";
import BatchGenerator from "@/components/BatchGenerator";
import AnkiExporter from "@/components/AnkiExporter";
import { HistoryEntry } from "@/types/history";
import Select from "@/components/Select";
import {
  KOKORO_VOICE_OPTIONS,
  TtsSettingsProvider,
  toKokoroVoice,
  useTtsSettings,
} from "@/components/TtsSettingsContext";

const EXAMPLE_TEXT = "I'm willing to work hard because the payoff will come later.";
const MAX_CHARS = 4096;

function HomeInner() {
  const { voice, setVoice } = useTtsSettings();
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [speed, setSpeed] = useState(1.25);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<{ timer: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dark, setDark] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const generate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setDownloadingModel(false);
    setError(null);

    // after 1.5s start polling to detect model download
    const timer = setTimeout(() => {
      const poll = async () => {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          if (data.downloading_model) setDownloadingModel(true);
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 2000);
      if (pollRef.current) pollRef.current.interval = interval;
    }, 1500);
    pollRef.current = { timer };

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed, voice }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);

      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          text,
          voice,
          speed,
          engine: "kokoro",
          audioUrl: url,
          createdAt: Date.now(),
        };
        const next = [entry, ...prev].slice(0, 10);
        // revoke URLs that fell off the end
        prev.slice(9).forEach((e) => URL.revokeObjectURL(e.audioUrl));
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (pollRef.current) {
        clearTimeout(pollRef.current.timer);
        clearInterval(pollRef.current.interval);
        pollRef.current = null;
      }
      setLoading(false);
      setDownloadingModel(false);
    }
  }, [text, speed]);

  const restoreEntry = (entry: HistoryEntry) => {
    setText(entry.text);
    setVoice(toKokoroVoice(entry.voice));
    setSpeed(entry.speed);
    setAudioUrl(entry.audioUrl);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface)" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--surface-card)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {/* Logo */}
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#ff5600" }}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
            </svg>
          </div>

          <div className="flex-1">
            <h1
              className="text-base font-medium leading-none"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.3px" }}
            >
              Text to Speech
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Convert text into natural speech · download the audio
            </p>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-raised, #f0ede8)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Toggle dark mode"
          >
            {dark ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Text input */}
          <div className="lg:col-span-3 space-y-2">
            <label
              className="block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Your text
            </label>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Type or paste English text here…"
                rows={12}
                className="w-full resize-none rounded-lg px-4 py-3 text-sm leading-relaxed transition-colors outline-none"
                style={{
                  backgroundColor: "var(--surface-card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  caretColor: "#ff5600",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <span
                className="absolute bottom-3 right-3 text-xs"
                style={{ color: text.length > MAX_CHARS * 0.9 ? "#ff5600" : "var(--text-muted)" }}
              >
                {text.length} / {MAX_CHARS}
              </span>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setText("")}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Clear
              </button>
              <button
                onClick={() => setText(EXAMPLE_TEXT)}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Load example
              </button>
            </div>
          </div>

          {/* Right: Controls card */}
          <div className="lg:col-span-2">
            <div
              className="rounded-lg p-5 space-y-5"
              style={{
                backgroundColor: "var(--surface-card)",
                border: "1px solid var(--border)",
              }}
            >

              {/* Voice (locked) */}
              <div className="space-y-1.5">
                <label
                  className="block text-xs font-medium uppercase tracking-widest"
                  style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
                >
                  Voice
                </label>
                <Select
                  value={voice}
                  onChange={(v) => setVoice(toKokoroVoice(v))}
                  options={KOKORO_VOICE_OPTIONS}
                  disabled={loading}
                />
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}>
                    Speed
                  </label>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#ff5600" }}>
                    {speed.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>0.5× Slow</span>
                  <span>1× Normal</span>
                  <span>2× Fast</span>
                </div>
              </div>

              {/* Generate */}
              <button
                onClick={generate}
                disabled={loading || !text.trim()}
                className="w-full py-2.5 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: loading || !text.trim() ? "var(--border)" : "#111111",
                  color: loading || !text.trim() ? "var(--text-muted)" : "#ffffff",
                  borderRadius: "4px",
                  cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!loading && text.trim()) e.currentTarget.style.backgroundColor = "#333333";
                }}
                onMouseLeave={(e) => {
                  if (!loading && text.trim()) e.currentTarget.style.backgroundColor = "#111111";
                }}
              >
                {loading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" />
                    </svg>
                    Generate Audio
                  </>
                )}
              </button>

              {/* Model download notice */}
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
                  <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Downloading model for the first time… this may take a minute.
                </div>
              )}

              {/* Error */}
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

              {/* Player */}
              {audioUrl && (
                <AudioPlayer
                  audioUrl={audioUrl}
                  voiceLabel={`Kokoro · ${voice}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <HistoryPanel
          history={history}
          onRestore={restoreEntry}
          onClear={() => {
            setHistory((prev) => {
              prev.forEach((e) => URL.revokeObjectURL(e.audioUrl));
              return [];
            });
          }}
        />

        {/* Batch */}
        <BatchGenerator />

        {/* Anki */}
        <AnkiExporter />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <TtsSettingsProvider>
      <HomeInner />
    </TtsSettingsProvider>
  );
}
