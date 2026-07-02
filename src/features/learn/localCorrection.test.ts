import { describe, expect, it } from "vitest";
import {
  CAPITAL_I_NOTE,
  correctSentenceLocally,
  PHRASE_SPELLING_NOTE,
  PUNCTUATION_NOTE,
  SENTENCE_START_NOTE,
} from "./localCorrection";

describe("correctSentenceLocally", () => {
  it("leaves a correct sentence untouched", () => {
    const result = correctSentenceLocally("Good morning, teacher.", "Good morning.");
    expect(result.corrected).toBe("Good morning, teacher.");
    expect(result.issues).toEqual([]);
    expect(result.usedPhrase).toBe(true);
  });

  it("fixes sentence casing and missing punctuation", () => {
    const result = correctSentenceLocally("good morning teacher", "Good morning.");
    expect(result.corrected).toBe("Good morning teacher.");
    expect(result.issues.map((i) => i.note)).toEqual([SENTENCE_START_NOTE, PUNCTUATION_NOTE]);
  });

  it("corrects a misspelled lesson phrase and capital I", () => {
    const result = correctSentenceLocally("i say helo to my friend", "Hello.");
    expect(result.corrected).toBe("I say hello to my friend.");
    expect(result.issues.map((i) => i.note)).toEqual([
      PHRASE_SPELLING_NOTE,
      CAPITAL_I_NOTE,
      PUNCTUATION_NOTE,
    ]);
    expect(result.usedPhrase).toBe(true);
  });

  it("keeps the phrase's own question mark when the sentence ends with it", () => {
    const result = correctSentenceLocally("how are you", "How are you?");
    expect(result.corrected).toBe("How are you?");
    expect(result.issues.map((i) => i.note)).toEqual([SENTENCE_START_NOTE, PUNCTUATION_NOTE]);
  });

  it("capitalizes I contractions anywhere in the sentence", () => {
    const result = correctSentenceLocally("Yes, i'm fine thanks.", "I'm fine, thanks.");
    expect(result.corrected).toBe("Yes, I'm fine thanks.");
    expect(result.issues.map((i) => i.note)).toEqual([CAPITAL_I_NOTE]);
    expect(result.usedPhrase).toBe(true);
  });

  it("keeps the learner's trailing punctuation when replacing a misspelled phrase", () => {
    const result = correctSentenceLocally("I say god morning! every day.", "Good morning.");
    expect(result.corrected).toBe("I say good morning! every day.");
    expect(result.issues.map((i) => i.note)).toEqual([PHRASE_SPELLING_NOTE]);
  });

  it("reports when the phrase is not used, without inventing issues", () => {
    const result = correctSentenceLocally("I like coffee.", "Good evening.");
    expect(result.usedPhrase).toBe(false);
    expect(result.corrected).toBe("I like coffee.");
    expect(result.issues).toEqual([]);
  });

  it("does not match a completely different word as the phrase", () => {
    const result = correctSentenceLocally("Hi there.", "Hello.");
    expect(result.usedPhrase).toBe(false);
  });

  it("handles empty input", () => {
    const result = correctSentenceLocally("   ", "Hello.");
    expect(result.corrected).toBe("");
    expect(result.issues).toEqual([]);
    expect(result.usedPhrase).toBe(false);
  });

  it("collapses repeated whitespace silently", () => {
    const result = correctSentenceLocally("Good   morning.", "Good morning.");
    expect(result.corrected).toBe("Good morning.");
    expect(result.issues).toEqual([]);
  });
});
