import { describe, expect, it } from "vitest";
import { evaluateRecall, isVetoable, recordedCorrectness } from "./responseEvaluation";

describe("evaluateRecall", () => {
  it("ignores casing and punctuation", () => {
    expect(evaluateRecall("I'm running out of time.", "i'm running out of time").quality).toBe("correct");
  });

  it("accepts a shorter answer that keeps the meaning", () => {
    // The audit's case: correct English, punished by string distance alone.
    const evaluation = evaluateRecall("It depends on the situation.", "It depends");
    expect(evaluation.quality).toBe("correct");
    expect(evaluation.similarity).toBeLessThan(0.9);
  });

  it("accepts an authored alternative answer", () => {
    const evaluation = evaluateRecall("I'd rather not.", "I would prefer not to.", {
      acceptedAnswers: ["I would prefer not to."],
    });
    expect(evaluation.quality).toBe("correct");
    expect(evaluation.matchedAnswer).toBe("I would prefer not to.");
  });

  it("accepts any valid filling of the target frame", () => {
    const evaluation = evaluateRecall("I ended up staying home.", "I ended up cancelling the trip.", {
      frame: "I ended up ___",
    });
    expect(evaluation.quality).toBe("correct");
    expect(evaluation.patternUsed).toBe(true);
  });

  it("fails a response that abandons the target frame", () => {
    const evaluation = evaluateRecall("I ended up staying home.", "I finally stayed at home.", {
      frame: "I ended up ___",
    });
    expect(evaluation.quality).toBe("incorrect");
    expect(evaluation.literalOnly).toBe(false);
  });

  it("reads a contraction and its expansion as the same sentence", () => {
    // Both directions, because the A2 lessons contract and the C1 lessons spell out.
    const expanded = evaluateRecall("I don't eat meat.", "I do not eat meat.", { frame: "I don't ___" });
    expect(expanded.quality).toBe("correct");
    expect(expanded.patternUsed).toBe(true);

    const contracted = evaluateRecall("I do not think that is fair.", "I don't think that is fair.");
    expect(contracted.quality).toBe("correct");

    // A phone keyboard types a curly apostrophe; the authored file types a straight one.
    expect(evaluateRecall("I don't eat meat.", "I don\u2019t eat meat.").quality).toBe("correct");
  });

  it("takes an authored alternative for the contractions that have two readings", () => {
    // "I'd" is "I would" here and "I had" in "I'd never seen it", so no rule can expand it.
    // The card carries the reading its author meant.
    const guessed = evaluateRecall("I'd like a coffee, please.", "I would like a coffee, please.", {
      frame: "I'd like ___",
    });
    expect(guessed.quality).toBe("close");

    const authored = evaluateRecall("I'd like a coffee, please.", "I would like a coffee, please.", {
      frame: "I'd like ___",
      acceptedAnswers: ["I would like a coffee, please."],
    });
    expect(authored.quality).toBe("correct");
  });

  it("calls the meaning without the pattern close, not wrong", () => {
    // Every lesson phrase now carries a frame, so this is the "It depends" case again —
    // this time with the frame present. Off-pattern is a real miss, but the learner still
    // produced valid English carrying the meaning: Hard is available, Again is not forced.
    const evaluation = evaluateRecall("It depends on the situation.", "It depends", {
      frame: "It depends on ___",
    });
    expect(evaluation.quality).toBe("close");
    expect(evaluation.patternUsed).toBe(false);
    expect(evaluation.literalOnly).toBe(false);
  });

  it("names a transfer error instead of only scoring the string", () => {
    const evaluation = evaluateRecall("I am a student.", "I am student.");
    expect(evaluation.formIssues.map((issue) => issue.type)).not.toHaveLength(0);
    expect(evaluation.quality).not.toBe("correct");
    expect(evaluation.literalOnly).toBe(false);
  });

  it("marks an unrelated answer as unjudgeable rather than certainly wrong", () => {
    const evaluation = evaluateRecall("I ran out of time.", "The weather is good today.");
    expect(evaluation.quality).toBe("incorrect");
    expect(evaluation.literalOnly).toBe(true);
  });

  it("treats an empty answer as observed, not unjudgeable", () => {
    const evaluation = evaluateRecall("I ran out of time.", "   ");
    expect(evaluation.quality).toBe("incorrect");
    expect(evaluation.literalOnly).toBe(false);
  });
});

describe("grade veto", () => {
  it("restricts grades only on observed evidence", () => {
    expect(isVetoable(evaluateRecall("I am a student.", "I am student."))).toBe(true);
    expect(isVetoable(evaluateRecall("I ended up staying.", "I stayed.", { frame: "I ended up ___" }))).toBe(true);
    expect(isVetoable(evaluateRecall("I ran out of time.", "The weather is good today."))).toBe(false);
    expect(isVetoable(evaluateRecall("It depends on the situation.", "It depends"))).toBe(false);
  });
});

describe("recorded correctness", () => {
  it("records null rather than a failure when the check could not judge", () => {
    expect(recordedCorrectness(evaluateRecall("I ran out of time.", "The weather is good today."))).toBeUndefined();
    expect(recordedCorrectness(evaluateRecall("I am a student.", "I am student."))).toBe(false);
    expect(recordedCorrectness(evaluateRecall("It depends on the situation.", "It depends"))).toBe(true);
    expect(recordedCorrectness(undefined)).toBeUndefined();
  });
});
