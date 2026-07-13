import { describe, expect, it } from "vitest";
import {
  evaluateAttempt,
  gradeObjectiveSections,
  retakeAvailableAt,
  validateLevelTest,
  validateWritingGrade,
  RETAKE_COOLDOWN_DAYS,
  type LevelTestAnswers,
  type LevelTestContent,
  type StoredLevelTestAttempt,
  type WritingGradeSummary,
} from "./testModel";

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 6, 1);

function content(): LevelTestContent {
  return {
    comprehension: {
      passage: "Maria works at a hospital. She starts early and finishes late.",
      questions: [
        { prompt: "Where does Maria work?", options: ["A school", "A hospital", "A shop", "A farm"], answerIndex: 1 },
        { prompt: "When does she start?", options: ["Early", "Late", "At noon", "Never"], answerIndex: 0 },
        { prompt: "When does she finish?", options: ["Early", "At noon", "Late", "Never"], answerIndex: 2 },
      ],
    },
    fillIn: [
      { sentence: "She ___ to work every day.", acceptedAnswers: ["goes", "walks"] },
      { sentence: "I ___ born in Brazil.", acceptedAnswers: ["was"] },
      { sentence: "They ___ playing now.", acceptedAnswers: ["are"] },
      { sentence: "He ___ like coffee.", acceptedAnswers: ["doesn't", "does not"] },
      { sentence: "We ___ seen it before.", acceptedAnswers: ["have"] },
    ],
    writing: { prompt: "Describe your last weekend in a few sentences." },
  };
}

function rawContent(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(content()));
}

function perfectAnswers(): LevelTestAnswers {
  return { comprehension: [1, 0, 2], fillIn: ["goes", "was", "are", "doesn't", "have"] };
}

function writingGrade(overrides: Partial<WritingGradeSummary> = {}): WritingGradeSummary {
  return { score: 75, bandFit: "at", feedback: "Solid range for the band.", ...overrides };
}

function attempt(overrides: Partial<StoredLevelTestAttempt> = {}): StoredLevelTestAttempt {
  return {
    id: crypto.randomUUID(),
    fromLevel: "A1",
    targetLevel: "A2",
    createdAt: NOW - DAY_MS,
    test: { id: "t1", targetLevel: "A2", ...content() },
    answers: perfectAnswers(),
    writingSample: "Last weekend I visited my family.",
    evaluation: evaluateAttempt(content(), perfectAnswers(), writingGrade()),
    passed: false,
    ...overrides,
  };
}

describe("validateLevelTest", () => {
  it("accepts a well-formed test", () => {
    expect(validateLevelTest(rawContent())).not.toBeNull();
  });

  it("rejects wrong question counts, missing blanks, and bad answer indexes", () => {
    const short = rawContent();
    (short.fillIn as unknown[]).pop();
    expect(validateLevelTest(short)).toBeNull();

    const noBlank = rawContent();
    (noBlank.fillIn as { sentence: string }[])[0].sentence = "She goes to work.";
    expect(validateLevelTest(noBlank)).toBeNull();

    const badIndex = rawContent();
    (badIndex.comprehension as { questions: { answerIndex: number }[] }).questions[0].answerIndex = 4;
    expect(validateLevelTest(badIndex)).toBeNull();

    expect(validateLevelTest(null)).toBeNull();
    expect(validateLevelTest("passage")).toBeNull();
  });
});

describe("validateWritingGrade", () => {
  it("accepts and clamps a valid grade", () => {
    expect(validateWritingGrade({ score: 130.7, bandFit: "at", feedback: "ok" })).toEqual({
      score: 100,
      bandFit: "at",
      feedback: "ok",
    });
  });

  it("rejects unknown bandFit or missing feedback", () => {
    expect(validateWritingGrade({ score: 70, bandFit: "great", feedback: "ok" })).toBeNull();
    expect(validateWritingGrade({ score: 70, bandFit: "at", feedback: "" })).toBeNull();
  });
});

describe("gradeObjectiveSections", () => {
  it("grades fill-ins case-, punctuation-, and whitespace-insensitively", () => {
    const answers: LevelTestAnswers = {
      comprehension: [1, 0, 2],
      fillIn: ["  GOES. ", "was", "are", "does  not", "have!"],
    };
    expect(gradeObjectiveSections(content(), answers)).toEqual({
      comprehensionCorrect: 3,
      fillInCorrect: 5,
    });
  });

  it("counts unanswered and wrong entries as incorrect", () => {
    const answers: LevelTestAnswers = { comprehension: [null, 3, 2], fillIn: ["", "were", "are", "", ""] };
    expect(gradeObjectiveSections(content(), answers)).toEqual({
      comprehensionCorrect: 1,
      fillInCorrect: 1,
    });
  });
});

describe("evaluateAttempt", () => {
  it("passes when every section clears its bar", () => {
    const result = evaluateAttempt(content(), perfectAnswers(), writingGrade());
    expect(result.passed).toBe(true);
    expect(result.overall).toBe(90);
  });

  it("fails on the writing floor even with perfect objective sections", () => {
    const result = evaluateAttempt(content(), perfectAnswers(), writingGrade({ score: 55 }));
    expect(result.writing.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("fails when the writing sits below the band regardless of score", () => {
    const result = evaluateAttempt(content(), perfectAnswers(), writingGrade({ bandFit: "below", score: 90 }));
    expect(result.passed).toBe(false);
  });

  it("fails below the comprehension and fill-in section bars", () => {
    const answers: LevelTestAnswers = { comprehension: [1, 3, 3], fillIn: ["goes", "was", "x", "y", "z"] };
    const result = evaluateAttempt(content(), answers, writingGrade({ score: 100 }));
    expect(result.comprehension.passed).toBe(false);
    expect(result.fillIn.passed).toBe(false);
    expect(result.passed).toBe(false);
  });
});

describe("retakeAvailableAt", () => {
  it("is available with no attempts or after a pass", () => {
    expect(retakeAvailableAt([], "A1", NOW)).toBe(0);
    expect(retakeAvailableAt([attempt({ passed: true })], "A1", NOW)).toBe(0);
  });

  it("locks for the cooldown after a fail and reopens when it expires", () => {
    const failed = attempt({ createdAt: NOW - DAY_MS });
    expect(retakeAvailableAt([failed], "A1", NOW)).toBe(
      failed.createdAt + RETAKE_COOLDOWN_DAYS * DAY_MS,
    );
    expect(retakeAvailableAt([failed], "A1", NOW + RETAKE_COOLDOWN_DAYS * DAY_MS)).toBe(0);
  });

  it("only considers attempts for the current transition", () => {
    const otherBand = attempt({ fromLevel: "A2", createdAt: NOW - DAY_MS });
    expect(retakeAvailableAt([otherBand], "A1", NOW)).toBe(0);
  });
});
