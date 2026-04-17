"use client";

import { HistoryEntry } from "@/types/history";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}

const VOICE_LABELS: Record<string, string> = {
  "female-1": "Emma (Female)",
  "female-2": "Aria (Female)",
  "male-1": "Marcus (Male)",
  "male-2": "Liam (Male)",
  "neutral": "Alex (Neutral)",
};

export default function HistoryPanel({ history, onRestore, onClear }: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">Recent Generations</h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{entry.text}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {VOICE_LABELS[entry.voice] ?? entry.voice} · {entry.speed}x ·{" "}
                {new Date(entry.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onRestore(entry)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Restore
              </button>

              <a
                href={entry.audioUrl}
                download="speech.wav"
                className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
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
