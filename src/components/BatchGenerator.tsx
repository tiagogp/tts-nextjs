"use client";

import { useState, useRef } from "react";
import JSZip from "jszip";

const VOICES = [
  { value: "female-1", label: "Emma (Female)" },
  { value: "female-2", label: "Aria (Female)" },
  { value: "male-1",   label: "Marcus (Male)" },
  { value: "male-2",   label: "Liam (Male)" },
  { value: "neutral",  label: "Alex (Neutral)" },
];

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
    .slice(0, 80);
}

export default function BatchGenerator() {
  const [rawText, setRawText] = useState("");
  const [voice, setVoice] = useState("female-1");
  const [speed, setSpeed] = useState(1.0);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
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
        prev.map((it) => (it.id === item.id ? { ...it, status: "generating" } : it))
      );

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text, voice, speed }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
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
      let base = sanitizeFilename(item.text) || "audio";
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

  const statusIcon = (item: BatchItem) => {
    if (item.status === "generating")
      return (
        <span className="text-blue-500 text-xs flex items-center gap-1 shrink-0">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Generating…
        </span>
      );
    if (item.status === "done")
      return <span className="text-green-500 text-xs shrink-0">Done</span>;
    if (item.status === "error")
      return (
        <span className="text-red-500 text-xs shrink-0 max-w-32 truncate" title={item.error}>
          Error
        </span>
      );
    return <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">Pending</span>;
  };

  return (
    <div className="mt-8 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Batch Generation
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        One sentence per line · each audio file is named after its text · download all as ZIP
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Textarea */}
        <div className="lg:col-span-3">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"Hello world\nThis is a second sentence\nAnd a third one…"}
            rows={8}
            disabled={running}
            className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {lines.length} {lines.length === 1 ? "sentence" : "sentences"}
            </p>
            <button
              onClick={() => { setRawText(""); setItems([]); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voice</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={running}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Speed</label>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold">{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range" min={0.5} max={2.0} step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              disabled={running}
              className="w-full accent-blue-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>0.5x Slow</span>
              <span>1x Normal</span>
              <span>2x Fast</span>
            </div>
          </div>

          {running ? (
            <button
              onClick={stop}
              className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={!lines.length}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              Generate {lines.length > 0 ? `${lines.length} ` : ""}
              Audio{lines.length !== 1 ? "s" : ""}
            </button>
          )}

          {hasResults && !running && (
            <button
              onClick={downloadZip}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download ZIP ({doneCount} file{doneCount !== 1 ? "s" : ""})
            </button>
          )}
        </div>
      </div>

      {/* Progress list */}
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <span className="text-gray-400 dark:text-gray-500 text-xs w-5 text-right shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{item.text}</span>
              {statusIcon(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
