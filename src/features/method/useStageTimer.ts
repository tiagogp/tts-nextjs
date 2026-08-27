"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MethodStage } from "@/features/method/learningLoop";
import {
  createTimer,
  creditedMs,
  pauseTimer,
  resumeTimer,
  stageMinutes,
  touchTimer,
  type StageTimerState,
} from "@/features/method/stageTimer";

export interface StageTimer {
  /** Start or resume measuring. Idempotent. */
  start: () => void;
  /** Mark an interaction so an idle window stops accruing (audio ticks, keystrokes). */
  touch: () => void;
  /** Stop without discarding what is banked — e.g. the learner paused the audio. */
  pause: () => void;
  /**
   * Stop, reset, and return the clamped minutes for exactly one `method_stage` emit.
   * Pass `stage` when the window's stage is only known on submit — lesson production is
   * `speak` when it was spoken and `feedback` when it was typed, but it is one window.
   */
  commit: (stage?: MethodStage) => number;
}

/**
 * Measures how long a method stage actually took, so the balance in `learningLoop` is a
 * ledger rather than an estimate. All arithmetic lives in `stageTimer.ts`, which is pure
 * and tested; this hook only wires it to the DOM signals that reveal attention.
 *
 * @param fallbackMinutes what the stage used to be worth as a hardcoded constant. Emitted
 * when nothing could be measured, so the ledger degrades to the old behaviour, not to zero.
 * @param options.autoStart start on mount. Pass false for event-driven stages like
 * `listen`, whose window opens when the audio plays rather than when the tab renders.
 */
export function useStageTimer(
  stage: MethodStage,
  fallbackMinutes: number,
  options: { autoStart?: boolean } = {},
): StageTimer {
  const { autoStart = true } = options;
  const stateRef = useRef<StageTimerState | null>(null);

  const start = useCallback(() => {
    const now = Date.now();
    stateRef.current =
      stateRef.current == null ? createTimer(now) : resumeTimer(stateRef.current, now);
  }, []);

  const touch = useCallback(() => {
    if (stateRef.current == null) return;
    stateRef.current = touchTimer(stateRef.current, Date.now());
  }, []);

  const pause = useCallback(() => {
    if (stateRef.current == null) return;
    stateRef.current = pauseTimer(stateRef.current, Date.now());
  }, []);

  const commit = useCallback(
    (stageOverride?: MethodStage) => {
      const state = stateRef.current;
      stateRef.current = null;
      if (state == null) return fallbackMinutes;
      return stageMinutes(stageOverride ?? stage, creditedMs(state, Date.now()), fallbackMinutes);
    },
    [stage, fallbackMinutes],
  );

  useEffect(() => {
    if (autoStart) start();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    window.addEventListener("focus", start);
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
      window.removeEventListener("focus", start);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
    };
  }, [autoStart, start, pause, touch]);

  return { start, touch, pause, commit };
}
