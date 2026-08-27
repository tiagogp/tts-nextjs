import { describe, expect, it } from "vitest";
import { checkOpenResponse } from "./openResponse";

describe("checkOpenResponse", () => {
  it("names a transfer error rather than deferring the whole answer to a provider", () => {
    const check = checkOpenResponse({ response: "I am late because I have 30 years and I forgot." });
    expect(check.verdict).toBe("form_error");
    expect(check.formIssues).not.toHaveLength(0);
    expect(check.taskCompleted).toBe(false);
  });

  it("treats a one-word answer as a non-attempt", () => {
    expect(checkOpenResponse({ response: "sorry" }).verdict).toBe("too_short");
    expect(checkOpenResponse({ response: "" }).verdict).toBe("empty");
  });

  it("catches the prompt handed back as an answer", () => {
    const check = checkOpenResponse({
      response: "Explain why you arrived late to the meeting",
      prompt: "Explain why you arrived late to the meeting.",
    });
    expect(check.verdict).toBe("echoed_prompt");
    expect(check.taskCompleted).toBe(false);
  });

  it("does not judge the task when nothing observable is wrong", () => {
    const check = checkOpenResponse({
      response: "The train broke down, so I ended up walking the last part.",
      prompt: "Explique por que você chegou atrasado.",
    });
    expect(check.verdict).toBe("form_clear");
    // Not `true`: nothing here checked whether the answer addresses the task.
    expect(check.taskCompleted).toBeUndefined();
    expect(check.meaningJudged).toBe(false);
  });

  it("does not mistake a Portuguese prompt for evidence about an English answer", () => {
    const check = checkOpenResponse({
      response: "I got stuck in traffic on the way here.",
      prompt: "Explique por que você chegou atrasado à reunião.",
    });
    expect(check.verdict).toBe("form_clear");
  });
});
