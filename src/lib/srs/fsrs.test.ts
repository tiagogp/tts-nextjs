import { describe, expect, it } from "vitest";
import {
  Rating,
  applyGrade,
  initialSrs,
  recallProbability,
  recallProbabilityAt,
} from "./fsrs";

describe("recallProbability", () => {
  it("returns a probability in [0, 1]", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const reviewed = applyGrade(initialSrs("c1", now), Rating.Good, now).next;
    const p = recallProbability(reviewed, now);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it("decays as time passes after a review", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const reviewed = applyGrade(initialSrs("c1", now), Rating.Good, now).next;
    const soon = recallProbability(reviewed, now);
    const later = recallProbability(reviewed, new Date(now.getTime() + 30 * 86_400_000));
    expect(later).toBeLessThanOrEqual(soon);
  });

  it("recallProbabilityAt matches recallProbability at the same offset", () => {
    const reviewed = applyGrade(initialSrs("c1"), Rating.Easy).next;
    const viaAt = recallProbabilityAt(reviewed, 24);
    const viaAbsolute = recallProbability(reviewed, new Date(Date.now() + 24 * 3600_000));
    expect(viaAt).toBeCloseTo(viaAbsolute, 5);
  });
});
