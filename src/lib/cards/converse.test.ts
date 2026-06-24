import { describe, expect, it } from "vitest";
import {
  CONVERSATION_KICKOFF,
  buildConverseSystem,
  buildCorrectRequest,
  conversationMessages,
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
