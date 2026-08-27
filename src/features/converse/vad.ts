/**
 * Voice-activity detection for hands-free free talk: decide when the learner has finished
 * speaking so their turn can be transcribed and sent without them pressing anything.
 *
 * The decision logic lives here as pure functions, apart from the `requestAnimationFrame` loop
 * that feeds it — the same split `computeUnlockedTabTier` uses to stay testable under `node`.
 */

export interface VadConfig {
  /** Quiet stretch, after speech has been heard, that counts as "done talking". */
  silenceMs: number;
  /** Give up entirely if the learner never starts. */
  noSpeechMs: number;
  /** Opening window spent measuring the room rather than listening for speech. */
  calibrationMs: number;
  /** Floor for the speech threshold, for a room quiet enough to measure near zero. */
  minThreshold: number;
  /**
   * Ceiling, in case the learner was already talking while we calibrated. Without it their own
   * voice sets the threshold above anything they say next and the turn never closes.
   */
  maxThreshold: number;
  /** How far above room tone counts as speech. */
  thresholdMultiplier: number;
}

export const DEFAULT_VAD_CONFIG: VadConfig = {
  silenceMs: 3000,
  noSpeechMs: 15000,
  calibrationMs: 400,
  minThreshold: 0.02,
  maxThreshold: 0.12,
  thresholdMultiplier: 3,
};

export interface VadState {
  startedAt: number;
  /** Running mean of the calibration window; a mean rides out transients better than a peak. */
  ambientSum: number;
  ambientCount: number;
  /** Null until calibration finishes. */
  threshold: number | null;
  heardSpeech: boolean;
  silenceSince: number | null;
}

export type VadAction =
  /** Keep listening. */
  | "listening"
  /** Speech ended — stop the recorder, transcribe and send. */
  | "submit"
  /** Nothing was ever said — stop and discard without spending a transcription. */
  | "giveup";

export interface VadStep {
  state: VadState;
  action: VadAction;
  /** How long the current silence has run, for the "closing in N s" affordance. */
  silenceElapsedMs: number;
}

export function createVadState(now: number): VadState {
  return { startedAt: now, ambientSum: 0, ambientCount: 0, threshold: null, heardSpeech: false, silenceSince: null };
}

/** Root-mean-square level of one time-domain frame from an AnalyserNode. */
export function computeRms(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

/**
 * Turn measured room tone into a speech threshold. This replaced a hard-coded 0.025: in a room
 * noisier than that, ambient level alone clears the bar, the silence timer never accumulates and
 * a hands-free turn never closes by itself.
 */
export function speechThreshold(ambientRms: number, config: VadConfig = DEFAULT_VAD_CONFIG): number {
  const scaled = ambientRms * config.thresholdMultiplier;
  return Math.min(config.maxThreshold, Math.max(config.minThreshold, scaled));
}

export function advanceVad(
  state: VadState,
  rms: number,
  now: number,
  config: VadConfig = DEFAULT_VAD_CONFIG,
): VadStep {
  // Calibration window: measure the room, and commit to a threshold on the frame that leaves it.
  if (state.threshold === null) {
    const ambientSum = state.ambientSum + rms;
    const ambientCount = state.ambientCount + 1;
    if (now - state.startedAt < config.calibrationMs) {
      return { state: { ...state, ambientSum, ambientCount }, action: "listening", silenceElapsedMs: 0 };
    }
    const ambient = ambientCount > 0 ? ambientSum / ambientCount : 0;
    return {
      state: { ...state, ambientSum, ambientCount, threshold: speechThreshold(ambient, config) },
      action: "listening",
      silenceElapsedMs: 0,
    };
  }

  if (rms > state.threshold) {
    return { state: { ...state, heardSpeech: true, silenceSince: null }, action: "listening", silenceElapsedMs: 0 };
  }

  if (state.heardSpeech) {
    const silenceSince = state.silenceSince ?? now;
    const silenceElapsedMs = now - silenceSince;
    return {
      state: { ...state, silenceSince },
      action: silenceElapsedMs >= config.silenceMs ? "submit" : "listening",
      silenceElapsedMs,
    };
  }

  // Still nothing said. The clock runs from the start of listening, calibration included.
  return {
    state,
    action: now - state.startedAt >= config.noSpeechMs ? "giveup" : "listening",
    silenceElapsedMs: 0,
  };
}

/** Whole seconds left before a silent turn is sent; drives the countdown shown while listening. */
export function silenceCountdownSeconds(silenceElapsedMs: number, config: VadConfig = DEFAULT_VAD_CONFIG): number {
  return Math.max(0, Math.ceil((config.silenceMs - silenceElapsedMs) / 1000));
}
