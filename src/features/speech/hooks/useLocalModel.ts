"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ensure,
  getServerSnapshot,
  refresh,
  retry,
  SNAPSHOT_GETTERS,
  subscribe,
  type LocalModelId,
  type LocalModelSnapshot,
} from "@/features/speech/modelStore";

export interface LocalModelState extends LocalModelSnapshot {
  id: LocalModelId;
  /** Trigger the one-time download and poll until it lands. */
  ensure: () => Promise<void>;
  /** Retry after a failed install — unlike `ensure`, it clears the one-attempt latch. */
  retry: () => Promise<void>;
  /** Force a one-off status refresh. */
  refresh: () => Promise<unknown>;
}

/**
 * Read the shared install state for one local model. Every call site gets the
 * same snapshot from a single poller — see `modelStore` for why this is a
 * module singleton rather than a per-component hook or a context.
 */
export function useLocalModel(id: LocalModelId): LocalModelState {
  const snapshot = useSyncExternalStore(subscribe, SNAPSHOT_GETTERS[id], getServerSnapshot);
  return useMemo(
    () => ({
      ...snapshot,
      id,
      ensure: () => ensure(id),
      retry: () => retry(id),
      refresh,
    }),
    [snapshot, id],
  );
}

/** The Kokoro voice model — everything that generates audio depends on it. */
export const useKokoroModel = (): LocalModelState => useLocalModel("kokoro");
/** The Whisper speech-recognition model — everything that listens depends on it. */
export const useWhisperModel = (): LocalModelState => useLocalModel("whisper");
