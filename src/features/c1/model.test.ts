import { describe, expect, it } from "vitest";
import { groupRefinementsByDimension } from "./model";
import type { RefinementDimension, RefinementEvent } from "@/lib/cards/schema";

function refinement(dimension: RefinementDimension, original: string): RefinementEvent {
  return {
    id: crypto.randomUUID(),
    original,
    suggested: `${original} (native)`,
    dimension,
    sourceLang: "pt",
    targetLang: "en",
    createdAt: Date.now(),
  };
}

describe("groupRefinementsByDimension", () => {
  it("ranks the most frequent dimension first", () => {
    const refinements = [
      refinement("collocation", "make a research"),
      refinement("collocation", "do a mistake"),
      refinement("register", "gonna talk about"),
    ];

    const gaps = groupRefinementsByDimension(refinements);

    expect(gaps[0].dimension).toBe("collocation");
    expect(gaps[0].count).toBe(2);
    expect(gaps[1].dimension).toBe("register");
    expect(gaps[1].count).toBe(1);
  });

  it("keeps the flagged fragments as evidence next to each gap", () => {
    const refinements = [refinement("idiom", "kick the bucket list")];

    const [gap] = groupRefinementsByDimension(refinements);

    expect(gap.examples).toHaveLength(1);
    expect(gap.examples[0].original).toBe("kick the bucket list");
  });

  it("caps examples per dimension without dropping the count", () => {
    const refinements = [
      refinement("precision", "a"),
      refinement("precision", "b"),
      refinement("precision", "c"),
      refinement("precision", "d"),
    ];

    const [gap] = groupRefinementsByDimension(refinements);

    expect(gap.count).toBe(4);
    expect(gap.examples).toHaveLength(3);
  });

  it("returns an empty list for no refinements", () => {
    expect(groupRefinementsByDimension([])).toEqual([]);
  });
});
