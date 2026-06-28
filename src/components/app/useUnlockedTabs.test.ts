import { describe, expect, it } from "vitest";
import { computeUnlockedTabTier, tabsForUnlockTier } from "./useUnlockedTabs";

describe("unlocked tabs", () => {
  it("starts with Today and Study only", () => {
    expect(tabsForUnlockTier(0)).toEqual(["hoje", "study"]);
  });

  it("unlocks Discover, Speak, then Correct by maturity signals", () => {
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0 })).toBe(1);
    expect(tabsForUnlockTier(1)).toEqual(["hoje", "discover", "study"]);

    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 0 })).toBe(2);
    expect(tabsForUnlockTier(2)).toEqual(["hoje", "discover", "study", "speak"]);

    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 1 })).toBe(3);
    expect(tabsForUnlockTier(3)).toEqual(["hoje", "discover", "study", "correct", "speak"]);
  });

  it("is monotonic against the stored tier", () => {
    expect(computeUnlockedTabTier({ cards: 0, reviews: 0, errorEvents: 0 }, 3)).toBe(3);
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0 }, 2)).toBe(2);
  });
});
