"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTtsSettings } from "@/components/TtsSettingsContext";

type ExportStatus = "idle" | "exporting" | "done" | "error";

const EN_ENGINE = "kokoro" as const;

function decodeRFC5987Value(value: string): string {
  // Expect something like: UTF-8''percent-encoded
  const parts = value.split("''");
  if (parts.length === 2) {
    try {
      return decodeURIComponent(parts[1]);
    } catch {
      return parts[1];
    }
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const filenameStar = header.match(/filename\*\s*=\s*([^;]+)/i);
  if (filenameStar) {
    const raw = filenameStar[1].trim().replace(/^"(.*)"$/, "$1");
    return decodeRFC5987Value(raw);
  }
  const filename = header.match(/filename\s*=\s*([^;]+)/i);
  if (filename) {
    return filename[1].trim().replace(/^"(.*)"$/, "$1");
  }
  return null;
}

function safeDownloadFilename(raw: string): string {
  const normalized = raw.normalize("NFKD");
  const asciiOnly = normalized.replaceAll(/[^\x20-\x7E]/g, "_");
  const noBadChars = asciiOnly
    .replaceAll(/[\\/:*?"<>|]+/g, "_")
    .replaceAll(/["\\]/g, "_");
  const collapsed = noBadChars.replaceAll(/\s+/g, " ").trim();
  return collapsed || "anki-deck.apkg";
}

function isJsonFile(file: File | null): boolean {
  if (!file) return false;
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  return name.endsWith(".json") || type.includes("json");
}

export default function AnkiExporter() {
  const { voice } = useTtsSettings();
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [deckName, setDeckName] = useState("English - new method");
  const [enKokoroSpeed, setEnKokoroSpeed] = useState("1.15");
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const jsonTextId = useId();
  const deckNameId = useId();
  const kokoroSpeedId = useId();
  const jsonFileId = useId();

  const resetFeedback = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    // Allow re-selecting the same file (otherwise `onChange` may not fire).
    input.value = "";
    input.click();
  }, []);

  const pickFirstFile = useCallback(
    (files: FileList | null) => {
      const nextFile = files?.[0] ?? null;
      setFile(nextFile);
      if (nextFile) setJsonText("");
      if (nextFile && !isJsonFile(nextFile)) {
        setError("Please upload a .json file.");
        setStatus("error");
        return;
      }
      resetFeedback();
    },
    [resetFeedback],
  );

  const canExport =
    status !== "exporting" &&
    deckName.trim().length > 0 &&
    (file ? isJsonFile(file) : jsonText.trim().length > 0);

  const exportApkg = useCallback(async () => {
    if (!file && jsonText.trim().length === 0) return;
    setStatus("exporting");
    setError(null);

    try {
      const normalizedSpeed = enKokoroSpeed.trim().replace(",", ".");
      const speedValue = Number.parseFloat(normalizedSpeed);
      if (!Number.isFinite(speedValue) || speedValue <= 0) {
        throw new Error("Kokoro speed must be a positive number.");
      }

      const form = new FormData();
      if (file) {
        if (!isJsonFile(file)) {
          throw new Error("Please upload a .json file.");
        }
        form.append("file", file, file.name);
      } else {
        form.append("json", jsonText);
      }
      form.append("deck", deckName.trim());
      form.append("enEngine", EN_ENGINE);
      form.append("enKokoroVoice", voice);
      form.append("enKokoroSpeed", normalizedSpeed);

      const res = await fetch("/api/anki/apkg", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Error (${res.status})`,
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const serverFilename = filenameFromContentDisposition(
        res.headers.get("content-disposition"),
      );
      a.download = safeDownloadFilename(
        serverFilename || `${deckName.trim() || "anki-deck"}.apkg`,
      );
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Delay revocation so slower browsers can start the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);

      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }, [deckName, enKokoroSpeed, file, jsonText, voice]);

  return (
    <div className="mt-6 rounded-lg p-6 border bg-(--surface-card) border-(--border)">
      <h2
        className="text-sm font-medium uppercase tracking-widest mb-1 text-(--text-muted)"
      >
        Anki Export
      </h2>
      <p className="text-xs mb-5 text-(--text-muted)">
        Upload JSON (pt/en) or paste JSON · choose an English voice · generate
        audio locally · download a deck package (.apkg)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor={jsonTextId}
              className="block text-xs font-medium uppercase tracking-widest text-(--text-muted)"
            >
              JSON Text (optional)
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                setJsonText(nextValue);
                if (nextValue.trim().length > 0) setFile(null);
                resetFeedback();
              }}
              disabled={status === "exporting"}
              rows={5}
              placeholder='Example: [{"pt":"Oi","en":"Hi"}]'
              id={jsonTextId}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors resize-y bg-(--surface-input) text-(--text-primary) border border-(--border) focus:border-(--accent)"
            />
            <p className="text-xs text-(--text-muted)">
              If you paste JSON here, the file input is ignored.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor={deckNameId}
                className="block text-xs font-medium uppercase tracking-widest text-(--text-muted)"
              >
                Deck Name
              </label>
              <input
                value={deckName}
                onChange={(e) => {
                  setDeckName(e.currentTarget.value);
                  resetFeedback();
                }}
                disabled={status === "exporting"}
                id={deckNameId}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-(--surface-input) text-(--text-primary) border border-(--border) focus:border-(--accent)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest text-(--text-muted)"
              >
                English Voice
              </label>
              <div
                className="w-full rounded-lg px-3 py-2 text-sm bg-(--surface-input) text-(--text-primary) border border-(--border)"
              >
                {`Kokoro · ${voice}`}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={kokoroSpeedId}
                className="block text-xs font-medium uppercase tracking-widest text-(--text-muted)"
              >
                Kokoro Speed
              </label>
              <input
                value={enKokoroSpeed}
                onChange={(e) => {
                  setEnKokoroSpeed(e.currentTarget.value);
                  resetFeedback();
                }}
                disabled={status === "exporting"}
                inputMode="decimal"
                id={kokoroSpeedId}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-(--surface-input) text-(--text-primary) border border-(--border) focus:border-(--accent)"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor={jsonFileId}
              className="block text-xs font-medium uppercase tracking-widest text-(--text-muted)"
            >
              JSON File (optional)
            </label>
            <input
              ref={fileInputRef}
              id={jsonFileId}
              type="file"
              accept=".json,application/json"
              onChange={(e) => pickFirstFile(e.currentTarget.files)}
              className="hidden"
              disabled={status === "exporting"}
            />
            <button
              type="button"
              onClick={openFilePicker}
              onDragEnter={(e) => {
                e.preventDefault();
                if (status === "exporting") return;
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (status === "exporting") return;
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (status === "exporting") return;
                setIsDragging(false);
                pickFirstFile(e.dataTransfer.files);
              }}
              disabled={status === "exporting"}
              className={[
                "w-full rounded-lg p-3 text-sm outline-none transition-colors text-left disabled:opacity-50",
                "bg-(--surface-input) text-(--text-primary)",
                "border",
                isDragging
                  ? "border-(--accent)"
                  : "border-dashed border-(--border)",
                "focus-visible:outline-2 focus-visible:outline-(--accent)",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">
                    {file ? file.name : "Drag & drop a JSON file here"}
                  </div>
                  <div className="text-xs text-(--text-muted)">
                    {file ? `${Math.round(file.size / 1024)} KB` : "or click to select"}
                  </div>
                </div>
              </div>
            </button>
          </div>
          <button
            onClick={exportApkg}
            disabled={!canExport}
            className="w-full py-2.5 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 bg-(--accent) text-white"
          >
            {status === "exporting" ? (
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
                Exporting…
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M3 14a1 1 0 011-1h3a1 1 0 010 2H5v2h10v-2h-2a1 1 0 110-2h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
                  <path d="M7 10a1 1 0 011.707-.707L10 10.586V3a1 1 0 112 0v7.586l1.293-1.293A1 1 0 0114.707 10.707l-3 3a1 1 0 01-1.414 0l-3-3A1 1 0 017 10z" />
                </svg>
                Download .apkg
              </>
            )}
          </button>

          {status === "done" && (
            <p className="text-xs text-[#0bdf50]">
              Export finished. If the download didn’t start, try again.
            </p>
          )}

          {status === "error" && error && (
            <div
              className="rounded px-3 py-2.5 text-xs border bg-[#fff1f0] border-[#ffccc7] text-[#c41c1c]"
            >
              {error}
            </div>
          )}

          <p className="text-xs text-(--text-muted)">
            Tip: the first export may take a while because models need to
            download.
          </p>
        </div>
      </div>
    </div>
  );
}
