import { MAX_STAGE_MINUTES, type MethodStage } from "@/features/method/learningLoop";

/**
 * How long the learner keeps earning credit after their last interaction — enough to
 * read a feedback panel or hear a clip through — before the clock stops.
 *
 * Focus alone cannot detect idleness: a tab left open on a second monitor never fires
 * `blur`, so without this bound an abandoned session would bank hours of "study".
 */
export const IDLE_GRACE_MS = 90_000;

export interface StageTimerState {
  /** Focused, non-idle milliseconds already banked from finished segments. */
  activeMs: number;
  /** Wall clock when the running segment began; null while paused. */
  startedAt: number | null;
  /** Last interaction, or the segment start if there has been none. */
  lastActivityAt: number;
}

export function createTimer(now: number, running = true): StageTimerState {
  return { activeMs: 0, startedAt: running ? now : null, lastActivityAt: now };
}

/** Milliseconds the running segment is worth, with idle time beyond the grace window cut. */
function segmentMs(state: StageTimerState, now: number): number {
  if (state.startedAt == null) return 0;
  const idleCutoff = state.lastActivityAt + IDLE_GRACE_MS;
  return Math.max(0, Math.min(now, idleCutoff) - state.startedAt);
}

/** Total credited time, including the segment still running. */
export function creditedMs(state: StageTimerState, now: number): number {
  return state.activeMs + segmentMs(state, now);
}

/** Bank the running segment and stop the clock. Idempotent while already paused. */
export function pauseTimer(state: StageTimerState, now: number): StageTimerState {
  if (state.startedAt == null) return state;
  return { activeMs: creditedMs(state, now), startedAt: null, lastActivityAt: now };
}

/** Open a new segment. Idempotent while already running. */
export function resumeTimer(state: StageTimerState, now: number): StageTimerState {
  if (state.startedAt != null) return state;
  return { ...state, startedAt: now, lastActivityAt: now };
}

/**
 * The learner did something — a keystroke, a click, an audio tick. Pushes the idle
 * window forward, and resumes the clock if idleness had already stopped it.
 *
 * A touch after the grace window expired banks only the credited part of the old
 * segment, so the idle gap is discarded rather than retroactively paid out.
 */
export function touchTimer(state: StageTimerState, now: number): StageTimerState {
  if (state.startedAt == null) return resumeTimer(state, now);
  const idleCutoff = state.lastActivityAt + IDLE_GRACE_MS;
  if (now > idleCutoff) {
    return { activeMs: creditedMs(state, now), startedAt: now, lastActivityAt: now };
  }
  return { ...state, lastActivityAt: now };
}

/**
 * Minutes for one `method_stage` emit: half-minute resolution, floored at 0.5 so a real
 * action is never worth nothing, capped by the stage's ceiling.
 *
 * `fallback` (the hardcoded constant each site used before measurement existed) is
 * returned when nothing was measured at all — SSR, a timer that never started, or a
 * browser without the DOM events — so the ledger degrades to the old behaviour rather
 * than to zero.
 */
export function stageMinutes(stage: MethodStage, activeMs: number, fallback: number): number {
  if (activeMs <= 0) return fallback;
  const cap = MAX_STAGE_MINUTES[stage] ?? fallback;
  const rounded = Math.round(activeMs / 30_000) / 2;
  return Math.min(cap, Math.max(0.5, rounded));
}
