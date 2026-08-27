import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { buildPatternDrills, drillablePatterns, gradeDrill } from "./patternDrills";

const card = (overrides: Partial<Card> = {}): Card => ({
  id: "c1",
  front: "Acabei ficando em casa.",
  back: "I ended up staying home.",
  direction: "production",
  concept: "unplanned outcome",
  patternId: "ended-up",
  patternFrame: "I ended up ___",
  patternSlot: "-ing verb phrase",
  patternContrast: "I ended up to stay home.",
  examples: ["I ended up staying home.", "I ended up buying it.", "I ended up leaving early."],
  source: { kind: "phrase", id: "p1" },
  createdAt: 1,
  ...overrides,
});

describe("drillablePatterns", () => {
  it("skips a card whose pattern is a family of one", () => {
    expect(drillablePatterns([card({ examples: ["I ended up staying home."] })])).toHaveLength(0);
  });

  it("skips a card with no frame", () => {
    expect(drillablePatterns([card({ patternFrame: undefined })])).toHaveLength(0);
  });

  it("returns one drill per family, not per card direction", () => {
    const production = card({ id: "p" });
    const recognition = card({ id: "r", direction: "recognition" });
    expect(drillablePatterns([production, recognition])).toHaveLength(1);
  });
});

describe("slot substitution", () => {
  const [drill] = buildPatternDrills([card()]);

  it("shows the frame and the fillings already used", () => {
    expect(drill.kind).toBe("slot_substitution");
    expect(drill.promptVars?.frame).toBe("I ended up ___");
    expect(drill.promptVars?.taught).toContain("I ended up buying it.");
  });

  it("passes a new filling in valid English", () => {
    const result = gradeDrill(drill, "I ended up cancelling the trip.");
    expect(result.passed).toBe(true);
    expect(result.filling).toContain("cancel");
  });

  it("fails a filling the app already taught", () => {
    expect(gradeDrill(drill, "I ended up buying it.").passed).toBe(false);
  });

  it("fails a response that drops the frame", () => {
    expect(gradeDrill(drill, "I finally cancelled the trip.").passed).toBe(false);
  });

  it("fails a new filling with a transfer error", () => {
    // "depend of" is a named PT->EN transfer error; the frame alone must not carry it.
    expect(gradeDrill(drill, "I ended up depending of him.").passed).toBe(false);
  });
});

describe("new situation", () => {
  const [drill] = buildPatternDrills([card()], { stageOf: () => "new_situation" });

  it("does not put the frame in the prompt", () => {
    expect(drill.prompt).not.toContain("{frame}");
    expect(drill.promptVars?.frame).toBeUndefined();
  });

  it("passes only when the content is genuinely the learner's", () => {
    expect(gradeDrill(drill, "I ended up missing my train to work.").passed).toBe(true);
    expect(gradeDrill(drill, "I ended up staying at home again.").passed).toBe(false);
  });
});

describe("minimal pair", () => {
  const [drill] = buildPatternDrills([card()], { stageOf: () => "minimal_pair" });

  it("offers the correct and the contrasting form", () => {
    expect(drill.options).toHaveLength(2);
    expect(drill.options).toContain("I ended up staying home.");
    expect(drill.options).toContain("I ended up to stay home.");
  });

  it("does not always place the answer first", () => {
    const positions = new Set<number>();
    for (const id of ["ended-up", "worth-it", "tend-to", "used-to", "keep-gerund", "in-the-end"]) {
      const [pair] = buildPatternDrills([card({ patternId: id })], { stageOf: () => "minimal_pair" });
      positions.add(pair.options!.indexOf(pair.answer!));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it("grades the choice", () => {
    expect(gradeDrill(drill, "I ended up staying home.").passed).toBe(true);
    expect(gradeDrill(drill, "I ended up to stay home.").passed).toBe(false);
  });
});

describe("constrained cloze", () => {
  it("names the frame and what fills it", () => {
    const [drill] = buildPatternDrills([card()], { stageOf: () => "constrained_cloze" });
    expect(drill.promptVars?.slot).toBe("-ing verb phrase");
    expect(gradeDrill(drill, "I ended up working through lunch.").passed).toBe(true);
  });
});
