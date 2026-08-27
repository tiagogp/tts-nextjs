import { describe, expect, it } from "vitest";
import { transferRate, verifyTransfer } from "./transferVerification";

const ENDED_UP = { frame: "I ended up ___", sourceExample: "I ended up staying home." };

describe("verifyTransfer", () => {
  it("passes the pattern carried into new content", () => {
    const check = verifyTransfer({ ...ENDED_UP, response: "I ended up cancelling the trip." });
    expect(check.verdict).toBe("transferred");
    expect(check.transferred).toBe(true);
  });

  it("fails a rebuild of the studied sentence", () => {
    const check = verifyTransfer({ ...ENDED_UP, response: "I ended up staying at home." });
    expect(check.verdict).toBe("reused");
    expect(check.transferred).toBe(false);
  });

  it("fails a response that drops the pattern", () => {
    expect(verifyTransfer({ ...ENDED_UP, response: "I decided to cancel the trip." }).verdict).toBe("off_pattern");
  });

  it("fails a response with a named transfer error", () => {
    const check = verifyTransfer({ frame: "I am ___", sourceExample: "I am a teacher.", response: "I am student." });
    expect(check.verdict).toBe("form_error");
    expect(check.formIssues).not.toHaveLength(0);
  });

  it("reports unverifiable rather than success when the item has no pattern data", () => {
    const check = verifyTransfer({ response: "I ended up cancelling the trip." });
    expect(check.verdict).toBe("unverifiable");
    expect(check.verified).toBe(false);
    expect(check.transferred).toBe(false);
  });
});

describe("transferRate", () => {
  it("divides by what was verified, not by what was attempted", () => {
    expect(transferRate([
      { verified: true, transferred: true },
      { verified: true, transferred: false },
      { verified: false, transferred: false },
    ])).toEqual({ attempts: 3, verified: 2, transferred: 1, rate: 0.5 });
  });

  it("is null, not zero, when nothing could be verified", () => {
    expect(transferRate([{ verified: false, transferred: false }]).rate).toBeNull();
  });
});
