"use client";

import { useRef } from "react";
import { HistoryEntry } from "@/types/history";
import { useAudioState } from "@/components/useAudioState";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
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
    <div
      className="px-4 py-3 rounded-lg transition-colors group bg-(--surface-card) border border-(--border) hover:border-(--border-strong)"
    >
      <audio
        ref={audioRef}
        src={entry.audioUrl}
        {...audioHandlers}
      />

      {/* Top row: text + restore + download */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate text-(--text-primary)">
            {entry.text}
          </p>
          <p className="text-xs mt-0.5 text-(--text-muted)">
            {ENGINE_LABELS[entry.engine] ?? entry.engine} · {VOICE_LABELS[entry.voice] ?? entry.voice} · {entry.speed}× · {new Date(entry.createdAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onRestore(entry)}
            className="text-xs font-medium"
            style={{ color: "#ff5600" }}
          >
            Restore
          </button>
          <a
            href={entry.audioUrl}
            download="speech.wav"
            className="text-(--text-muted) hover:text-(--text-primary)"
            aria-label="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>

      {/* Mini player */}
      <div className="flex items-center gap-2 mt-2.5">
        <button
          onClick={togglePlay}
          className="w-6 h-6 flex items-center justify-center rounded shrink-0 transition-colors bg-off-black text-white hover:bg-[#333333] focus-visible:outline focus-visible:outline-(--accent)"
          aria-label={state.isPlaying ? "Pause" : "Play"}
        >
          {state.isPlaying ? (
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="3" width="4" height="14" rx="1" />
              <rect x="12" y="3" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5 ml-px" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          className="flex-1 h-1 rounded-full cursor-pointer"
          style={{ backgroundColor: "var(--border)" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
            seekToPct(pct);
          }}
        >
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${progressPct}%`, backgroundColor: "#ff5600" }}
          />
        </div>

        <span className="text-xs tabular-nums shrink-0 text-(--text-muted)">
          {state.duration > 0
            ? `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`
            : "--:--"}
        </span>
      </div>
    </div>
  );
}

export default function HistoryPanel({ history, onRestore, onClear }: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
        >
          Recent
        </h2>
        <button
          onClick={onClear}
          className="text-xs transition-colors text-(--text-muted) hover:text-[#c41c1c]"
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
