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
    expect(m.activationSource).toBeNull();
    expect(m.timeToSavedPhraseMs).toBeNull();
    expect(m.timeToFirstReviewMs).toBeNull();
    expect(m.ttfrUnderTarget).toBeNull();
    expect(m.timeToFirstLoopMs).toBeNull();
    expect(m.firstLoopCompleted).toBe(false);
    expect(m.dropoffStep).toBeNull();
    expect(m.returnedDay1).toBe(false);
    expect(m.returnedDay7).toBe(false);
  });

  it("reads TT saved phrase and TTFR from captured activation timing", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("cards_created", start + 40_000, {
        count: 8,
        source: "learn",
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 40_000 },
      }),
      event("cards_reviewed", start + 90_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 90_000 },
      }),
    ];

    const m = computeW5Metrics(events);
    expect(m.activationSource).toBe("bundled_lesson");
    expect(m.startedAt).toBe(start);
    expect(m.timeToSavedPhraseMs).toBe(40_000);
    expect(m.timeToFirstReviewMs).toBe(90_000);
    expect(m.ttfrUnderTarget).toBe(true);
    expect(m.firstLoopCompleted).toBe(false);
    expect(m.dropoffStep).toBe("mistake");
  });

  it("reports correction dropoff once a mistake was submitted but not saved", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("first_run_started", start, { source: "bundled_lesson", sourceId: "lesson-1" }),
      event("cards_created", start + 30_000, {
        count: 3,
        source: "learn",
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 30_000 },
      }),
      event("cards_reviewed", start + 60_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 60_000 },
      }),
      event("mistake_submitted", start + 80_000, { source: "lesson", lessonId: "lesson-1" }),
    ];

    const m = computeW5Metrics(events);
    expect(m.firstLoopCompleted).toBe(false);
    expect(m.dropoffStep).toBe("correction");
  });

  it("measures first loop completion when a correction is saved after review", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("first_run_started", start, { source: "bundled_lesson", sourceId: "lesson-1" }),
      event("cards_created", start + 30_000, {
        count: 3,
        source: "learn",
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 30_000 },
      }),
      event("cards_reviewed", start + 60_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 60_000 },
      }),
      event("correction_generated", start + 95_000, { cardsCreated: 1, source: "manual" }),
    ];

    const m = computeW5Metrics(events);
    expect(m.startedAt).toBe(start);
    expect(m.timeToFirstLoopMs).toBe(95_000);
    expect(m.firstLoopUnderTarget).toBe(true);
    expect(m.firstLoopCompleted).toBe(true);
    expect(m.dropoffStep).toBeNull();
  });

  it("completes the loop when the guided lesson corrects before the first review", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("first_run_started", start, { source: "bundled_lesson", sourceId: "lesson-1" }),
      event("cards_created", start + 25_000, {
        count: 3,
        source: "learn",
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 25_000 },
      }),
      event("mistake_submitted", start + 50_000, { source: "lesson", lessonId: "lesson-1" }),
      event("correction_generated", start + 70_000, { cardsCreated: 1, source: "lesson" }),
      event("cards_reviewed", start + 100_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 100_000 },
      }),
    ];

    const m = computeW5Metrics(events);
    expect(m.firstLoopCompleted).toBe(true);
    expect(m.timeToFirstLoopMs).toBe(100_000);
    expect(m.dropoffStep).toBeNull();
  });

  it("ignores corrections saved before the first-run handover", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const events = [
      event("correction_generated", start - 60_000, { cardsCreated: 1, source: "ai" }),
      event("first_run_started", start, { source: "bundled_lesson", sourceId: "lesson-1" }),
      event("cards_created", start + 30_000, {
        count: 3,
        source: "learn",
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 30_000 },
      }),
      event("cards_reviewed", start + 60_000, {
        count: 1,
        cardIds: ["c1"],
        activation: { source: "bundled_lesson", zeroSetup: true, startedAt: start, elapsedMs: 60_000 },
      }),
    ];

    const m = computeW5Metrics(events);
    expect(m.firstLoopCompleted).toBe(false);
    expect(m.dropoffStep).toBe("mistake");
  });

  it("reports save-phrase dropoff after first-run start", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("first_run_started", start, { source: "own_source", sourceId: "https://example.com/video" }),
    ]);

    expect(m.activationSource).toBe("own_source");
    expect(m.startedAt).toBe(start);
    expect(m.dropoffStep).toBe("save_phrase");
  });

  it("flags TTFR over the 2-minute activation gate", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_reviewed", start + TTFR_TARGET_MS + 1000, {
        count: 1,
        cardIds: ["c1"],
        activation: {
          source: "bundled_lesson",
          zeroSetup: true,
          startedAt: start,
          elapsedMs: TTFR_TARGET_MS + 1000,
        },
      }),
    ]);
    expect(m.ttfrUnderTarget).toBe(false);
  });

  it("reports own-source activation separately from bundled lessons", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_created", start + 30_000, {
        count: 3,
        source: "discover",
        activation: { source: "own_source", zeroSetup: false, startedAt: start, elapsedMs: 30_000 },
      }),
    ]);

    expect(m.activationSource).toBe("own_source");
    expect(m.timeToSavedPhraseMs).toBe(30_000);
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

  it("does not count a day-2 return as D+1 or D+7", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_created", start, { count: 5, source: "learn" }),
      event("cards_reviewed", start + 2 * DAY, { count: 1, cardIds: ["c1"] }),
    ]);
    expect(m.returnedDay1).toBe(false);
    expect(m.returnedDay7).toBe(false);
  });

  it("does not let a single late return satisfy the D+1 gate", () => {
    const start = Date.UTC(2026, 5, 1, 12, 0, 0);
    const m = computeW5Metrics([
      event("cards_created", start, { count: 5, source: "learn" }),
      event("cards_reviewed", start + 30 * DAY, { count: 1, cardIds: ["c1"] }),
    ]);
    expect(m.returnedDay1).toBe(false);
    expect(m.returnedDay7).toBe(true);
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
