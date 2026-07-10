import { describe, expect, it } from "vitest";
import {
  endOfTomorrowLocal,
  localDayIndex,
  mistakeCardStats,
  returnMomentFor,
  type DueCardLike,
} from "./returnMoment";

/** Local-time timestamp builder so assertions hold in any timezone. */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

const NOW = at(2026, 7, 9);
const YESTERDAY = at(2026, 7, 8);
const TWO_DAYS_AGO = at(2026, 7, 7);
const WEEK_AGO = at(2026, 7, 2);

function errorCard(errorId: string): DueCardLike {
  return { source: { kind: "error", id: errorId } };
}

function phraseCard(): DueCardLike {
  return { source: { kind: "phrase", id: "candidate-1" } };
}

describe("returnMomentFor", () => {
  it("returns null with nothing due", () => {
    expect(
      returnMomentFor({ dueCards: [], activity: [{ ts: YESTERDAY }], errors: [], now: NOW }),
    ).toBeNull();
  });

  it("returns null on the learner's first active day — nothing to return to", () => {
    expect(
      returnMomentFor({
        dueCards: [phraseCard()],
        activity: [{ ts: at(2026, 7, 9, 8) }],
        errors: [],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("fires on D+1 and attributes a due card to yesterday's error", () => {
    const moment = returnMomentFor({
      dueCards: [phraseCard(), errorCard("err-1")],
      activity: [{ ts: YESTERDAY }],
      errors: [{ id: "err-1", createdAt: YESTERDAY }],
      now: NOW,
    });
    expect(moment).toEqual({ due: 2, mistakeCards: 1, fromYesterday: true });
  });

  it("fires on every return day, not only D+1 (D+2 and D+7 regression)", () => {
    for (const firstTs of [TWO_DAYS_AGO, WEEK_AGO]) {
      const moment = returnMomentFor({
        dueCards: [errorCard("err-1")],
        activity: [{ ts: firstTs }],
        errors: [{ id: "err-1", createdAt: firstTs }],
        now: NOW,
      });
      expect(moment).toEqual({ due: 1, mistakeCards: 1, fromYesterday: false });
    }
  });

  it("never claims a mistake without a due card behind it (overclaim regression)", () => {
    // Yesterday's error produced no card — the old errorEvents-based count said 1.
    const moment = returnMomentFor({
      dueCards: [phraseCard()],
      activity: [{ ts: YESTERDAY }],
      errors: [{ id: "err-unconverted", createdAt: YESTERDAY }],
      now: NOW,
    });
    expect(moment).toEqual({ due: 1, mistakeCards: 0, fromYesterday: false });
  });

  it("uses the 'yesterday' variant only when the source error is from yesterday", () => {
    const moment = returnMomentFor({
      dueCards: [errorCard("err-old")],
      activity: [{ ts: WEEK_AGO }, { ts: YESTERDAY }],
      errors: [{ id: "err-old", createdAt: WEEK_AGO }],
      now: NOW,
    });
    expect(moment).toEqual({ due: 1, mistakeCards: 1, fromYesterday: false });
  });
});

describe("mistakeCardStats", () => {
  it("counts errorType-tagged cards even without an error source ref", () => {
    const stats = mistakeCardStats(
      [{ source: { kind: "phrase", id: "p1" }, errorType: "preposition" } as DueCardLike],
      [],
      localDayIndex(NOW),
    );
    expect(stats).toEqual({ mistakeCards: 1, fromMatchDay: false });
  });

  it("flags fromMatchDay when a source error was made on the match day", () => {
    const stats = mistakeCardStats(
      [errorCard("err-today")],
      [{ id: "err-today", createdAt: at(2026, 7, 9, 9) }],
      localDayIndex(NOW),
    );
    expect(stats).toEqual({ mistakeCards: 1, fromMatchDay: true });
  });
});

describe("endOfTomorrowLocal", () => {
  it("includes all of tomorrow and excludes the day after", () => {
    const horizon = endOfTomorrowLocal(NOW);
    expect(at(2026, 7, 10, 23)).toBeLessThanOrEqual(horizon);
    expect(at(2026, 7, 11, 0)).toBeGreaterThan(horizon);
  });
});
