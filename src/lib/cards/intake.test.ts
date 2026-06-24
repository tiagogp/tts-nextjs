import { describe, expect, it } from "vitest";
import { toErrorEvent } from "./intake";

describe("toErrorEvent", () => {
  it("preserves and normalizes the situational context so generated cards inherit it", () => {
    const e = toErrorEvent({ original: "I have 25 years", corrected: "I'm 25", context: "  Job Interview " });
    expect(e?.context).toBe("job interview");
  });

  it("leaves context undefined when absent", () => {
    const e = toErrorEvent({ original: "a", corrected: "b" });
    expect(e?.context).toBeUndefined();
  });
});
