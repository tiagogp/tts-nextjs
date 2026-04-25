"use client";

import { useState, useRef } from "react";
import JSZip from "jszip";
import Select from "@/components/Select";

const ENGINES = [
  { value: "vits",       label: "VITS" },
  { value: "kokoro",     label: "Kokoro" },
  { value: "chatterbox", label: "Chatterbox" },
];

const VOICES_BY_ENGINE: Record<string, { value: string; label: string }[]> = {
  vits: [
    { value: "female-1", label: "Emma (Female)" },
    { value: "female-2", label: "Aria (Female)" },
    { value: "male-1", label: "Marcus (Male)" },
    { value: "male-2", label: "Liam (Male)" },
    { value: "neutral", label: "Alex (Neutral)" },
  ],
  kokoro: [
    { value: "af_heart", label: "Heart (US Female)" },
    { value: "af_bella", label: "Bella (US Female)" },
    { value: "af_sarah", label: "Sarah (US Female)" },
    { value: "af_nicole", label: "Nicole (US Female)" },
    { value: "am_adam", label: "Adam (US Male)" },
    { value: "am_michael", label: "Michael (US Male)" },
    { value: "bf_emma", label: "Emma (UK Female)" },
    { value: "bm_george", label: "George (UK Male)" },
  ],
  chatterbox: [
    { value: "neutral",    label: "Neutral" },
    { value: "expressive", label: "Expressive" },
    { value: "dramatic",   label: "Dramatic" },
  ],
};

type ItemStatus = "pending" | "generating" | "done" | "error";

interface BatchItem {
  id: string;
  text: string;
  status: ItemStatus;
  blob?: Blob;
  error?: string;
}

function sanitizeFilename(text: string): string {
  return text
    .trim()
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .replace(/\.+$/, "");
}

export default function BatchGenerator() {
  const [rawText, setRawText] = useState("");
  const [engine, setEngine] = useState("kokoro");
  const [voice, setVoice] = useState("af_heart");
  const [speed, setSpeed] = useState(1.25);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const switchEngine = (eng: string) => {
    setEngine(eng);
    setVoice(VOICES_BY_ENGINE[eng][0].value);
  };

  const voices = VOICES_BY_ENGINE[engine];

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  };

  const generate = async () => {
    if (!lines.length) return;
    abortRef.current = false;
    setRunning(true);

    const initial: BatchItem[] = lines.map((text) => ({
      id: crypto.randomUUID(),
      text,
      status: "pending",
    }));
    setItems(initial);

    for (const item of initial) {
      if (abortRef.current) break;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "generating" } : it,
        ),
      );

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text, voice, speed, engine }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? `Error ${res.status}`,
          );
        }

        const blob = await res.blob();
        updateItem(item.id, { status: "done", blob });
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    setRunning(false);
  };

  const stop = () => {
    abortRef.current = true;
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const counts: Record<string, number> = {};

    for (const item of items) {
      if (!item.blob) continue;
      const base = sanitizeFilename(item.text) || "audio";
      const count = counts[base] ?? 0;
      counts[base] = count + 1;
      const filename = count === 0 ? `${base}.wav` : `${base} (${count}).wav`;
      zip.file(filename, item.blob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch_audio.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const hasResults = items.some((i) => i.status === "done");

  const statusBadge = (item: BatchItem) => {
    if (item.status === "generating")
      return (
        <span
          className="flex items-center gap-1 text-xs shrink-0"
          style={{ color: "#ff5600" }}
        >
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
        </span>
      );
    if (item.status === "done")
      return (
        <span className="text-xs shrink-0" style={{ color: "#0bdf50" }}>
          Done
        </span>
      );
    if (item.status === "error")
      return (
        <span
          className="text-xs shrink-0 max-w-32 truncate"
          title={item.error}
          style={{ color: "#c41c1c" }}
        >
          Error
        </span>
      );
    return (
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
        Pending
      </span>
    );
  };

  return (
    <div
      className="mt-6 rounded-lg p-6"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
      }}
    >
      <h2
        className="text-sm font-medium uppercase tracking-widest mb-1"
        style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
      >
        Batch Generation
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        One sentence per line · each file named after its text · download all as
        ZIP
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Textarea */}
        <div className="lg:col-span-3">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              "Hello world\nThis is a second sentence\nAnd a third one…"
            }
            rows={8}
            disabled={running}
            className="w-full resize-none rounded-lg focus:placeholder:text-(--text-muted) placeholder:text-(--text-muted)/50 px-4 py-3 text-sm leading-relaxed outline-none transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--surface-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {lines.length} {lines.length === 1 ? "sentence" : "sentences"}
            </p>
            <button
              onClick={() => {
                setRawText("");
                setItems([]);
              }}
              className="text-xs px-2 py-1 transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              Clear
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Engine */}
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              Engine
            </label>
            <div
              className="flex rounded overflow-hidden"
              style={{ border: "1px solid var(--border)", borderRadius: "4px" }}
            >
              {ENGINES.map((eng) => (
                <button
                  key={eng.value}
                  onClick={() => switchEngine(eng.value)}
                  disabled={running}
                  className="flex-1 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                  style={
                    engine === eng.value
                      ? { backgroundColor: "#111111", color: "#ffffff" }
                      : {
                          backgroundColor: "var(--surface-card)",
                          color: "var(--text-secondary)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (engine !== eng.value && !running)
                      e.currentTarget.style.backgroundColor = "var(--surface)";
                  }}
                  onMouseLeave={(e) => {
                    if (engine !== eng.value)
                      e.currentTarget.style.backgroundColor =
                        "var(--surface-card)";
                  }}
                >
                  {eng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              Voice
            </label>
            <Select
              value={voice}
              onChange={setVoice}
              options={voices}
              disabled={running}
            />
          </div>

          {/* Speed */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                className="text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
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
              disabled={running}
              className="w-full disabled:opacity-50"
            />
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <span>0.5×</span>
              <span>1×</span>
              <span>2×</span>
            </div>
          </div>

          {running ? (
            <button
              onClick={stop}
              className="w-full py-2.5 px-4 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "#c41c1c",
                color: "#ffffff",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#a01616")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#c41c1c")
              }
            >
              Stop
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={!lines.length}
              className="w-full py-2.5 px-4 text-sm font-medium transition-colors"
              style={{
                backgroundColor: lines.length ? "#111111" : "var(--border)",
                color: lines.length ? "#ffffff" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: lines.length ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (lines.length)
                  e.currentTarget.style.backgroundColor = "#333333";
              }}
              onMouseLeave={(e) => {
                if (lines.length)
                  e.currentTarget.style.backgroundColor = "#111111";
              }}
            >
              Generate {lines.length > 0 ? `${lines.length} ` : ""}
              Audio{lines.length !== 1 ? "s" : ""}
            </button>
          )}

          {hasResults && !running && (
            <button
              onClick={downloadZip}
              className="w-full py-2.5 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 border"
              style={{
                borderRadius: "4px",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                borderColor: "var(--border)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#111111";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download ZIP ({doneCount} file{doneCount !== 1 ? "s" : ""})
            </button>
          )}
        </div>
      </div>

      {/* Progress list */}
      {items.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 text-sm px-3 py-2 rounded"
              style={{ backgroundColor: "var(--surface)", borderRadius: "4px" }}
            >
              <span
                className="text-xs w-5 text-right shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {index + 1}
              </span>
              <span
                className="flex-1 truncate text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.text}
              </span>
              {statusBadge(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
