import { describe, expect, it } from "vitest";
import { tomorrowLine, type TomorrowPreview } from "./SessionSummary";

/** Passthrough t() that interpolates like the real helper. */
function t(en: string, vars?: Record<string, string | number>): string {
  return en.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}

function line(preview: TomorrowPreview): string {
  return tomorrowLine(preview, t);
}

describe("tomorrowLine", () => {
  it("says nothing is due without inventing urgency", () => {
    expect(line({ due: 0, mistakeCards: 0, fromToday: false })).toBe(
      "Nothing due tomorrow yet — the next review arrives right on time.",
    );
  });

  it("names today's mistake when a due card carries it", () => {
    expect(line({ due: 3, mistakeCards: 1, fromToday: true })).toBe(
      "Tomorrow: 3 phrases are waiting — 1 came from today's mistake.",
    );
    expect(line({ due: 4, mistakeCards: 2, fromToday: true })).toBe(
      "Tomorrow: 4 phrases are waiting — 2 came from today's mistakes.",
    );
    expect(line({ due: 1, mistakeCards: 1, fromToday: true })).toBe(
      "Tomorrow: the phrase from today's mistake is waiting for you.",
    );
  });

  it("makes no mistake claim when the due cards are not error-derived", () => {
    expect(line({ due: 2, mistakeCards: 0, fromToday: false })).toBe(
      "Tomorrow: 2 phrases are waiting for you.",
    );
    expect(line({ due: 1, mistakeCards: 0, fromToday: false })).toBe(
      "Tomorrow: 1 phrase is waiting for you.",
    );
    // Older mistakes are still just "waiting" — the "today" claim needs today's error.
    expect(line({ due: 2, mistakeCards: 1, fromToday: false })).toBe(
      "Tomorrow: 2 phrases are waiting for you.",
    );
  });
});
