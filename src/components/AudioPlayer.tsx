"use client";

import { useRef } from "react";
import { useAudioState } from "@/components/useAudioState";

interface AudioPlayerProps {
  audioUrl: string;
  voiceLabel: string;
}

export default function AudioPlayer({ audioUrl, voiceLabel }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, progressPct, formatTime, audioHandlers, togglePlay, stop, seekToPct } =
    useAudioState(audioRef);

  return (
    <div
      className="rounded-lg p-4 space-y-3 border bg-(--surface) border-(--border)"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        {...audioHandlers}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-(--text-secondary)">
          {voiceLabel}
        </span>
        <span className="text-xs tabular-nums text-(--text-muted)">
          {formatTime(state.currentTime)} /{" "}
          {state.duration > 0 ? formatTime(state.duration) : "--:--"}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full cursor-pointer bg-(--border)"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
          seekToPct(pct);
        }}
      >
        <div
          className="h-1 rounded-full transition-all bg-(--accent)"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors bg-off-black text-white hover:bg-[#333333] focus-visible:outline-2 focus-visible:outline-(--accent)"
          aria-label={state.isPlaying ? "Pause" : "Play"}
        >
          {state.isPlaying ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="3" width="4" height="14" rx="1" />
              <rect x="12" y="3" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={stop}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors border border-(--border) text-(--text-muted) hover:border-(--border-strong) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-(--accent)"
          aria-label="Stop"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <rect x="4" y="4" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Download */}
        <a
          href={audioUrl}
          download="speech.wav"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors rounded border border-(--border) text-(--text-secondary) hover:bg-off-black hover:text-white hover:border-off-black focus-visible:outline-2 focus-visible:outline-(--accent)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download WAV
        </a>
      </div>
    </div>
  );
}
