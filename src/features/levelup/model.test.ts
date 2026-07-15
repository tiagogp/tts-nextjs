import { describe, expect, it } from "vitest";
import { computeLevelReadiness, gapEvidence, nextLevelOf, type LevelReadinessInput } from "./model";
import type { EnglishLevel } from "@/features/discover/types";
import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { ProgressSnapshot, SkillKey } from "@/features/progress/model";
import type { Weakness } from "@/lib/srs/analytics";
import { State, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

const NOW = Date.UTC(2026, 6, 1);
const DAY_MS = 86_400_000;

function snapshot(overrides: {
  scores?: Partial<Record<SkillKey, number>>;
  samples?: Partial<Record<SkillKey, number>>;
  averageScore?: number;
  confidence?: ProgressSnapshot["confidence"];
} = {}): ProgressSnapshot {
  const keys: SkillKey[] = ["recall", "grammar", "naturalness", "pronunciation", "fluency", "consistency"];
  return {
    createdAt: NOW,
    estimatedBand: "A1",
    averageScore: overrides.averageScore ?? 85,
    confidence: overrides.confidence ?? "high",
    skills: keys.map((key) => ({
      key,
      label: key,
      score: overrides.scores?.[key] ?? 85,
      samples: overrides.samples?.[key] ?? 20,
      delta: 0,
      detail: "",
    })),
    strengths: [],
    nextFocus: "",
    milestones: [],
    nextCheckpointAt: NOW,
    checkpointDue: false,
    confidenceIndicators: {
      spokenAttempts: 0,
      averageRecordingSeconds: 0,
      recordingGrowthPercent: 0,
      resolvedRetryRate: 0,
      unresolvedRetries: 0,
      readingWritingAttempts: 0,
      transferAttempts: 0,
      uniqueTransferSources: 0,
    },
  };
}

function review(daysAgo: number): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    cardId: "c1",
    grade: 3,
    reviewedAt: NOW - daysAgo * DAY_MS,
    previousState: State.Review,
    scheduledDays: 1,
    concept: "greetings",
  };
}

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
    front: "How do you greet a colleague?",
    back: "Good morning!",
    concept: "greetings",
    source: { kind: "phrase", id: "s1" },
    createdAt: NOW - DAY_MS,
    ...overrides,
  };
}

function srs(stability: number): SrsRecord {
  return {
    cardId: "c1",
    due: NOW,
    stability,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 5,
    lapses: 0,
    state: State.Review,
  };
}

function weakness(overrides: Partial<Weakness> = {}): Weakness {
  return {
    label: "tense",
    kind: "errorType",
    reviews: 6,
    struggleRate: 0.6,
    lapses: 2,
    trend: "stable",
    trendDelta: 0,
    ...overrides,
  };
}

function errorEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    id: crypto.randomUUID(),
    original: "I go yesterday",
    corrected: "I went yesterday",
    errorTypes: ["tense"],
    sourceLang: "pt",
    targetLang: "en",
    createdAt: NOW - DAY_MS,
    ...overrides,
  };
}

/** An input that satisfies every A1→A2 criterion. */
function readyInput(level: EnglishLevel = "A1"): LevelReadinessInput {
  return {
    profileLevel: level,
    snapshot: snapshot(),
    weaknesses: [],
    errorEvents: [],
    cards: [],
    cardsWithSrs: Array.from({ length: 60 }, () => ({ card: card(), srs: srs(30) })),
    reviews: Array.from({ length: 80 }, (_, i) => review(i % 29)),
    lastCheckinAt: NOW - 5 * DAY_MS,
    now: NOW,
  };
}

describe("nextLevelOf", () => {
  it("walks the ladder and ends at C1", () => {
    expect(nextLevelOf("A1")).toBe("A2");
    expect(nextLevelOf("B2")).toBe("C1");
    expect(nextLevelOf("C1")).toBeNull();
    expect(nextLevelOf("C2")).toBeNull();
  });
});

