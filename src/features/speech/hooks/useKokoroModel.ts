"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ModelStatusResponse {
  kokoro_installed?: boolean;
  downloading_kokoro?: boolean;
  download_progress?: number;
}

export interface KokoroModelState {
  /** null while the first status check is in flight. */
  ready: boolean | null;
  downloading: boolean;
  /** 0..1 while downloading, undefined otherwise. */
  progress: number | undefined;
  error: string | null;
  /** Trigger the one-time download and poll until it lands. */
  ensure: () => Promise<void>;
  /** Force a one-off status refresh. */
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2_000;

export function useKokoroModel(): KokoroModelState {
  const [ready, setReady] = useState<boolean | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = (await res.json()) as ModelStatusResponse;
      const installed = data.kokoro_installed === true;
      setReady(installed);
      setDownloading(!installed && data.downloading_kokoro === true);
      setProgress(data.download_progress);
      if (installed) stopPolling();
    } catch {
      // Leave previous state; a transient status hiccup shouldn't flip the UI.
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => void refresh(), POLL_INTERVAL_MS);
  }, [refresh]);

  const ensure = useCallback(async () => {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/models/kokoro", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Falha ao iniciar o download.");
      }
      startPolling();
      await refresh();
    } catch (err) {
      setDownloading(false);
      setError(err instanceof Error ? err.message : "Falha ao iniciar o download.");
    }
  }, [refresh, startPolling]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
    return stopPolling;
  }, [refresh, stopPolling]);

  // If a download is already in flight (e.g. triggered by a direct export
  // attempt), keep polling until it finishes.
  useEffect(() => {
    if (downloading) startPolling();
  }, [downloading, startPolling]);

  return { ready, downloading, progress, error, ensure, refresh };
}
