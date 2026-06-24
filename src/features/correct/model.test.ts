import { describe, expect, it, vi } from "vitest";
import { newDraft, parseErrorsJson } from "./model";

describe("correction model", () => {
  it("creates an empty manual correction draft", () => {
    expect(newDraft()).toEqual({
      original: "",
      corrected: "",
      errorTypes: [],
      rationale: "",
    });
  });

  it("parses usable correction JSON and falls back to other", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("event-1");
    expect(parseErrorsJson('{"original":"I have 25 years","corrected":"I am 25","errorTypes":["tense","nope"],"rationale":"age uses be"}')).toEqual([
      {
        id: "event-1",
        original: "I have 25 years",
        corrected: "I am 25",
        errorTypes: ["tense"],
        sourceLang: "pt",
        targetLang: "en",
        rationale: "age uses be",
        createdAt: expect.any(Number),
      },
    ]);
  });

  it("normalizes a situational context from JSON", () => {
    const [event] = parseErrorsJson('{"original":"a","corrected":"b","context":"  Work Meeting "}');
    expect(event.context).toBe("work meeting");
  });

  it("leaves context undefined when absent", () => {
    const [event] = parseErrorsJson('{"original":"a","corrected":"b"}');
    expect(event.context).toBeUndefined();
  });
});
