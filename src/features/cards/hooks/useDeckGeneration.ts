"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GenerationStage {
  /** Show this label while elapsed seconds are below `untilSeconds` (use Infinity for the last). */
  untilSeconds: number;
  label: string;
}

export interface DeckGenerationOptions {
  timeoutMs: number;
  /** Ordered stages (ascending `untilSeconds`); the last should use Infinity as the fallback. */
  stages: GenerationStage[];
  /** Message shown when the run is aborted by the timeout (differs slightly per tab). */
  timeoutMessage: string;
  /** Message shown when the user cancels. */
  cancelMessage: string;
  /** Inspect a non-abort failure before its message is shown (e.g. kick off a model download). */
  onError?: (error: unknown) => void;
}

export interface DeckGeneration {
  generating: boolean;
  generationSeconds: number;
  generationStage: string;
  genError: string | null;
  genDone: string | null;
  setGenDone: (value: string | null) => void;
  setGenError: (value: string | null) => void;
  cancelGeneration: () => void;
  /**
   * Run a deck-generation task. `task` does the provider-specific work (build sources → call the
   * API → exportAndSaveDeck) and returns the success message. The hook owns the AbortController,
   * timeout, elapsed-seconds timer, and abort/timeout/error mapping. Resolves true on success.
   */
  run: (task: (signal: AbortSignal) => Promise<string>) => Promise<boolean>;
}

/**
 * The shared generation orchestration behind the Discover and Correct "Generate cards" buttons:
 * abort controller, timeout, the live elapsed-seconds timer, the staged status label, and the
 * abort/timeout/error → message mapping. Callers supply only the task that differs between tabs.
 */
export function useDeckGeneration(options: DeckGenerationOptions): DeckGeneration {
  const [generating, setGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timedOutRef = useRef(false);
  // Keep the latest options without re-creating `run` every render. `run` only fires from
  // event handlers (after commit), so syncing the ref in an effect is timely enough.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [generating]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const cancelGeneration = useCallback(() => {
    timedOutRef.current = false;
    abortRef.current?.abort();
  }, []);

  const run = useCallback(
    async (task: (signal: AbortSignal) => Promise<string>): Promise<boolean> => {
      if (abortRef.current) return false;
      const opts = optionsRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      timedOutRef.current = false;
      setGenerationSeconds(0);
      setGenerating(true);
      setGenError(null);
      setGenDone(null);

      const timeout = window.setTimeout(() => {
        timedOutRef.current = true;
        controller.abort();
      }, opts.timeoutMs);

      try {
        const message = await task(controller.signal);
        setGenDone(message);
        return true;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          setGenError(timedOutRef.current ? opts.timeoutMessage : opts.cancelMessage);
        } else {
          opts.onError?.(err);
          setGenError(err instanceof Error ? err.message : "Failed to generate cards.");
        }
        return false;
      } finally {
        window.clearTimeout(timeout);
        if (abortRef.current === controller) abortRef.current = null;
        setGenerating(false);
      }
    },
    [],
  );

  const generationStage =
    options.stages.find((stage) => generationSeconds < stage.untilSeconds)?.label ??
    options.stages[options.stages.length - 1]?.label ??
    "";

  return {
    generating,
    generationSeconds,
    generationStage,
    genError,
    genDone,
    setGenDone,
    setGenError,
    cancelGeneration,
    run,
  };
}
