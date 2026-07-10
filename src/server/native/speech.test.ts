import { describe, expect, it } from "vitest";
import { transcriptText } from "./speech";

describe("speech transcript normalization", () => {
  it("drops Whisper non-speech placeholders", () => {
    expect(transcriptText("[BLANK_AUDIO]")).toBe("");
    expect(transcriptText("(no speech)")).toBe("");
    expect(transcriptText("silence")).toBe("");
  });

  it("removes embedded non-speech markers without dropping real text", () => {
    expect(transcriptText("[BLANK_AUDIO] I would like a coffee.")).toBe("I would like a coffee.");
    expect(transcriptText("I mean (silence) the blue one.")).toBe("I mean the blue one.");
  });
});
