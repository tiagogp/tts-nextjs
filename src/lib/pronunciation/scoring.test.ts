import { describe, expect, it } from "vitest";
import {
  assessPronunciationText,
  normalizePronunciationWords,
} from "@/lib/pronunciation/scoring";

describe("pronunciation scoring", () => {
  it("normalizes punctuation, case, and contractions", () => {
    expect(normalizePronunciationWords("I'm READY, aren't you?")).toEqual([
      "i",
      "am",
      "ready",
      "are",
      "not",
      "you",
    ]);
  });

  it("scores a perfect phrase highly", () => {
    const result = assessPronunciationText({
      targetText: "I would like a coffee.",
      transcript: "I would like a coffee.",
      durationMs: 2600,
      referenceDurationMs: 2600,
    });
    expect(result.scores.overall).toBeGreaterThanOrEqual(98);
    expect(result.words.every((word) => word.status === "match")).toBe(true);
  });

  it("flags omitted words", () => {
    const result = assessPronunciationText({
      targetText: "I would like a coffee.",
      transcript: "I like coffee.",
    });
    expect(result.words).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "would", status: "missing" }),
    ]));
    expect(result.scores.completeness).toBeLessThan(100);
  });

  it("flags close word substitutions", () => {
    const result = assessPronunciationText({
      targetText: "I want the blue one.",
      transcript: "I want the blew one.",
    });
    expect(result.words).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "blue", spoken: "blew", status: "close" }),
    ]));
  });

  it("penalizes extra words", () => {
    const result = assessPronunciationText({
      targetText: "See you tomorrow.",
      transcript: "See you tomorrow please.",
    });
    expect(result.words).toEqual(expect.arrayContaining([
      expect.objectContaining({ spoken: "please", status: "extra" }),
    ]));
    expect(result.scores.accuracy).toBeLessThan(100);
  });

  it("returns zero-ish scores for empty transcripts", () => {
    const result = assessPronunciationText({
      targetText: "Good morning.",
      transcript: "",
    });
    expect(result.scores.overall).toBeLessThan(50);
    expect(result.words.every((word) => word.status === "missing")).toBe(true);
  });
});
