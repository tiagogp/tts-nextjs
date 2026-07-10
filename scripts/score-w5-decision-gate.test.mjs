import { describe, expect, it } from "vitest";
import {
  parseCaptureTable,
  parseDurationMs,
  renderDecisionMarkdown,
  scoreDecisionRound,
} from "./score-w5-decision-gate.mjs";

function row(overrides = {}) {
  return {
    id: "W5-X",
    segment: "self-study/Anki",
    ttFirstLoopMs: 90_000,
    unaidedLoop: true,
    explainBackPass: true,
    differentiator: "native audio from my video",
    differentiatorSource: "unprompted",
    replacement7Day: true,
    paidPain: "managed-cloud",
    day1Return: true,
    day7Return: true,
    ...overrides,
  };
}

describe("score-w5-decision-gate", () => {
  it("parses the capture table and ignores the template row", () => {
    const markdown = `
| ID | Segment | TT first loop | Unaided loop? | Explain-back pass? | Differentiator | Differentiator source | 7-day replacement? | Paid pain | D+1 return | D+7 return |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W5-01 | self-study/Anki / guided beginner |  | Y/N | Y/N |  | unprompted / prompted / none | Y/N | managed-cloud / review-anywhere / curated-content / none / other | Y/N/declined | Y/N/declined |
| W5-02 | self-study/Anki | 1m 35s | Y | Y | mistakes become drills | unprompted | N | review-anywhere | Y | declined |
`;

    expect(parseCaptureTable(markdown)).toEqual([
      {
        id: "W5-02",
        segment: "self-study/Anki",
        ttFirstLoopMs: 95_000,
        unaidedLoop: true,
        explainBackPass: true,
        differentiator: "mistakes become drills",
        differentiatorSource: "unprompted",
        replacement7Day: false,
        paidPain: "review-anywhere",
        day1Return: true,
        day7Return: false,
      },
    ]);
  });

  it("parses stopwatch-style durations", () => {
    expect(parseDurationMs("1:30")).toBe(90_000);
    expect(parseDurationMs("00:02:05")).toBe(125_000);
    expect(parseDurationMs("95s")).toBe(95_000);
    expect(parseDurationMs("1.5m")).toBe(90_000);
  });

  it("passes only when all seven gates pass across a complete decision round", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `W5-${String(index + 1).padStart(2, "0")}`,
        segment: index < 7 ? "self-study/Anki" : "guided beginner",
        replacement7Day: index < 4,
        day7Return: index < 3,
      }),
    );

    const score = scoreDecisionRound(rows, {
      visitors: 210,
      signups: 80,
      platforms: { "Mac Apple Silicon": 24, Windows: 40, Linux: 16 },
    });

    expect(score.decisionReady).toBe(true);
    expect(score.allGatesPass).toBe(true);
    expect(score.primaryRoute).toBe("pass");
    expect(score.billingFrozen).toBe(false);
    expect(score.launchSegment.selected).toBe("self-study/Anki");
    expect(renderDecisionMarkdown(score, new Date("2026-07-02T00:00:00.000Z"))).toContain(
      "Mac Apple Silicon: 24 (30%)",
    );
  });

  it("routes activation or comprehension failure to front-door-only work", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `W5-${index}`,
        ttFirstLoopMs: index < 6 ? 180_000 : null,
        explainBackPass: index < 5,
      }),
    );

    const score = scoreDecisionRound(rows);

    expect(score.gates.activation.passed).toBe(false);
    expect(score.gates.comprehension.passed).toBe(false);
    expect(score.primaryRoute).toBe("frontDoorOnly");
  });

  it("keeps billing frozen when none wins or generic other is the only repeated answer", () => {
    const noneRows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `N-${index}`,
        paidPain: index < 4 ? "none" : index < 7 ? "managed-cloud" : "curated-content",
      }),
    );
    expect(scoreDecisionRound(noneRows).gates.paidPain.passed).toBe(false);

    const otherRows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `O-${index}`,
        paidPain:
          index < 4
            ? "other"
            : index < 6
              ? "managed-cloud"
              : index < 8
                ? "review-anywhere"
                : "curated-content",
      }),
    );
    expect(scoreDecisionRound(otherRows).gates.paidPain.passed).toBe(false);

    const concreteOtherRows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `C-${index}`,
        paidPain: index < 4 ? "other: teacher feedback" : "managed-cloud",
      }),
    );
    expect(scoreDecisionRound(concreteOtherRows).gates.paidPain.passed).toBe(true);
  });
});
