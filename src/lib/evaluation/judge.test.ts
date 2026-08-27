import { describe, expect, it } from "vitest";
import {
  LOCAL_JUDGE,
  hasModelVerdict,
  instrumentKey,
  isMixedInstrument,
  judgeMix,
  modelJudge,
  sameInstrument,
} from "./judge";

describe("judge provenance", () => {
  it("distinguishes a deterministic verdict from a model one", () => {
    const model = modelJudge({ provider: "claude", model: "claude-opus-5" });
    expect(sameInstrument(LOCAL_JUDGE, model)).toBe(false);
    expect(instrumentKey(LOCAL_JUDGE)).toMatch(/^local:/);
    expect(instrumentKey(model)).toContain("claude-opus-5");
  });

  it("treats the same model with a new rubric as a different judge", () => {
    const before = modelJudge({ provider: "claude", model: "claude-opus-5", promptVersion: "1" });
    const after = modelJudge({ provider: "claude", model: "claude-opus-5", promptVersion: "2" });
    expect(sameInstrument(before, after)).toBe(false);
  });

  it("treats an unstamped outcome as unjudged, never as a passed local check", () => {
    expect(instrumentKey(undefined)).toBe("unjudged");
    expect(sameInstrument(undefined, LOCAL_JUDGE)).toBe(false);
    expect(judgeMix([undefined, undefined])).toMatchObject({ local: 0, model: 0, unstamped: 2, instruments: [] });
  });

  it("reports the mix behind a rate", () => {
    const mix = judgeMix([
      LOCAL_JUDGE,
      LOCAL_JUDGE,
      modelJudge({ provider: "openai", model: "gpt-x" }),
      undefined,
    ]);
    expect(mix).toMatchObject({ local: 2, model: 1, unstamped: 1 });
    expect(mix.instruments).toHaveLength(2);
    expect(hasModelVerdict(mix)).toBe(true);
    expect(isMixedInstrument(mix)).toBe(true);
  });

  it("does not call a single-instrument set mixed", () => {
    const mix = judgeMix([LOCAL_JUDGE, LOCAL_JUDGE]);
    expect(isMixedInstrument(mix)).toBe(false);
    expect(hasModelVerdict(mix)).toBe(false);
  });

  it("omits the model name rather than guessing one", () => {
    const stamp = modelJudge({ provider: "ollama" });
    expect(stamp.model).toBeUndefined();
    expect(instrumentKey(stamp)).toContain(":?:");
  });
});
