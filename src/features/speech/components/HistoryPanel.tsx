"use client";

import { useRef } from "react";
import { HistoryEntry } from "@/types/history";
import { useAudioState } from "@/features/speech/hooks/useAudioState";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
  embedded?: boolean;
}

const VOICE_LABELS: Record<string, string> = {
  "female-1": "Emma",
  "female-2": "Aria",
  "male-1":   "Marcus",
  "male-2":   "Liam",
  "neutral":  "Alex",
  "af_heart":   "Heart",
  "af_bella":   "Bella",
  "af_sarah":   "Sarah",
  "af_nicole":  "Nicole",
  "am_adam":    "Adam",
  "am_michael": "Michael",
  "bf_emma":    "Emma",
  "bm_george":  "George",
};

const ENGINE_LABELS: Record<string, string> = {
  "vits":   "VITS",
  "kokoro": "Kokoro",
};

interface HistoryItemProps {
  entry: HistoryEntry;
  onRestore: (entry: HistoryEntry) => void;
}

function HistoryItem({ entry, onRestore }: HistoryItemProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, progressPct, formatTime, audioHandlers, togglePlay, seekToPct } =
    useAudioState(audioRef);

  return (
    <div className="group rounded-lg border border-line bg-card px-4 py-3 transition-colors hover:border-line-strong">
      <audio
        ref={audioRef}
        src={entry.audioUrl}
        {...audioHandlers}
      />

      {/* Top row: text + restore + download */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{entry.text}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {ENGINE_LABELS[entry.engine] ?? entry.engine} · {VOICE_LABELS[entry.voice] ?? entry.voice} · {entry.speed}× · {new Date(entry.createdAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onRestore(entry)}
            className="cursor-pointer text-xs font-medium text-accent transition-opacity hover:opacity-80"
          >
            Restore
          </button>
          <a
            href={entry.audioUrl}
            download="speech.wav"
            className="text-ink-muted hover:text-ink"
            aria-label="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>

      {/* Mini player */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-off-black text-white transition hover:brightness-150 focus-visible:outline focus-visible:outline-accent"
          aria-label={state.isPlaying ? "Pause" : "Play"}
        >
          {state.isPlaying ? (
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="3" width="4" height="14" rx="1" />
              <rect x="12" y="3" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="ml-px w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          className="h-1 flex-1 cursor-pointer rounded-full bg-line"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
            seekToPct(pct);
          }}
        >
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
          {state.duration > 0 ? `${formatTime(state.currentTime)} / ${formatTime(state.duration)}` : "--:--"}
        </span>
      </div>
    </div>
  );
}

export default function HistoryPanel({ history, onRestore, onClear, embedded = false }: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className={embedded ? "" : "mt-8"}>
      <div className="mb-3 flex items-center justify-between">
        {!embedded && (
          <h2 className="text-sm font-medium uppercase tracking-[0.8px] text-ink-muted">Recent</h2>
        )}
        <button
          onClick={() => {
            if (window.confirm("Clear all recent audio history?")) onClear();
          }}
          className="cursor-pointer text-xs text-ink-muted transition-colors hover:text-danger"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-1.5">
        {history.map((entry) => (
          <HistoryItem key={entry.id} entry={entry} onRestore={onRestore} />
        ))}
      </div>
    </div>
  );
}
