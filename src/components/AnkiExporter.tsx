"use client";

import { useMemo, useRef, useState } from "react";
import { useTtsSettings } from "@/components/TtsSettingsContext";

type ExportStatus = "idle" | "exporting" | "done" | "error";

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

export default function AnkiExporter() {
  const { voice } = useTtsSettings();
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [deckName, setDeckName] = useState("English - new method");
  const enEngine: "kokoro" = "kokoro";
  const [enKokoroSpeed, setEnKokoroSpeed] = useState("1.15");
  const [enKokoroLang, setEnKokoroLang] = useState("");
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isJsonFile = (f: File | null) => {
    if (!f) return false;
    const name = (f.name ?? "").toLowerCase();
    const type = (f.type ?? "").toLowerCase();
    return name.endsWith(".json") || type.includes("json");
  };

  const pickFirstFile = (files: FileList | null) => {
    const f = files?.[0] ?? null;
    setFile(f);
    if (f) setJsonText("");
    setError(null);
    setStatus("idle");
  };

  const canExport = useMemo(() => {
    if (!deckName.trim()) return false;
    if (file) return isJsonFile(file);
    return jsonText.trim().length > 0;
  }, [file, jsonText, deckName]);

  const exportApkg = async () => {
    if (!file && jsonText.trim().length === 0) return;
    setStatus("exporting");
    setError(null);

    try {
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
      form.append("enEngine", enEngine);
      form.append("enKokoroVoice", voice);
      form.append("enKokoroSpeed", enKokoroSpeed);
      if (enKokoroLang.trim()) form.append("enKokoroLang", enKokoroLang.trim());

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
        Anki Export
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Upload JSON (pt/en) or paste JSON · choose an English voice · generate
        audio locally · download a deck package (.apkg)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              JSON Text (optional)
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                if (e.target.value.trim().length > 0) setFile(null);
                setError(null);
                setStatus("idle");
              }}
              disabled={status === "exporting"}
              rows={5}
              placeholder='Example: [{"pt":"Oi","en":"Hi"}]'
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--surface-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              If you paste JSON here, the file input is ignored.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                Deck Name
              </label>
              <input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                disabled={status === "exporting"}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
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
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                English Voice
              </label>
              <div
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--surface-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {`Kokoro · ${voice}`}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                Kokoro Speed
              </label>
              <input
                value={enKokoroSpeed}
                onChange={(e) => setEnKokoroSpeed(e.target.value)}
                disabled={status === "exporting"}
                inputMode="decimal"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--surface-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-1.5">
            <label
              className="block text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
            >
              JSON File (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => pickFirstFile(e.currentTarget.files)}
              className="hidden"
              disabled={status === "exporting"}
            />
            <div
              role="button"
              tabIndex={status === "exporting" ? -1 : 0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
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
              className="w-full rounded-lg p-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--surface-input)",
                color: "var(--text-primary)",
                border: isDragging
                  ? "1px solid #ff5600"
                  : "1px dashed var(--border)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">
                    {file ? file.name : "Drag & drop a JSON file here"}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {file
                      ? `${Math.round(file.size / 1024)} KB`
                      : "or click to select"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={status === "exporting"}
                  className="shrink-0 rounded px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "#ff5600",
                    color: "#fff",
                    borderRadius: "4px",
                  }}
                >
                  {file ? "Change" : "Select"}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={exportApkg}
            disabled={!canExport || status === "exporting"}
            className="w-full py-2.5 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "#ff5600",
              color: "#fff",
              borderRadius: "4px",
            }}
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
            <p className="text-xs" style={{ color: "#0bdf50" }}>
              Export finished. If the download didn’t start, try again.
            </p>
          )}

          {status === "error" && error && (
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

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Tip: the first export may take a while because models need to
            download.
          </p>
        </div>
      </div>
    </div>
  );
}
