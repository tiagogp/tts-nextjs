"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTtsSettings } from "@/features/speech/context/TtsSettingsContext";
import { useKokoroModel } from "@/features/speech/hooks/useKokoroModel";
import KokoroModelNotice from "@/features/speech/components/KokoroModelNotice";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

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

export default function AnkiExporter({ embedded = false }: { embedded?: boolean }) {
  const { voice } = useTtsSettings();
  const model = useKokoroModel();
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
    model.ready === true &&
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
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          debugId?: string;
        };
        // The voice model wasn't ready: the server just kicked off the download,
        // so start tracking its progress instead of showing a dead error.
        if (data.code === "model_not_ready") void model.refresh();
        // The debug id stays in the console for support; the user sees only the copy.
        if (data.debugId) console.error("Anki export failed. Debug:", data.debugId);
        throw new Error(data.error ?? `Não consegui exportar agora (erro ${res.status}).`);
      }
      // Kept out of the UI; the export log id is only support material.
      console.info("Anki export debug id:", res.headers.get("x-phraseloop-apkg-debug-id"));

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
  }, [deckName, enKokoroSpeed, file, jsonText, voice, model]);

  return (
    <div className={cn(!embedded && "mt-6 rounded-lg border border-line bg-card p-6")}>
      {!embedded && (
        <>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.8px] text-ink-muted">Anki Export</h2>
          <p className="mb-5 text-xs text-ink-muted">
            Upload JSON (pt/en) or paste JSON · choose an English voice · generate audio locally · download a deck
            package (.apkg)
          </p>
        </>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Field
            label="JSON Text (optional)"
            htmlFor={jsonTextId}
            hint="If you paste JSON here, the file input is ignored."
          >
            <Textarea
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
              className="resize-y"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deck Name" htmlFor={deckNameId}>
              <Input
                value={deckName}
                onChange={(e) => {
                  setDeckName(e.currentTarget.value);
                  resetFeedback();
                }}
                disabled={status === "exporting"}
                id={deckNameId}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="English Voice">
              <div className="w-full rounded-md border border-line bg-input px-3 py-2 text-sm text-ink">
                {`Kokoro · ${voice}`}
              </div>
            </Field>

            <Field label="Kokoro Speed" htmlFor={kokoroSpeedId}>
              <Input
                value={enKokoroSpeed}
                onChange={(e) => {
                  setEnKokoroSpeed(e.currentTarget.value);
                  resetFeedback();
                }}
                disabled={status === "exporting"}
                inputMode="decimal"
                id={kokoroSpeedId}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Field label="JSON File (optional)" htmlFor={jsonFileId}>
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
              className={cn(
                "w-full cursor-pointer rounded-md border bg-input p-3 text-left text-sm text-ink outline-none transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
                isDragging ? "border-accent" : "border-dashed border-line hover:border-line-strong",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{file ? file.name : "Drag & drop a JSON file here"}</div>
                  <div className="text-xs text-ink-muted">
                    {file ? `${Math.round(file.size / 1024)} KB` : "or click to select"}
                  </div>
                </div>
              </div>
            </button>
          </Field>
          <KokoroModelNotice model={model} />

          <Button
            variant="primary"
            size="lg"
            className="flex items-center justify-center gap-2 py-2.5"
            onClick={exportApkg}
            disabled={!canExport}
          >
            {status === "exporting" ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                Exporting…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 14a1 1 0 011-1h3a1 1 0 010 2H5v2h10v-2h-2a1 1 0 110-2h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
                  <path d="M7 10a1 1 0 011.707-.707L10 10.586V3a1 1 0 112 0v7.586l1.293-1.293A1 1 0 0114.707 10.707l-3 3a1 1 0 01-1.414 0l-3-3A1 1 0 017 10z" />
                </svg>
                Download .apkg
              </>
            )}
          </Button>

          {status === "done" && (
            <p className="text-xs text-success">
              Export concluído. Se o download não começou, tente de novo.
            </p>
          )}

          {status === "error" && error && (
            <Notice tone="error" className="text-xs">
              {error}
            </Notice>
          )}

          <p className="text-xs text-ink-muted">
            Tip: the first export may take a while because models need to download.
          </p>
        </div>
      </div>
    </div>
  );
}
