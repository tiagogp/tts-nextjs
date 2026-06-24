"use client";

import { useEffect, useState, useRef } from "react";
import JSZip from "jszip";
import { useTtsSettings } from "@/features/speech/context/TtsSettingsContext";
import { sanitizeFilename } from "@/lib/sanitizeFilename";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

type ItemStatus = "pending" | "generating" | "done" | "error";

interface BatchItem {
  id: string;
  text: string;
  status: ItemStatus;
  blob?: Blob;
  error?: string;
}

async function responseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  } else {
    const text = await response.text().catch(() => "");
    if (text.trim() && !text.trimStart().startsWith("<!DOCTYPE") && !text.trimStart().startsWith("<html")) {
      return text.trim().slice(0, 500);
    }
  }
  return `Error ${response.status}`;
}

export default function BatchGenerator({ embedded = false }: { embedded?: boolean }) {
  const { voice } = useTtsSettings();
  const [rawText, setRawText] = useState("");
  const [speed, setSpeed] = useState(1.25);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

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
        const controller = new AbortController();
        controllerRef.current = controller;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text, speed, voice }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(await responseError(res));
        }

        const blob = await res.blob();
        updateItem(item.id, { status: "done", blob });
      } catch (err) {
        const isAbort =
          abortRef.current ||
          (err instanceof Error && err.name === "AbortError");
        if (isAbort) {
          updateItem(item.id, { status: "pending" });
          break;
        }
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      } finally {
        controllerRef.current = null;
      }
    }

    setRunning(false);
  };

  const stop = () => {
    abortRef.current = true;
    controllerRef.current?.abort();
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const counts: Record<string, number> = {};

    for (const item of items) {
      if (!item.blob) continue;
      const base = sanitizeFilename(item.text);
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
        <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
          <Spinner className="h-3 w-3" />
          Generating…
        </span>
      );
    if (item.status === "done") return <span className="shrink-0 text-xs text-success">Done</span>;
    if (item.status === "error")
      return (
        <span className="max-w-32 shrink-0 truncate text-xs text-danger" title={item.error}>
          Error
        </span>
      );
    return <span className="shrink-0 text-xs text-ink-muted">Pending</span>;
  };

  return (
    <div className={cn(!embedded && "mt-6 rounded-lg border border-line bg-card p-6")}>
      {!embedded && (
        <>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.8px] text-ink-muted">Batch Generation</h2>
          <p className="mb-5 text-xs text-ink-muted">
            One sentence per line · each file named after its text · download all as ZIP
          </p>
        </>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Textarea */}
        <div className="lg:col-span-3">
          <Textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={"Hello world\nThis is a second sentence\nAnd a third one…"}
            rows={8}
            disabled={running}
            className="px-4 py-3 leading-relaxed"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              {lines.length} {lines.length === 1 ? "sentence" : "sentences"}
            </p>
            <button
              onClick={() => {
                setRawText("");
                setItems([]);
              }}
              className="cursor-pointer px-2 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 lg:col-span-2">
          {/* Voice (locked) */}
          <div className="space-y-1.5">
            <Label className="mb-0">Voice</Label>
            <div className="w-full rounded border border-line bg-input px-3 py-2 text-sm text-ink">
              {`Kokoro · ${voice}`}
            </div>
          </div>

          {/* Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Speed</Label>
              <span className="text-sm font-semibold tabular-nums text-accent">{speed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={speed}
              onChange={(event) => setSpeed(parseFloat(event.target.value))}
              disabled={running}
              className="w-full disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-ink-muted">
              <span>0.5×</span>
              <span>1×</span>
              <span>2×</span>
            </div>
          </div>

          {running ? (
            <Button variant="primary" size="lg" className="bg-danger py-2.5 enabled:hover:brightness-90" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button variant="solid" size="lg" className="py-2.5" onClick={generate} disabled={!lines.length}>
              Generate {lines.length > 0 ? `${lines.length} ` : ""}
              Audio{lines.length !== 1 ? "s" : ""}
            </Button>
          )}

          {hasResults && !running && (
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 py-2.5 enabled:hover:border-off-black enabled:hover:bg-off-black enabled:hover:text-white"
              onClick={downloadZip}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download ZIP ({doneCount} file{doneCount !== 1 ? "s" : ""})
            </Button>
          )}
        </div>
      </div>

      {/* Progress list */}
      {items.length > 0 && (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded bg-surface px-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-ink-muted">{index + 1}</span>
              <span className="flex-1 truncate text-sm text-ink-soft">{item.text}</span>
              {statusBadge(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
