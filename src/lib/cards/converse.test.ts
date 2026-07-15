import { describe, expect, it } from "vitest";
import {
  CONVERSATION_KICKOFF,
  buildAdvancedReviewRequest,
  buildConverseSystem,
  buildCorrectRequest,
  conversationMessages,
  normalizeAdvancedReview,
} from "./shared";

describe("conversationMessages", () => {
  it("injects a kickoff user turn when there's no history (APIs need a leading user message)", () => {
    expect(conversationMessages([])).toEqual([{ role: "user", content: CONVERSATION_KICKOFF }]);
  });

  it("maps stored turns to { role, content }", () => {
    expect(
      conversationMessages([
        { role: "assistant", text: "Hi, how are you?" },
        { role: "user", text: "I'm good" },
      ]),
    ).toEqual([
      { role: "assistant", content: "Hi, how are you?" },
      { role: "user", content: "I'm good" },
    ]);
  });
});

describe("buildConverseSystem", () => {
  it("encodes the scenario, target language, level, and the no-mid-correction rule", () => {
    const system = buildConverseSystem({
      scenario: "ordering at a restaurant",
      targetLang: "en",
      sourceLang: "pt",
      level: "B1",
    });
    expect(system).toContain("ordering at a restaurant");
    expect(system).toContain("en");
    expect(system).toContain("B1");
    // The product commitment: never correct mid-conversation (Phase 2 does that afterwards).
    expect(system.toLowerCase()).toContain("do not correct");
  });

  it("can ask for a more challenging advanced partner", () => {
    const system = buildConverseSystem({
      scenario: "debating a product decision",
      targetLang: "en",
      sourceLang: "pt",
      level: "C1",
      challenge: true,
    });

    expect(system).toContain("mild counterpoint");
    expect(system).toContain("defend a view");
    expect(system.toLowerCase()).toContain("do not correct");
  });
});

describe("buildCorrectRequest", () => {
  it("keeps the corrected answer in the target language", () => {
    const req = buildCorrectRequest("I have 25 years", "pt", "en");

    expect(req.system).toContain("The corrected field must be written only in en");
    expect(req.user).toContain(
      "corrected: the native-correct en version of just that fragment; do not translate it into pt.",
    );
    expect(req.user).toContain("original: the exact fragment the learner wrote, verbatim.");
  });

  it("uses the learner language for rationales below B2", () => {
    const req = buildCorrectRequest("I have 25 years", "pt", "en", "B1");

    expect(req.user).toContain("rationale: one short line, in pt");
  });

  it("uses the target language for rationales from B2 upward", () => {
    const req = buildCorrectRequest("I have 25 years", "pt", "en", "B2");

    expect(req.user).toContain("rationale: one short line, in en");
  });
});

describe("buildAdvancedReviewRequest", () => {
  it("asks for separate errors and refinements", () => {
    const req = buildAdvancedReviewRequest("It works fine, but I need better results.", "pt", "en", "C1");

    expect(req.user).toContain("errors: up to 3 real mistakes, prioritized by communication impact");
    expect(req.user).toContain("refinements: 0 to 3 optional upgrades");
    expect(req.system).toContain("Separate real errors from optional refinements");
  });
});

describe("normalizeAdvancedReview", () => {
  it("keeps correct-but-less-native refinements separate from errors", () => {
    const review = normalizeAdvancedReview(
      {
        errors: [],
        refinements: [
          {
            original: "It works fine",
            suggested: "It does the job",
            dimension: "naturalness",
            rationale: "More idiomatic in a casual product discussion.",
            impact: "sounds more native",
          },
        ],
        overall: { strengths: ["Clear meaning"], nextFocus: "Use more idiomatic phrasing." },
      },
      "pt",
      "en",
      "work",
    );

    expect(review.errors).toEqual([]);
    expect(review.refinements).toHaveLength(1);
    expect(review.refinements[0]).toMatchObject({
      original: "It works fine",
      suggested: "It does the job",
      dimension: "naturalness",
      context: "work",
    });
    expect(review.overall?.nextFocus).toBe("Use more idiomatic phrasing.");
  });

  it("caps provider output so minor polish cannot crowd out the retry loop", () => {
    const review = normalizeAdvancedReview({
      errors: Array.from({ length: 5 }, (_, index) => ({
        original: `wrong ${index}`,
        corrected: `right ${index}`,
        errorTypes: ["tense"],
        rationale: "Fix the tense.",
      })),
      refinements: Array.from({ length: 5 }, (_, index) => ({
        original: `phrase ${index}`,
        suggested: `better phrase ${index}`,
        dimension: "naturalness",
        rationale: "More natural.",
        impact: null,
      })),
      overall: null,
    }, "pt", "en");

    expect(review.errors).toHaveLength(3);
    expect(review.refinements).toHaveLength(3);
  });
});