describe("computeLevelReadiness", () => {
  it("is eligible when every criterion is met", () => {
    const readiness = computeLevelReadiness(readyInput());
    expect(readiness.targetLevel).toBe("A2");
    expect(readiness.criteria.every((c) => c.achieved)).toBe(true);
    expect(readiness.eligible).toBe(true);
    expect(readiness.score).toBe(100);
  });

  it("is never eligible at the top of the ladder", () => {
    const readiness = computeLevelReadiness(readyInput("C1"));
    expect(readiness.targetLevel).toBeNull();
    expect(readiness.eligible).toBe(false);
  });

  it("demands more volume and stability at higher bands", () => {
    const input = readyInput("B1");
    const readiness = computeLevelReadiness(input);
    const volume = readiness.criteria.find((c) => c.id === "volume")!;
    const stability = readiness.criteria.find((c) => c.id === "stability")!;
    expect(volume.target).toBe(60);
    expect(stability.target).toBe(40);
    // The same evidence that clears A1 (80 reviews / 60 stable) still clears B1's bar…
    expect(readiness.eligible).toBe(true);
    // …but not B2's volume bar.
    const b2 = computeLevelReadiness({ ...input, profileLevel: "B2", reviews: input.reviews.slice(0, 70) });
    expect(b2.criteria.find((c) => c.id === "volume")!.achieved).toBe(false);
    expect(b2.eligible).toBe(false);
  });

  it("requires a naturalness signal only from B1 up", () => {
    const weakNaturalness = { scores: { naturalness: 50 } };
    const a1 = computeLevelReadiness({ ...readyInput("A1"), snapshot: snapshot(weakNaturalness) });
    expect(a1.criteria.find((c) => c.id === "production")!.achieved).toBe(true);
    const b1 = computeLevelReadiness({ ...readyInput("B1"), snapshot: snapshot(weakNaturalness) });
    expect(b1.criteria.find((c) => c.id === "production")!.achieved).toBe(false);
  });

  it("blocks production on a worsening high-struggle weakness", () => {
    const blocking = weakness({ trend: "worsening", struggleRate: 0.6 });
    const readiness = computeLevelReadiness({
      ...readyInput(),
      weaknesses: [blocking],
      errorEvents: [errorEvent()],
    });
    expect(readiness.criteria.find((c) => c.id === "production")!.achieved).toBe(false);
    expect(readiness.eligible).toBe(false);
  });

  it("does not block on a stable or improving weakness", () => {
    const readiness = computeLevelReadiness({
      ...readyInput(),
      weaknesses: [weakness({ trend: "improving", struggleRate: 0.6 })],
      errorEvents: [errorEvent()],
    });
    expect(readiness.criteria.find((c) => c.id === "production")!.achieved).toBe(true);
  });

  it("requires a recent check-in", () => {
    const readiness = computeLevelReadiness({
      ...readyInput(),
      lastCheckinAt: NOW - 45 * DAY_MS,
    });
    expect(readiness.criteria.find((c) => c.id === "checkin")!.achieved).toBe(false);
    expect(readiness.eligible).toBe(false);
  });

  it("halves overall progress when confidence is low", () => {
    const readiness = computeLevelReadiness({
      ...readyInput(),
      snapshot: snapshot({ confidence: "low" }),
    });
    const overall = readiness.criteria.find((c) => c.id === "overall")!;
    expect(overall.achieved).toBe(false);
    expect(overall.progress).toBeCloseTo(0.5, 5);
  });

  it("attaches evidence to every returned gap and drops evidence-less ones", () => {
    const readiness = computeLevelReadiness({
      ...readyInput(),
      weaknesses: [
        weakness({ label: "tense", kind: "errorType" }),
        weakness({ label: "phantom-concept", kind: "concept" }),
      ],
      errorEvents: [errorEvent()],
    });
    expect(readiness.gaps).toHaveLength(1);
    expect(readiness.gaps[0].weakness.label).toBe("tense");
    expect(readiness.gaps[0].example).toEqual({
      kind: "error",
      original: "I go yesterday",
      corrected: "I went yesterday",
    });
  });

  it("score grows monotonically with more evidence", () => {
    const empty = computeLevelReadiness({
      ...readyInput(),
      reviews: [],
      cardsWithSrs: [],
      snapshot: snapshot({ averageScore: 0, confidence: "low", scores: { recall: 0, grammar: 0 } }),
      lastCheckinAt: undefined,
    });
    const partial = computeLevelReadiness({ ...readyInput(), reviews: readyInput().reviews.slice(0, 15) });
    const full = computeLevelReadiness(readyInput());
    expect(empty.score).toBeLessThan(partial.score);
    expect(partial.score).toBeLessThanOrEqual(full.score);
  });
});

describe("gapEvidence", () => {
  it("uses the newest matching error for errorType gaps", () => {
    const older = errorEvent({ original: "old", createdAt: NOW - 10 * DAY_MS });
    const newer = errorEvent({ original: "new", createdAt: NOW - DAY_MS });
    const evidence = gapEvidence(weakness(), [older, newer], []);
    expect(evidence).toEqual({ kind: "error", original: "new", corrected: newer.corrected });
  });

  it("falls back to a matching card phrase for concept gaps", () => {
    const match = card({ concept: "phrasal-verbs", front: "give ___", back: "give up" });
    const evidence = gapEvidence(weakness({ label: "phrasal-verbs", kind: "concept" }), [], [match]);
    expect(evidence).toEqual({ kind: "phrase", front: "give ___", back: "give up" });
  });

  it("matches context gaps by card context", () => {
    const match = card({ context: "work", front: "schedule a ___", back: "schedule a meeting" });
    const evidence = gapEvidence(weakness({ label: "work", kind: "context" }), [], [match]);
    expect(evidence).toEqual({ kind: "phrase", front: "schedule a ___", back: "schedule a meeting" });
  });
});
