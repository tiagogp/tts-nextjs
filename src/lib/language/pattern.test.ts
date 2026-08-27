import { describe, expect, it } from "vitest";
import { contentLemmas, contentOverlap, frameLemmas, isDrillablePattern, isNovelFilling, lemma, slotFilling, tokenize, usesFrame } from "./pattern";

const ENDED_UP = {
  id: "ended-up",
  frame: "I ended up ___",
  slot: "-ing verb phrase",
  examples: ["I ended up staying home.", "I ended up buying it.", "I ended up leaving early."],
  contrast: "I ended up to stay home.",
};

describe("tokenize", () => {
  it("expands the contractions with one reading and leaves the ambiguous ones alone", () => {
    expect(tokenize("I don't eat meat.")).toEqual(tokenize("I do not eat meat"));
    expect(tokenize("We're late.")).toEqual(tokenize("We are late"));
    expect(tokenize("I've seen it.")).toEqual(tokenize("I have seen it"));
    expect(tokenize("We'll wait.")).toEqual(tokenize("We will wait"));
    expect(tokenize("I can't come.")).toEqual(tokenize("I cannot come"));
    expect(tokenize("We won't be late.")).toEqual(tokenize("We will not be late"));
    expect(tokenize("Let's go.")).toEqual(tokenize("Let us go"));
    // A curly apostrophe is the same word as a straight one.
    expect(tokenize("I don\u2019t")).toEqual(tokenize("I don't"));
    // "he's" is "he is" or "he has" and "I'd" is "I would" or "I had": guessing either way
    // would let the app call wrong English right, so both stay as written.
    expect(tokenize("He's gone.")).not.toEqual(tokenize("He is gone"));
    expect(tokenize("I'd go.")).not.toEqual(tokenize("I would go"));
  });

  it("keeps a possessive out of the expansion", () => {
    expect(tokenize("my sister's place")).toEqual(["my", "sister's", "place"]);
  });
});

describe("frame matching", () => {
  it("accepts a new filling of the taught frame", () => {
    expect(usesFrame("I ended up walking there.", ENDED_UP.frame)).toBe(true);
  });

  it("accepts extra words around the frame", () => {
    expect(usesFrame("Honestly I ended up paying twice.", ENDED_UP.frame)).toBe(true);
  });

  it("rejects a sentence that drops the frame", () => {
    expect(usesFrame("I finally stayed home.", ENDED_UP.frame)).toBe(false);
  });

  it("rejects the frame with an empty slot", () => {
    expect(usesFrame("I ended up.", ENDED_UP.frame)).toBe(false);
  });

  it("reports undefined rather than false when no frame is authored", () => {
    expect(usesFrame("I ended up staying.", undefined)).toBeUndefined();
    expect(usesFrame("I ended up staying.", "   ")).toBeUndefined();
  });

  it("ignores casing, accents and punctuation", () => {
    expect(usesFrame("i ENDED up — staying home!", ENDED_UP.frame)).toBe(true);
  });
});

describe("slot filling", () => {
  it("returns only the learner's own content words", () => {
    expect(slotFilling("I ended up walking there", ENDED_UP.frame)).toEqual(["walk"]);
  });

  it("treats a filling seen in the examples as not novel", () => {
    expect(isNovelFilling("I ended up buying it.", ENDED_UP)).toBe(false);
  });

  it("treats an unseen filling as novel", () => {
    expect(isNovelFilling("I ended up cancelling the trip.", ENDED_UP)).toBe(true);
  });

  it("is not fooled by inflection of a taught filling", () => {
    expect(isNovelFilling("I ended up buy it.", ENDED_UP)).toBe(false);
  });
});

describe("content overlap", () => {
  it("is 0 when the learner reuses none of the source content beyond the frame", () => {
    expect(contentOverlap(
      "I ended up cancelling the trip.",
      "I ended up staying home.",
      frameLemmas(ENDED_UP.frame),
    )).toBe(0);
  });

  it("counts the frame itself as reuse when the caller does not exclude it", () => {
    expect(contentOverlap("I ended up cancelling the trip.", "I ended up staying home.")).toBeGreaterThan(0);
  });

  it("is 1 when the learner repeats the source sentence", () => {
    expect(contentOverlap("I ended up staying home.", "I ended up staying home.")).toBe(1);
  });

  it("counts a longer sentence that swallows the original as reuse", () => {
    expect(contentOverlap(
      "I ended up staying home again",
      "I ended up staying home.",
      frameLemmas(ENDED_UP.frame),
    )).toBeGreaterThan(0.5);
  });
});

describe("lemma", () => {
  it("folds common inflections together", () => {
    expect(lemma("buying")).toBe("buy");
    expect(lemma("studies")).toBe("study");
    expect(lemma("running")).toBe("run");
    expect(lemma("worked")).toBe("work");
  });

  it("leaves short words alone", () => {
    expect(lemma("was")).toBe("was");
  });

  it("does not stem a word that merely ends in a suffix's letters", () => {
    expect(lemma("thing")).toBe("thing");
    expect(lemma("bus")).toBe("bus");
  });

  it("drops function words from the content set", () => {
    expect([...contentLemmas("I ended up with the thing")]).toEqual(["end", "thing"]);
  });
});

describe("drillability", () => {
  it("requires a slot and two grounded examples", () => {
    expect(isDrillablePattern(ENDED_UP)).toBe(true);
    expect(isDrillablePattern({ id: "x", frame: "I ended up ___", slot: "verb", examples: ["one"] })).toBe(false);
    expect(isDrillablePattern({ id: "x", frame: "I agree", slot: "verb", examples: ["a", "b"] })).toBe(false);
    expect(isDrillablePattern(undefined)).toBe(false);
  });
});

describe("two-slot frames", () => {
  const VERY = {
    id: "very-adjective",
    frame: "___ is very ___",
    slot: "thing + adjective",
    examples: ["The food is very good.", "The coffee is very strong.", "The room is very small."],
  };

  it("matches both slots filled", () => {
    expect(usesFrame("The service is very slow.", VERY.frame)).toBe(true);
  });

  it("excludes the frame's own words from both sides", () => {
    expect(frameLemmas(VERY.frame).has("very")).toBe(false); // "very" is a function word
    expect(slotFilling("The service is very slow.", VERY.frame)).toEqual(["service", "slow"]);
  });

  it("still detects a taught filling as not novel", () => {
    expect(isNovelFilling("The food is very good.", VERY)).toBe(false);
    expect(isNovelFilling("The service is very slow.", VERY)).toBe(true);
  });
});
