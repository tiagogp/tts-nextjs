"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryEntry } from "@/types/history";
import {
  toKokoroVoice,
  useTtsSettings,
} from "@/features/speech/context/TtsSettingsContext";

export const EXAMPLE_TEXT =
  "I'm willing to work hard because the payoff will come later.";
export const MAX_CHARS = 4096;

async function responseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  } else {
    const text = await response.text().catch(() => "");
    if (text.trim() && !text.trimStart().startsWith("<!DOCTYPE") && !text.trimStart().startsWith("<html")) {
      return text.trim().slice(0, 500);
    }
  }
  return `Request failed (${response.status})`;
}

/** Owns the speech generation workflow and its transient object URLs. */
export function useSpeechGenerator() {
  const { voice, setVoice } = useTtsSettings();
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [speed, setSpeed] = useState(1.25);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const objectUrlsRef = useRef(new Set<string>());
  const pollRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    interval?: ReturnType<typeof setInterval>;
  } | null>(null);

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return;
    clearTimeout(pollRef.current.timer);
    clearInterval(pollRef.current.interval);
    pollRef.current = null;
  }, []);

  const revokeAudioUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);

  const generate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setDownloadingModel(false);
    setError(null);

    const timer = setTimeout(() => {
      const poll = async () => {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          if (data.downloading_model) setDownloadingModel(true);
        } catch {}
      };
      poll();
      const interval = setInterval(poll, 2000);
      if (pollRef.current) pollRef.current.interval = interval;
    }, 1500);
    pollRef.current = { timer };

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed, voice }),
      });

      if (!res.ok) {
        throw new Error(await responseError(res));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.add(url);
      setAudioUrl(url);

      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          text,
          voice,
          speed,
          engine: "kokoro",
          audioUrl: url,
          createdAt: Date.now(),
        };
        const next = [entry, ...prev].slice(0, 10);
        prev.slice(9).forEach((item) => revokeAudioUrl(item.audioUrl));
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      stopPolling();
      setLoading(false);
      setDownloadingModel(false);
    }
  }, [revokeAudioUrl, speed, stopPolling, text, voice]);

  const restoreEntry = (entry: HistoryEntry) => {
    setText(entry.text);
    setVoice(toKokoroVoice(entry.voice));
    setSpeed(entry.speed);
    setAudioUrl(entry.audioUrl);
  };

  const clearHistory = () => {
    setHistory((prev) => {
      prev.forEach((entry) => revokeAudioUrl(entry.audioUrl));
      return [];
    });
    setAudioUrl(null);
  };

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      stopPolling();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, [stopPolling]);

  return {
    audioUrl,
    clearHistory,
    downloadingModel,
    error,
    generate,
    history,
    loading,
    restoreEntry,
    setSpeed,
    setText,
    setVoice,
    speed,
    text,
    voice,
  };
}
