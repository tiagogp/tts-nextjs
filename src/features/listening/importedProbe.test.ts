import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/features/discover/types";
import {
  PROBE_MAX_MS,
  parseProbeQuestions,
  probeClipUrl,
  probeEligibility,
  selectProbeWindow,
} from "./importedProbe";

/** Segments of `seconds` each, ten words apiece, starting at `fromMs`. */
function speech(count: number, { fromMs = 0, seconds = 5, gapMs = 0 } = {}): TranscriptSegment[] {
  return Array.from({ length: count }, (_, index) => {
    const startMs = fromMs + index * (seconds * 1000 + gapMs);
    return {
      text: `word${index} one two three four five six seven eight nine`,
      startMs,
      endMs: startMs + seconds * 1000,
    };
  });
}

describe("selectProbeWindow", () => {
  it("finds a continuous stretch long enough to carry a main idea", () => {
    const window = selectProbeWindow(speech(6));
    expect(window).not.toBeNull();
    expect(window!.endMs - window!.startMs).toBeGreaterThanOrEqual(10_000);
    expect(window!.endMs - window!.startMs).toBeLessThanOrEqual(PROBE_MAX_MS);
  });

  it("skips the intro when the source is long enough to afford it", () => {
    const window = selectProbeWindow(speech(12));
    expect(window!.startMs).toBeGreaterThanOrEqual(15_000);
  });

  it("falls back to the opening when there is nothing after it", () => {
    const window = selectProbeWindow(speech(3));
    expect(window!.startMs).toBe(0);
  });

  it("refuses a source with no continuous speech", () => {
    // Five-second clips separated by ten-second gaps: never a continuous window.
    expect(selectProbeWindow(speech(6, { gapMs: 10_000 }))).toBeNull();
  });

  it("refuses a stretch that is long but nearly wordless", () => {
    const sparse: TranscriptSegment[] = [
      { text: "hm", startMs: 0, endMs: 8_000 },
      { text: "yeah", startMs: 8_000, endMs: 16_000 },
    ];
    expect(selectProbeWindow(sparse)).toBeNull();
  });

  it("is deterministic, so a regenerated probe is the same test", () => {
    const segments = speech(10);
    expect(selectProbeWindow(segments)).toEqual(selectProbeWindow(segments));
  });
});

describe("probeEligibility", () => {
  const base = { hasAudio: true, segments: speech(8), hasProvider: true, alreadyHeard: false };

  it("accepts a fresh audio import with a provider configured", () => {
    const result = probeEligibility(base);
    expect(result.eligible).toBe(true);
    expect(result.window).toBeDefined();
  });

  it("refuses a source the learner has already heard", () => {
    // The whole measurement is "a voice you have never heard". Once studied, it is not.
    expect(probeEligibility({ ...base, alreadyHeard: true })).toMatchObject({
      eligible: false,
      reason: "already_heard",
    });
  });

  it("refuses a text-only source and one with no provider", () => {
    expect(probeEligibility({ ...base, hasAudio: false }).reason).toBe("no_audio");
    expect(probeEligibility({ ...base, hasProvider: false }).reason).toBe("no_provider");
  });

  it("refuses a source too short to probe", () => {
    expect(probeEligibility({ ...base, segments: speech(1, { seconds: 3 }) }).reason).toBe("too_short");
  });
});

describe("probeClipUrl", () => {
  it("points at the existing clip endpoint", () => {
    const window = selectProbeWindow(speech(6))!;
    expect(probeClipUrl("abcdefghijkl", window)).toBe(
      `/api/discover/clip/abcdefghijkl?startMs=${window.startMs}&endMs=${window.endMs}`,
    );
  });

  it("refuses a source id that is not one", () => {
    expect(probeClipUrl("../etc/passwd", selectProbeWindow(speech(6))!)).toBeNull();
  });
});

describe("parseProbeQuestions", () => {
  const good = {
    questions: [
      { kind: "mainIdea", prompt: "What is the speaker doing?", options: ["Explaining a delay", "Ordering food", "Asking directions"], answer: "Explaining a delay" },
      { kind: "detail", prompt: "How long did it take?", options: ["Ten minutes", "An hour", "All day"], answer: "An hour" },
    ],
  };

  it("accepts a well-formed pair", () => {
    expect(parseProbeQuestions(good)).toHaveLength(2);
  });

  it("digs the JSON out of a model's prose", () => {
    expect(parseProbeQuestions("Sure! ```json\n" + JSON.stringify(good) + "\n```")).toHaveLength(2);
  });

  it("drops a probe with an answer that is not an option", () => {
    const broken = { questions: [{ ...good.questions[0], answer: "Something else" }, good.questions[1]] };
    expect(parseProbeQuestions(broken)).toBeNull();
  });

  it("drops a probe with a repeated option", () => {
    const broken = {
      questions: [
        { ...good.questions[0], options: ["Explaining a delay", "explaining a delay", "Ordering food"] },
        good.questions[1],
      ],
    };
    expect(parseProbeQuestions(broken)).toBeNull();
  });

  it("drops a question that gives its own answer away", () => {
    const broken = {
      questions: [
        { ...good.questions[0], prompt: "Is the speaker explaining a delay or ordering food?" },
        good.questions[1],
      ],
    };
    expect(parseProbeQuestions(broken)).toBeNull();
  });

  it("drops a probe with no main idea, or with two", () => {
    expect(parseProbeQuestions({ questions: [good.questions[1], good.questions[1]] })).toBeNull();
    expect(parseProbeQuestions({ questions: [good.questions[0], good.questions[0]] })).toBeNull();
  });

  it("drops unparseable output rather than guessing", () => {
    expect(parseProbeQuestions("I could not do that")).toBeNull();
    expect(parseProbeQuestions({})).toBeNull();
  });
});
