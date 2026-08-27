import { describe, expect, it } from "vitest";
import {
  IDLE_GRACE_MS,
  createTimer,
  creditedMs,
  pauseTimer,
  resumeTimer,
  stageMinutes,
  touchTimer,
} from "./stageTimer";

const t0 = Date.UTC(2026, 6, 13);
const SECOND = 1_000;
const MINUTE = 60 * SECOND;

describe("stageTimer", () => {
  it("banks the time a running segment was focused", () => {
    const timer = pauseTimer(createTimer(t0), t0 + MINUTE);

    expect(timer.activeMs).toBe(MINUTE);
  });

  it("accrues nothing while paused", () => {
    const paused = pauseTimer(createTimer(t0), t0 + 30 * SECOND);

    expect(creditedMs(paused, t0 + 5 * MINUTE)).toBe(30 * SECOND);
  });

  it("does not add idle grace after a manually stopped listening clip is later committed", () => {
    const stopped = pauseTimer(createTimer(t0), t0 + 10 * SECOND);

    expect(stageMinutes("listen", creditedMs(stopped, t0 + 5 * MINUTE), 1)).toBe(0.5);
  });

  it("adds a resumed segment to what was already banked", () => {
    const paused = pauseTimer(createTimer(t0), t0 + 30 * SECOND);
    const resumed = resumeTimer(paused, t0 + 5 * MINUTE);

    expect(creditedMs(resumed, t0 + 5 * MINUTE + 20 * SECOND)).toBe(50 * SECOND);
  });

  // The load-bearing case: a tab left open never fires blur, so idle time must be
  // bounded by the grace window rather than by focus.
  it("does not inflate when the learner walks away", () => {
    const idle = createTimer(t0);

    expect(creditedMs(idle, t0 + 10 * MINUTE)).toBe(IDLE_GRACE_MS);
  });

  it("keeps crediting while the learner keeps interacting", () => {
    let timer = createTimer(t0);
    for (let elapsed = 60 * SECOND; elapsed <= 5 * MINUTE; elapsed += 60 * SECOND) {
      timer = touchTimer(timer, t0 + elapsed);
    }

    expect(creditedMs(timer, t0 + 5 * MINUTE)).toBe(5 * MINUTE);
  });

  it("discards the idle gap when the learner comes back after the grace window", () => {
    const returned = touchTimer(createTimer(t0), t0 + 10 * MINUTE);

    // Credit stops at the grace cutoff; the 8.5 idle minutes are not paid out.
    expect(returned.activeMs).toBe(IDLE_GRACE_MS);
    expect(creditedMs(returned, t0 + 11 * MINUTE)).toBe(IDLE_GRACE_MS + MINUTE);
  });

  describe("stageMinutes", () => {
    it("caps a runaway window at the stage ceiling", () => {
      expect(stageMinutes("review", 600 * MINUTE, 1)).toBe(5);
    });

    it("floors a short but real action at half a minute", () => {
      expect(stageMinutes("listen", 10 * SECOND, 1)).toBe(0.5);
    });

    it("rounds to half-minute resolution", () => {
      expect(stageMinutes("learn", 3 * MINUTE + 40 * SECOND, 4)).toBe(3.5);
    });

    // The backward-compatibility contract: nothing measured means the old constant.
    it("falls back to the site's constant when nothing was measured", () => {
      expect(stageMinutes("speak", 0, 2)).toBe(2);
    });
  });
});
