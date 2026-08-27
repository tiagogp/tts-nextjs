import { describe, expect, it } from "vitest";
import { patternProgress, rungFor, isRetired, PROMOTION_THRESHOLD } from "./patternLadder";

const at = (n: number) => 1_700_000_000_000 + n * 86_400_000;

function pass(rung: string, filling: string[], n: number) {
  return { patternId: "ended-up", rung: rung as never, passed: true, filling, at: at(n) };
}

describe("pattern ladder", () => {
  it("starts an unseen pattern at retrieval", () => {
    expect(rungFor(patternProgress([]), "ended-up")).toBe("retrieval");
  });

  it("promotes after two distinct successes", () => {
    const progress = patternProgress([pass("retrieval", ["stay"], 1), pass("retrieval", ["stay"], 2)]);
    // Same filling twice is one success repeated, not two.
    expect(rungFor(progress, "ended-up")).toBe("retrieval");

    const promoted = patternProgress([pass("retrieval", ["stay"], 1), pass("retrieval", ["buy"], 2)]);
    expect(rungFor(promoted, "ended-up")).toBe("slot_substitution");
  });

  it("does not promote on failures", () => {
    const progress = patternProgress([
      { patternId: "ended-up", rung: "retrieval", passed: false, filling: ["stay"], at: at(1) },
      { patternId: "ended-up", rung: "retrieval", passed: false, filling: ["buy"], at: at(2) },
    ]);
    expect(rungFor(progress, "ended-up")).toBe("retrieval");
    expect(progress.get("ended-up")?.attempts).toBe(2);
  });

  it("skips minimal pair when the pattern has no authored contrast", () => {
    const evidence = [
      pass("retrieval", ["a"], 1), pass("retrieval", ["b"], 2),
      pass("slot_substitution", ["c"], 3), pass("slot_substitution", ["d"], 4),
      pass("constrained_cloze", ["e"], 5), pass("constrained_cloze", ["f"], 6),
    ];
    expect(rungFor(patternProgress(evidence), "ended-up")).toBe("new_situation");
    expect(rungFor(patternProgress(evidence, { hasContrast: () => true }), "ended-up")).toBe("minimal_pair");
  });

  it("retires a pattern only after verified new-situation use", () => {
    const evidence = [
      pass("retrieval", ["a"], 1), pass("retrieval", ["b"], 2),
      pass("slot_substitution", ["c"], 3), pass("slot_substitution", ["d"], 4),
      pass("constrained_cloze", ["e"], 5), pass("constrained_cloze", ["f"], 6),
      pass("new_situation", ["g"], 7),
    ];
    expect(isRetired(patternProgress(evidence), "ended-up")).toBe(false);
    expect(isRetired(patternProgress([...evidence, pass("new_situation", ["h"], 8)]), "ended-up")).toBe(true);
  });

  it("ignores evidence recorded at a rung the learner has left", () => {
    const progress = patternProgress([
      pass("retrieval", ["a"], 1), pass("retrieval", ["b"], 2),
      pass("retrieval", ["c"], 3),
    ]);
    expect(rungFor(progress, "ended-up")).toBe("slot_substitution");
    expect(progress.get("ended-up")?.distinctSuccesses).toBe(0);
  });

  it("requires two, not one", () => {
    expect(PROMOTION_THRESHOLD).toBe(2);
  });
});
