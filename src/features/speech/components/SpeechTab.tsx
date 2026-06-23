"use client";

import AnkiExporter from "@/features/speech/components/AnkiExporter";
import AudioPlayer from "@/components/ui/AudioPlayer";
import BatchGenerator from "@/features/speech/components/BatchGenerator";
import HistoryPanel from "@/features/speech/components/HistoryPanel";
import Disclosure from "@/components/ui/Disclosure";
import Select from "@/components/ui/Select";
import {
  KOKORO_VOICE_OPTIONS,
  toKokoroVoice,
} from "@/features/speech/context/TtsSettingsContext";
import {
  EXAMPLE_TEXT,
  MAX_CHARS,
  useSpeechGenerator,
} from "@/features/speech/hooks/useSpeechGenerator";

export default function SpeechTab() {
  const {
    audioUrl,
    clearHistory,
    downloadingModel,
    error,
    generate,
    history,
    loading,
    restoreEntry,
    setSpeed,
    setText,
    setVoice,
    speed,
    text,
    voice,
  } = useSpeechGenerator();

  const canGenerate = !loading && text.trim().length > 0;

  return (
    <div className="correct-tab-enter">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-2">
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
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
            <span
              className="absolute bottom-3 right-3 text-xs"
              style={{
                color:
                  text.length > MAX_CHARS * 0.9
                    ? "#ff5600"
                    : "var(--text-muted)",
              }}
            >
              {text.length} / {MAX_CHARS}
            </span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setText("")}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
              type="button"
            >
              Clear
            </button>
            <button
              onClick={() => setText(EXAMPLE_TEXT)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
              type="button"
            >
              Load example
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="app-panel p-5 space-y-5">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.8px",
                }}
              >
                Voice
              </label>
              <Select
                value={voice}
                onChange={(value) => setVoice(toKokoroVoice(value))}
                options={KOKORO_VOICE_OPTIONS}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.8px",
                  }}
                >
                  Speed
                </label>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: "#ff5600" }}
                >
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
              <div
                className="flex justify-between text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <span>0.5× Slow</span>
                <span>1× Normal</span>
                <span>2× Fast</span>
              </div>
            </div>

            <button
              onClick={generate}
              disabled={!canGenerate}
              className="primary-button w-full py-2.5 px-4 flex items-center justify-center gap-2"
              type="button"
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
                  Generating…
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" />
                  </svg>
                  Generate Audio
                </>
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
                Preparing voices for the first time… this may take a minute.
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

            {audioUrl && (
              <AudioPlayer
                key={audioUrl}
                audioUrl={audioUrl}
                voiceLabel={`Kokoro · ${voice}`}
              />
            )}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <Disclosure
          title="Recent audio"
          description="Replay or restore something you generated earlier."
          badge={
            <span className="text-xs tabular-nums text-(--text-muted)">
              {history.length}
            </span>
          }
          className="mt-6"
        >
          <HistoryPanel
            history={history}
            onRestore={restoreEntry}
            onClear={clearHistory}
            embedded
          />
        </Disclosure>
      )}

      <Disclosure
        title="More tools"
        description="Batch audio and legacy JSON-to-Anki export."
        className="mt-3"
      >
        <div className="space-y-3">
          <Disclosure
            title="Batch audio"
            description="Generate one audio file per line."
            nested
          >
            <BatchGenerator embedded />
          </Disclosure>
          <Disclosure
            title="Import JSON to Anki"
            description="Build an .apkg deck from an existing JSON file."
            nested
          >
            <AnkiExporter embedded />
          </Disclosure>
        </div>
      </Disclosure>
    </div>
  );
}
