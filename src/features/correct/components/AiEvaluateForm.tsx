"use client";

import { type ChangeEvent, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

interface AiEvaluateFormProps {
  value: string;
  onChange: (value: string) => void;
  evaluating: boolean;
  transcribing: boolean;
  recording: boolean;
  note: string | null;
  evaluatorHint: string | null;
  ollamaOffline: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onToggleRecord: () => void;
  onPickFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onEvaluate: () => void;
  onOpenSettings?: () => void;
}

export function AiEvaluateForm({
  value,
  onChange,
  evaluating,
  transcribing,
  recording,
  note,
  evaluatorHint,
  ollamaOffline,
  fileInputRef,
  onToggleRecord,
  onPickFile,
  onEvaluate,
  onOpenSettings,
}: AiEvaluateFormProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write or record a few sentences in English. The AI will find what a native speaker would say differently."
        rows={6}
        disabled={evaluating}
        className="px-4 py-3 leading-relaxed"
      />
      {note && (
        <p
          className={cn("text-xs", note.includes("🎉") ? "text-ink-soft" : "text-danger")}
          role="status"
          aria-live="polite"
        >
          {note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={onToggleRecord}
          disabled={evaluating || transcribing}
          className={cn("h-10 gap-2", recording && "border-danger text-danger")}
        >
          {recording ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              Stop recording
            </>
          ) : transcribing ? (
            <>
              <Spinner className="h-4 w-4" />
              Transcribing…
            </>
          ) : (
            <>
              <MicrophoneIcon />
              Record speech
            </>
          )}
        </Button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onPickFile} />
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || evaluating || transcribing}
          className="h-10 gap-2"
        >
          <UploadIcon />
          Upload audio
        </Button>
        <Button
          variant="primary"
          onClick={onEvaluate}
          disabled={!value.trim() || evaluating || transcribing || evaluatorHint !== null}
          className="ml-auto h-10"
        >
          {evaluating ? "Evaluating…" : "Evaluate with AI →"}
        </Button>
      </div>
      {evaluatorHint && (
        <p className="text-xs text-ink-muted">
          {evaluatorHint}{" "}
          {onOpenSettings && !evaluatorHint.startsWith("The Local") && (
            <button onClick={onOpenSettings} className="underline hover:no-underline">
              Open Settings →
            </button>
          )}
        </p>
      )}
      {ollamaOffline && (
        <p className="text-xs text-danger">
          Ollama is offline or has no installed models.{" "}
          {onOpenSettings ? (
            <button onClick={onOpenSettings} className="underline hover:no-underline">
              Open Settings →
            </button>
          ) : (
            "Open Settings to check the connection."
          )}
        </p>
      )}
    </div>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
