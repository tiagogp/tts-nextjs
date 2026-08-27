import { describe, expect, it } from "vitest";
import { LESSONS } from "@/features/learn/lessonDeck";
import {
  buildPlacementCheck,
  gradePlacement,
  PLACEMENT_BANDS,
  type PlacementAnswers,
  type PlacementCheck,
} from "./placement";

function answerAll(check: PlacementCheck, predicate: (band: string) => boolean): PlacementAnswers {
  return {
    items: check.items.map((item) => (predicate(item.band) ? item.answer : "definitely wrong")),
    writingSample: "",
    selfRating: null,
  };
}

describe("local placement check", () => {
  it("builds a check from bundled lessons with no provider involved", () => {
    const check = buildPlacementCheck(LESSONS, 0);

    expect(check.items.length).toBeGreaterThanOrEqual(PLACEMENT_BANDS.length);
    for (const item of check.items) {
      expect(PLACEMENT_BANDS).toContain(item.band);
      if (item.kind === "listening") {
        expect(item.options).toContain(item.answer);
        expect(new Set(item.options).size).toBe(item.options.length);
        expect(item.clip).toMatch(/^\/learn\/audio\/.+\.wav$/);
      } else {
        expect(item.sentence).toContain("___");
        expect(item.sentence).not.toContain(item.answer);
      }
    }
    expect(check.writing.prompt.length).toBeGreaterThan(0);
  });

  it("varies drawn items and answer slots between runs", () => {
    const first = buildPlacementCheck(LESSONS, 1);
    const second = buildPlacementCheck(LESSONS, 8);
    expect(first.items).not.toEqual(second.items);
    // Same seed → same check, so a learner can be handed the identical retake.
    expect(buildPlacementCheck(LESSONS, 1)).toEqual(first);
  });

  it("suggests the highest band held with no gap below it", () => {
    const check = buildPlacementCheck(LESSONS, 3);
    const throughA2 = gradePlacement(check, answerAll(check, (band) => band === "A1" || band === "A2"));
    expect(throughA2.outcome).toBe("suggested");
    expect(throughA2.suggestedLevel).toBe("A2");

    // B1 right but A2 wrong is noise, not a B1 learner.
    const gapped = gradePlacement(check, answerAll(check, (band) => band === "A1" || band === "B1"));
    expect(gapped.suggestedLevel).toBe("A1");
  });

  it("reports insufficient evidence instead of guessing a level", () => {
    const check = buildPlacementCheck(LESSONS, 5);
    const result = gradePlacement(check, {
      items: check.items.map((_, index) => (index === 0 ? check.items[0].answer : null)),
      writingSample: "",
      selfRating: null,
    });

    expect(result.outcome).toBe("insufficient");
    expect(result.suggestedLevel).toBeNull();
  });

  it("never lets the self-assessed writing move the suggested level", () => {
    const check = buildPlacementCheck(LESSONS, 7);
    const objective = answerAll(check, (band) => band === "A1");

    const modest = gradePlacement(check, { ...objective, writingSample: "I go work.", selfRating: "struggled" });
    const confident = gradePlacement(check, {
      ...objective,
      writingSample: "I go work.",
      selfRating: "comfortable",
    });

    expect(confident.suggestedLevel).toBe(modest.suggestedLevel);
    expect(confident.writingCountsTowardLevel).toBe(false);
    // Kept as the learner's own evidence, just not as a score.
    expect(confident.selfRating).toBe("comfortable");
    expect(confident.writingSample).toBe("I go work.");
  });
});
