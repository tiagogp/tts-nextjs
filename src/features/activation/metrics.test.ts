import { describe, expect, it } from "vitest";
import type { ActivityEvent, ActivityEventType } from "@/lib/store/activityLog";
import { computeW5Metrics, formatActivationDuration, TTFR_TARGET_MS } from "./metrics";

let seq = 0;
function event<T extends ActivityEventType>(
  type: T,
  ts: number,
  payload: ActivityEvent<T>["payload"],
): ActivityEvent<T> {
  return { id: `e${seq++}`, ts, type, payload };
}

const DAY = 24 * 60 * 60 * 1000;

describe("computeW5Metrics", () => {
  it("returns empty metrics with no activity", () => {
    const m = computeW5Metrics([]);
    expect(m.timeToSavedPhraseMs).toBeNull();
    expect(m.timeToFirstReviewMs).toBeNull();
    expect(m.ttfrUnderTarget).toBeNull();
    expect(m.returnedDay1).toBe(false);
    expect(m.returnedDay7).toBe(false);
  });

  it("reads TT saved phrase and TTFR from captured activation timing", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("cards_created", start + 40_000, {
        count: 8,
        source: "learn",
        activation: { source: "demo_lesson", zeroSetup: true, startedAt: start, elapsedMs: 40_000 },
      }),
      event("cards_reviewed", start + 90_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "demo_lesson", zeroSetup: true, startedAt: start, elapsedMs: 90_000 },
      }),
    ];

    const m = computeW5Metrics(events);
    expect(m.startedAt).toBe(start);
    expect(m.timeToSavedPhraseMs).toBe(40_000);
    expect(m.timeToFirstReviewMs).toBe(90_000);
    expect(m.ttfrUnderTarget).toBe(true);
  });

  it("flags TTFR over the 2-minute activation gate", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_reviewed", start + TTFR_TARGET_MS + 1000, {
        count: 1,
        cardIds: ["c1"],
        activation: {
          source: "demo_lesson",
          zeroSetup: true,
          startedAt: start,
          elapsedMs: TTFR_TARGET_MS + 1000,
        },
      }),
    ]);
    expect(m.ttfrUnderTarget).toBe(false);
  });

  it("detects D+1 and D+7 return from later activity days", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_created", start, { count: 5, source: "learn" }),
      event("cards_reviewed", start + DAY, { count: 1, cardIds: ["c1"] }),
      event("cards_reviewed", start + 7 * DAY, { count: 1, cardIds: ["c2"] }),
    ]);
    expect(m.activeDayOffsets).toEqual([0, 1, 7]);
    expect(m.returnedDay1).toBe(true);
    expect(m.returnedDay7).toBe(true);
  });

  it("does not mark D+7 when return stops before the seventh day", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_created", start, { count: 5, source: "learn" }),
      event("cards_reviewed", start + 2 * DAY, { count: 1, cardIds: ["c1"] }),
    ]);
    expect(m.returnedDay1).toBe(true);
    expect(m.returnedDay7).toBe(false);
  });
});

describe("formatActivationDuration", () => {
  it("renders sub-minute durations in seconds", () => {
    expect(formatActivationDuration(45_000)).toBe("45s");
  });

  it("renders minute-and-second durations", () => {
    expect(formatActivationDuration(90_000)).toBe("1m 30s");
  });
});
