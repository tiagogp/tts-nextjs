import { describe, expect, it } from "vitest";
import type { ListeningAttempt } from "@/lib/performance/types";
import {
  COLD_PROBES,
  PROBE_INTERVAL_DAYS,
  PROBE_SOURCE_ID,
  probeAttemptKey,
  remainingProbes,
  selectColdProbe,
  type ColdProbe,
} from "./coldProbeBank";

const DAY = 86_400_000;

const probe = (id: string, overrides: Partial<ColdProbe> = {}): ColdProbe => ({
  id,
  clip: `/learn/probes/${id}.wav`,
  accent: "Scottish",
  speakerId: `speaker-${id}`,
  durationSec: 18,
  topic: "a delayed train",
  questions: [
    { kind: "mainIdea", prompt: "What is the speaker doing?", options: ["Explaining a delay", "Ordering food"], answer: "Explaining a delay" },
    { kind: "detail", prompt: "How long was the wait?", options: ["Twenty minutes", "Two hours"], answer: "Two hours" },
  ],
  ...overrides,
});

const attempt = (probeId: string, completedAt: number): ListeningAttempt => ({
  id: `attempt-${probeId}`,
  lessonId: probeAttemptKey(probe(probeId)),
  sourceId: PROBE_SOURCE_ID,
  questions: [],
  answers: [],
  questionCount: 2,
  answeredCount: 2,
  correctCount: 2,
  mainIdeaCorrect: true,
  detailCorrect: 1,
  detailTotal: 1,
  playCounts: [1],
  transcriptVisible: false,
  playbackRate: 1,
  speakerIds: [],
  startedAt: completedAt - 60_000,
  completedAt,
});

describe("selectColdProbe", () => {
  const now = Date.UTC(2026, 7, 27);

  it("offers nothing when the bank is empty", () => {
    expect(selectColdProbe({ attempts: [], now, probes: [] })).toBeNull();
    // The shipped bank is empty on purpose: an authentic recording or no probe at all.
    expect(selectColdProbe({ attempts: [], now })).toBeNull();
    expect(COLD_PROBES).toHaveLength(0);
  });

  it("offers the first unheard clip", () => {
    const bank = [probe("a"), probe("b")];
    expect(selectColdProbe({ attempts: [], now, probes: bank })?.id).toBe("a");
  });

  it("never offers a voice the learner has already heard", () => {
    const bank = [probe("a"), probe("b")];
    const attempts = [attempt("a", now - 30 * DAY)];
    expect(selectColdProbe({ attempts, now, probes: bank })?.id).toBe("b");
  });

  it("waits out the interval between probes", () => {
    const bank = [probe("a"), probe("b")];
    const recent = [attempt("a", now - (PROBE_INTERVAL_DAYS - 1) * DAY)];
    expect(selectColdProbe({ attempts: recent, now, probes: bank })).toBeNull();
    const due = [attempt("a", now - (PROBE_INTERVAL_DAYS + 1) * DAY)];
    expect(selectColdProbe({ attempts: due, now, probes: bank })?.id).toBe("b");
  });

  it("runs out rather than repeating a clip", () => {
    const bank = [probe("a")];
    const attempts = [attempt("a", now - 60 * DAY)];
    expect(selectColdProbe({ attempts, now, probes: bank })).toBeNull();
    expect(remainingProbes(attempts, bank)).toBe(0);
  });

  it("drops a malformed entry instead of shipping an unscorable exercise", () => {
    const broken = probe("c", { questions: [{ kind: "detail", prompt: "?", options: ["a", "b"], answer: "a" }] });
    expect(selectColdProbe({ attempts: [], now, probes: [broken] })).toBeNull();
  });

  it("ignores lesson listening attempts when spacing probes", () => {
    const bank = [probe("a")];
    const lessonAttempt = { ...attempt("a", now - DAY), sourceId: "lesson-a2-food", lessonId: "a2-food" };
    expect(selectColdProbe({ attempts: [lessonAttempt], now, probes: bank })?.id).toBe("a");
  });
});
