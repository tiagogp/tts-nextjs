"use client";

import { useState, useCallback, useEffect } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import HistoryPanel from "@/components/HistoryPanel";
import BatchGenerator from "@/components/BatchGenerator";
import { HistoryEntry } from "@/types/history";

const VOICES = [
  { value: "female-1", label: "Emma (Female)" },
  { value: "female-2", label: "Aria (Female)" },
  { value: "male-1",   label: "Marcus (Male)" },
  { value: "male-2",   label: "Liam (Male)" },
  { value: "neutral",  label: "Alex (Neutral)" },
];

const EXAMPLE_TEXT = "I'm willing to work hard because the payoff will come later.";
const MAX_CHARS = 4096;

export default function Home() {
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [voice, setVoice] = useState("female-1");
  const [speed, setSpeed] = useState(1.0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const voiceLabel = VOICES.find((v) => v.value === voice)?.label ?? voice;

  const generate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          text,
          voice,
          speed,
          audioUrl: url,
          createdAt: Date.now(),
        };
        return [entry, ...prev].slice(0, 10);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [text, voice, speed]);

  const restoreEntry = (entry: HistoryEntry) => {
    setText(entry.text);
    setVoice(entry.voice);
    setSpeed(entry.speed);
    setAudioUrl(entry.audioUrl);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">English Text to Speech</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Convert text into natural speech · download the audio</p>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your text</label>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Type or paste English text here…"
                rows={12}
                className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <span className={`absolute bottom-3 right-3 text-xs ${text.length > MAX_CHARS * 0.9 ? "text-orange-500" : "text-gray-400 dark:text-gray-500"}`}>
                {text.length} / {MAX_CHARS}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setText("")}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded"
              >
                Clear
              </button>
              <button
                onClick={() => setText(EXAMPLE_TEXT)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded"
              >
                Load example
              </button>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="lg:col-span-2 space-y-5">

            {/* Voice */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voice</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {VOICES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Speed</label>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>0.5x Slow</span>
                <span>1x Normal</span>
                <span>2x Fast</span>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={loading || !text.trim()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" />
                  </svg>
                  Generate Audio
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Player */}
            {audioUrl && (
              <AudioPlayer audioUrl={audioUrl} voiceLabel={voiceLabel} />
            )}
          </div>
        </div>

        {/* History */}
        <HistoryPanel
          history={history}
          onRestore={restoreEntry}
          onClear={() => setHistory([])}
        />

        {/* Batch */}
        <BatchGenerator />
      </main>
    </div>
  );
}
