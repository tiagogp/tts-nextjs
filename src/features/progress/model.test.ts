import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";
import { Rating, State, type Grade } from "@/lib/srs/fsrs";
import { computeProgressSnapshot, type StoredProgressAssessment } from "./model";

const NOW = Date.UTC(2026, 5, 28);
const DAY = 86_400_000;

function review(daysAgo: number, grade: Grade = Rating.Good): ReviewRecord {
  return {
    id: `r-${daysAgo}-${grade}`,
    cardId: `c-${daysAgo}`,
    grade,
    reviewedAt: NOW - daysAgo * DAY,
    previousState: State.Review,
    scheduledDays: 2,
    concept: "articles",
  };
}

function error(daysAgo: number, id = `e-${daysAgo}`): ErrorEvent {
  return {
    id,
    original: "I go to work yesterday.",
    corrected: "I went to work yesterday.",
    errorTypes: ["tense"],
    sourceLang: "pt",
    targetLang: "en",
    createdAt: NOW - daysAgo * DAY,
  };
}

function conversation(daysAgo: number, turns: number): Conversation {
  return {
    id: `conv-${daysAgo}`,
    scenario: "work chat",
    context: "work",
    targetLang: "en",
    sourceLang: "pt",
    startedAt: NOW - daysAgo * DAY,
    turns: Array.from({ length: turns }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: `turn ${index}`,
    })),
  };
}

function attempt(daysAgo: number, score: number): PronunciationAttempt {
  return {
    id: `p-${daysAgo}`,
    createdAt: NOW - daysAgo * DAY,
    targetLang: "en",
    targetText: "Good morning",
    transcript: "Good morning",
    scores: {
      overall: score,
      accuracy: score,
      completeness: score,
      fluency: score,
    },
    words: [],
    tips: [],
    source: "study",
  };
}

