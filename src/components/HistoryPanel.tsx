"use client";

import { HistoryEntry } from "@/types/history";

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
  "Claribel Dervla":  "Claribel",
  "Daisy Studious":   "Daisy",
  "Sofia Hellen":     "Sofia",
  "Tammy Grit":       "Tammy",
  "Andrew Chipper":   "Andrew",
  "Badr Odhiambo":    "Badr",
  "Craig Gutsy":      "Craig",
  "Torcull Diarmuid": "Torcull",
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
  "vits":    "VITS",
  "xtts-v2": "XTTS v2",
  "kokoro":  "Kokoro",
};

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
          className="text-xs transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c41c1c")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          Clear all
        </button>
      </div>

      <div className="space-y-1.5">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group"
            style={{
              backgroundColor: "var(--surface-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {entry.text}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {ENGINE_LABELS[entry.engine] ?? entry.engine} · {VOICE_LABELS[entry.voice] ?? entry.voice} · {entry.speed}× · {new Date(entry.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onRestore(entry)}
                className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#ff5600" }}
              >
                Restore
              </button>

              <a
                href={entry.audioUrl}
                download="speech.wav"
                className="transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                aria-label="Download"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
