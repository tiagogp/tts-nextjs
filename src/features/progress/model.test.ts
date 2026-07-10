import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
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
});