describe("computeProgressSnapshot", () => {
  it("stays explicit about low confidence when there is little evidence", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "A1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.confidence).toBe("low");
    expect(snapshot.estimatedBand).toBe("A1 baseline");
    expect(snapshot.checkpointDue).toBe(true);
  });

  it("turns local learning signals into achieved milestones", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "A2",
      reviews: Array.from({ length: 15 }, (_, index) => review(index, Rating.Good)),
      errorEvents: [error(24), error(20), error(3, "recent")],
      conversations: [conversation(2, 14), conversation(4, 12)],
      pronunciationAttempts: [attempt(1, 86), attempt(3, 82), attempt(6, 84)],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.confidence).toBe("high");
    expect(snapshot.estimatedBand).not.toBe("A2 baseline");
    expect(snapshot.milestones.find((item) => item.id === "recall-control")?.achieved).toBe(true);
    expect(snapshot.milestones.find((item) => item.id === "clear-pronunciation")?.achieved).toBe(true);
  });

  it("schedules the next check-in from the latest saved check-in", () => {
    const latest = {
      id: "a1",
      kind: "checkin",
      ...computeProgressSnapshot({
        profileLevel: "B1",
        reviews: [],
        errorEvents: [],
        conversations: [],
        pronunciationAttempts: [],
        assessments: [],
        now: NOW - 10 * DAY,
      }),
    } satisfies StoredProgressAssessment;

    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      assessments: [latest],
      now: NOW,
    });

    expect(snapshot.checkpointDue).toBe(false);
    expect(snapshot.nextCheckpointAt).toBe(latest.createdAt + 14 * DAY);
  });

  it("uses listening and production evidence instead of minutes as performance", () => {
    const listening: ListeningAttempt = {
      id: "listen-1",
      lessonId: "lesson-1",
      sourceId: "lesson-lesson-1",
      questions: [],
      answers: [],
      questionCount: 3,
      answeredCount: 3,
      correctCount: 2,
      mainIdeaCorrect: true,
      detailCorrect: 1,
      detailTotal: 2,
      playCounts: [2, 1],
      transcriptVisible: true,
      playbackRate: 1,
      speakerIds: [],
      startedAt: NOW - DAY,
      completedAt: NOW - DAY,
    };
    const production: ProductionAttempt = {
      id: "production-1",
      source: "lesson",
      text: "I am ready.",
      spoken: true,
      wordCount: 3,
      finished: true,
      issueCount: 1,
      createdAt: NOW - DAY,
    };
    const retry: RetryOutcome = {
      id: "retry-1",
      retryOf: production.id,
      source: "lesson",
      text: "I am ready for work.",
      spoken: true,
      wordCount: 5,
      resolved: true,
      issueCount: 0,
      createdAt: NOW,
    };

    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      listeningAttempts: [listening],
      productionAttempts: [production],
      retryOutcomes: [retry],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.skills.find((skill) => skill.key === "comprehension")).toMatchObject({
      samples: 1,
      score: 80,
    });
    expect(snapshot.skills.find((skill) => skill.key === "fluency")?.samples).toBe(1);
    expect(snapshot.confidenceIndicators).toMatchObject({
      spokenAttempts: 1,
      resolvedRetryRate: 100,
      unresolvedRetries: 0,
    });
  });

  it("reports recording growth only when both comparison windows have audio duration", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      productionAttempts: [
        { id: "old", source: "lesson", stage: "production", text: "old", spoken: true, wordCount: 1, finished: true, issueCount: 0, durationMs: 10_000, createdAt: NOW - 45 * DAY },
        { id: "new", source: "lesson", stage: "production", text: "new", spoken: true, wordCount: 1, finished: true, issueCount: 0, durationMs: 20_000, createdAt: NOW - DAY },
      ],
      assessments: [],
      now: NOW,
    });
    expect(snapshot.confidenceIndicators.recordingGrowthPercent).toBe(100);
  });

  it("does not turn unevaluated transfer practice into fluency evidence", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      productionAttempts: [
        { id: "transfer", source: "study", stage: "production", transferKind: "phrase_to_situation", transferSourceId: "card-1", text: "A new sentence", spoken: false, wordCount: 3, finished: true, issueCount: 0, evaluated: false, durationMs: 60_000, createdAt: NOW - DAY },
      ],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.skills.find((skill) => skill.key === "fluency")).toMatchObject({ samples: 0, score: 0 });
    expect(snapshot.confidenceIndicators.transferAttempts).toBe(1);
  });

  it("reports independent transfer and avoided-error evidence separately", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      productionAttempts: [{
        id: "transfer-clear",
        source: "study",
        stage: "production",
        transferKind: "correction_recall",
        transferOutcome: "clear",
        newContext: true,
        avoidedErrorIds: ["error-1"],
        text: "I have time in a new situation.",
        spoken: false,
        wordCount: 7,
        finished: true,
        issueCount: 0,
        evaluated: true,
        createdAt: NOW - DAY,
      }],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.confidenceIndicators).toMatchObject({
      transferAttempts: 1,
      transferSuccessRate: 100,
      cardRecallAttempts: 0,
      openProductionAttempts: 1,
      crossContextReuse: 1,
      correctionRecallAttempts: 1,
      avoidedErrorCount: 1,
      independentAttempts: 1,
    });
  });

  it("surfaces preparation and skipped attempts as confidence evidence", () => {
    const snapshot = computeProgressSnapshot({
      profileLevel: "B1",
      reviews: [],
      errorEvents: [],
      conversations: [],
      pronunciationAttempts: [],
      productionAttempts: [
        {
          id: "prepared",
          source: "study",
          stage: "production",
          text: "I can explain this.",
          spoken: true,
          wordCount: 4,
          finished: true,
          issueCount: 0,
          preparationMs: 4_000,
          createdAt: NOW - DAY,
        },
        {
          id: "skipped",
          source: "study",
          stage: "production",
          text: "",
          spoken: false,
          wordCount: 0,
          finished: false,
          skipped: true,
          issueCount: 0,
          createdAt: NOW - DAY,
        },
      ],
      assessments: [],
      now: NOW,
    });

    expect(snapshot.confidenceIndicators).toMatchObject({
      averagePreparationSeconds: 4,
      preparationSamples: 1,
      skippedAttempts: 1,
    });
  });
});
