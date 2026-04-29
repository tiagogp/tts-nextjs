"use client";

import { type RefObject, useCallback, useMemo, useRef, useState } from "react";

export type AudioState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
};

export type UseAudioState = {
  state: AudioState;
  progressPct: number;
  formatTime: (seconds: number) => string;
  audioHandlers: {
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
  };
  togglePlay: () => void;
  stop: () => void;
  seekToPct: (pct: number) => void;
};

export function useAudioState(
  audioRef: RefObject<HTMLAudioElement | null>,
): UseAudioState {
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });
  const rafIdRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<number | null>(null);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  const progressPct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, [audioRef]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, [audioRef]);

  const seekToPct = useCallback(
    (pct: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clamped = Math.min(1, Math.max(0, pct));
      const d = audio.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      audio.currentTime = clamped * d;
    },
    [audioRef],
  );

  const audioHandlers = useMemo(
    () => ({
      onPlay: () => setState((s) => ({ ...s, isPlaying: true })),
      onPause: () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
          pendingTimeRef.current = null;
        }
        setState((s) => ({ ...s, isPlaying: false }));
      },
      onEnded: () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
          pendingTimeRef.current = null;
        }
        setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
      },
      onTimeUpdate: () => {
        const audio = audioRef.current;
        if (!audio) return;
        pendingTimeRef.current = audio.currentTime;
        if (rafIdRef.current !== null) return;
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          const nextTime = pendingTimeRef.current;
          pendingTimeRef.current = null;
          if (nextTime === null) return;
          setState((s) => ({ ...s, currentTime: nextTime }));
        });
      },
      onLoadedMetadata: () =>
        setState((s) => ({ ...s, duration: audioRef.current?.duration ?? 0 })),
    }),
    [audioRef],
  );

  return { state, progressPct, formatTime, audioHandlers, togglePlay, stop, seekToPct };
}
