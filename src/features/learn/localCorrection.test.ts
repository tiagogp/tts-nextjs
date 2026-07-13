import { describe, expect, it } from "vitest";
import {
  CAPITAL_I_NOTE,
  correctSentenceLocally,
  mergeEvaluatedCorrection,
  MISSING_LESSON_LANGUAGE_NOTE,
  OWN_DETAIL_NOTE,
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
    expect(result.issues.map((i) => i.note)).toEqual([
      OWN_DETAIL_NOTE,
      SENTENCE_START_NOTE,
      PUNCTUATION_NOTE,
    ]);
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

  it("prioritizes missing lesson language as blocking feedback", () => {
    const result = correctSentenceLocally("I like coffee.", "Good evening.");
    expect(result.usedPhrase).toBe(false);
    expect(result.corrected).toBe("I like coffee.");
    expect(result.issues.map((issue) => issue.note)).toEqual([MISSING_LESSON_LANGUAGE_NOTE]);
    expect(result.issues[0]).toMatchObject({
      category: "lessonLanguage",
      priority: "blocking",
    });
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
    expect(result.issues.map((issue) => issue.note)).toEqual([OWN_DETAIL_NOTE]);
  });

  it("accepts an adapted reusable pattern instead of forcing placeholder text", () => {
    const result = correctSentenceLocally(
      "My name is Tiago.",
      "My name is Ana.",
      "my name is",
    );
    expect(result.usedPhrase).toBe(true);
    expect(result.corrected).toBe("My name is Tiago.");
    expect(result.issues).toEqual([]);
  });

  it("matches a reusable pattern across a contraction", () => {
    const result = correctSentenceLocally("I'm Tiago.", "I'm Pedro.", "I am");
    expect(result.usedPhrase).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("infers a reusable leading frame when the concept is descriptive", () => {
    const result = correctSentenceLocally(
      "I'm from Cuiaba.",
      "I'm from a small city.",
      "from a place",
    );
    expect(result.usedPhrase).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("requires a personal detail when only the model phrase is repeated", () => {
    const result = correctSentenceLocally("Hello.", "Hello.", "basic greeting");
    expect(result.issues.map((issue) => issue.note)).toEqual([OWN_DETAIL_NOTE]);
    expect(result.issues[0]).toMatchObject({
      category: "messageClarity",
      priority: "blocking",
    });
  });

  it("merges general grammar feedback from a configured evaluator", () => {
    const result = mergeEvaluatedCorrection(
      "I have 25 years and I'm happy.",
      "I'm happy.",
      "I am",
      [
        {
          id: "age-error",
          original: "have 25 years",
          corrected: "am 25 years old",
          errorTypes: ["other"],
          sourceLang: "pt",
          targetLang: "en",
          rationale: "Use be, not have, to state your age in English.",
          createdAt: 1,
        },
      ],
    );

    expect(result.corrected).toBe("I am 25 years old and I'm happy.");
    expect(result.usedPhrase).toBe(true);
    expect(result.issues[0]).toMatchObject({
      category: "lessonLanguage",
      priority: "blocking",
      note: "Use be, not have, to state your age in English.",
    });
  });

  it("uses evaluator feedback to flag meaning and vocabulary problems", () => {
    const result = mergeEvaluatedCorrection(
      "I'm boring at the party.",
      "I'm bored.",
      "I am",
      [
        {
          id: "meaning-error",
          original: "boring",
          corrected: "bored",
          errorTypes: ["vocabulary"],
          sourceLang: "pt",
          targetLang: "en",
          rationale: "Bored describes how you feel; boring describes what causes that feeling.",
          createdAt: 1,
        },
      ],
    );

    expect(result.corrected).toBe("I'm bored at the party.");
    expect(result.issues[0]).toMatchObject({
      category: "messageClarity",
      priority: "blocking",
    });
  });
});
