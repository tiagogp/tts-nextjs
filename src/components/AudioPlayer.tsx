"use client";

import { useRef, useState } from "react";

interface AudioPlayerProps {
  audioUrl: string;
  voiceLabel: string;
}

export default function AudioPlayer({ audioUrl, voiceLabel }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const stop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {voiceLabel}
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "--:--"}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full cursor-pointer"
        style={{ backgroundColor: "var(--border)" }}
        onClick={(e) => {
          if (!audioRef.current || !duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
        }}
      >
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${progressPct}%`, backgroundColor: "#ff5600" }}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ backgroundColor: "#111111", color: "#ffffff", borderRadius: "4px" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333333")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#111111")}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
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
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: "4px" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
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
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#111111";
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.borderColor = "#111111";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
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
