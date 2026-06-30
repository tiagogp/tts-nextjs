import { describe, expect, it } from "vitest";
import { computeUnlockedTabTier, tabsForUnlockTier } from "./useUnlockedTabs";

describe("unlocked tabs", () => {
  it("starts with the beginner loop only", () => {
    expect(tabsForUnlockTier(0)).toEqual(["hoje", "study", "discover"]);
  });

  it("keeps advanced correction hidden until mistakes exist", () => {
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0 })).toBe(1);
    expect(tabsForUnlockTier(1)).toEqual(["hoje", "study", "discover"]);

    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 0 })).toBe(2);
    expect(tabsForUnlockTier(2)).toEqual(["hoje", "study", "discover"]);

    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 1 })).toBe(3);
    expect(tabsForUnlockTier(3)).toEqual(["hoje", "study", "discover", "correct"]);
  });

  it("is monotonic against the stored tier", () => {
    expect(computeUnlockedTabTier({ cards: 0, reviews: 0, errorEvents: 0 }, 3)).toBe(3);
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0 }, 2)).toBe(2);
  });
});
