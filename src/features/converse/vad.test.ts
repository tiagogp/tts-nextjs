import { describe, expect, it } from "vitest";
import {
  DEFAULT_VAD_CONFIG,
  advanceVad,
  computeRms,
  createVadState,
  silenceCountdownSeconds,
  speechThreshold,
  type VadAction,
  type VadState,
} from "./vad";

/** Feed a constant level for a stretch of time, one frame every 16ms, as rAF would. */
function run(state: VadState, rms: number, durationMs: number, startAt: number): { state: VadState; action: VadAction; now: number } {
  let current = state;
  let now = startAt;
  const end = startAt + durationMs;
  while (now <= end) {
    const step = advanceVad(current, rms, now);
    current = step.state;
    if (step.action !== "listening") return { state: current, action: step.action, now };
    now += 16;
  }
  return { state: current, action: "listening", now };
}

describe("computeRms", () => {
  it("reads silence as zero and a full-scale swing as one", () => {
    expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(computeRms(new Uint8Array([0, 255, 0, 255]))).toBeCloseTo(1, 1);
    expect(computeRms(new Uint8Array())).toBe(0);
  });
});

describe("speechThreshold", () => {
  it("sits above the measured room tone", () => {
    expect(speechThreshold(0.03)).toBeCloseTo(0.09, 5);
  });

  it("never drops below the floor in a very quiet room", () => {
    expect(speechThreshold(0)).toBe(DEFAULT_VAD_CONFIG.minThreshold);
  });

  it("caps out when the learner was already talking during calibration", () => {
    // Otherwise their own voice sets a threshold nothing they say afterwards can clear.
    expect(speechThreshold(0.9)).toBe(DEFAULT_VAD_CONFIG.maxThreshold);
  });
});

describe("advanceVad", () => {
  it("calibrates first, then sends the turn after the silence window", () => {
    const calibrated = run(createVadState(0), 0.01, DEFAULT_VAD_CONFIG.calibrationMs, 0);
    expect(calibrated.state.threshold).not.toBeNull();

    const spoke = run(calibrated.state, 0.3, 1000, calibrated.now);
    expect(spoke.state.heardSpeech).toBe(true);

    const early = run(spoke.state, 0.001, DEFAULT_VAD_CONFIG.silenceMs - 500, spoke.now);
    expect(early.action).toBe("listening");

    const closed = run(early.state, 0.001, 1000, early.now);
    expect(closed.action).toBe("submit");
  });

  it("closes the turn at 3 seconds of silence, not sooner", () => {
    const calibrated = run(createVadState(0), 0.005, DEFAULT_VAD_CONFIG.calibrationMs, 0);
    const spoke = run(calibrated.state, 0.3, 200, calibrated.now);
    const closed = run(spoke.state, 0.001, 5000, spoke.now);
    expect(closed.action).toBe("submit");
    expect(closed.now - spoke.now).toBeGreaterThanOrEqual(DEFAULT_VAD_CONFIG.silenceMs);
  });

  it("keeps listening through a pause shorter than the window", () => {
    const calibrated = run(createVadState(0), 0.005, DEFAULT_VAD_CONFIG.calibrationMs, 0);
    const spoke = run(calibrated.state, 0.3, 200, calibrated.now);
    const paused = run(spoke.state, 0.001, 1500, spoke.now);
    expect(paused.action).toBe("listening");
    const resumed = run(paused.state, 0.3, 100, paused.now);
    expect(resumed.state.silenceSince).toBeNull();
  });

  it("gives up without a transcription when nothing is ever said", () => {
    const result = run(createVadState(0), 0.002, DEFAULT_VAD_CONFIG.noSpeechMs + 500, 0);
    expect(result.action).toBe("giveup");
    expect(result.state.heardSpeech).toBe(false);
  });

  it("still closes the turn in a noisy room", () => {
    // The regression the fixed 0.025 threshold caused: room tone above it meant the silence
    // timer never accumulated and hands-free mode hung forever.
    const ambient = 0.03;
    const calibrated = run(createVadState(0), ambient, DEFAULT_VAD_CONFIG.calibrationMs, 0);
    expect(calibrated.state.threshold).toBeGreaterThan(ambient);
    const spoke = run(calibrated.state, 0.4, 300, calibrated.now);
    expect(spoke.state.heardSpeech).toBe(true);
    const closed = run(spoke.state, ambient, 5000, spoke.now);
    expect(closed.action).toBe("submit");
  });

  it("does not mistake room tone for speech during the wait", () => {
    const ambient = 0.03;
    const calibrated = run(createVadState(0), ambient, DEFAULT_VAD_CONFIG.calibrationMs, 0);
    const waited = run(calibrated.state, ambient, 3000, calibrated.now);
    expect(waited.state.heardSpeech).toBe(false);
  });
});

describe("silenceCountdownSeconds", () => {
  it("counts down to zero across the silence window", () => {
    expect(silenceCountdownSeconds(0)).toBe(3);
    expect(silenceCountdownSeconds(1200)).toBe(2);
    expect(silenceCountdownSeconds(DEFAULT_VAD_CONFIG.silenceMs)).toBe(0);
    expect(silenceCountdownSeconds(DEFAULT_VAD_CONFIG.silenceMs + 999)).toBe(0);
  });
});
