import { describe, expect, it } from "vitest";
import { toCandidate, toErrorEvent } from "./intake";

describe("toCandidate", () => {
  it("preserves an app-relative clip path so generated cards keep native audio in Study", () => {
    const c = toCandidate(
      { text: "I have been meaning to call", audioClipPath: "/api/discover/clip/abc123def456?startMs=0&endMs=1500" },
      "abc123def456",
    );
    expect(c?.audioClipPath).toBe("/api/discover/clip/abc123def456?startMs=0&endMs=1500");
  });

  it("drops clip paths that are not app-relative", () => {
    const c = toCandidate(
      { text: "hello there", audioClipPath: "https://evil.example/clip.wav" },
      "abc123def456",
    );
    expect(c?.audioClipPath).toBeUndefined();
  });
});

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
