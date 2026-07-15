import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAll } from "./db";
import {
  emitActivity,
  getListeningAttempts,
  getProductionAttempts,
  getRetryOutcomes,
} from "./activityLog";

describe("performance evidence activity events", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("persists typed listening, production, and retry evidence through the activity store", async () => {
    await emitActivity("listening_attempt", {
      attemptId: "listen-1",
      lessonId: "lesson-1",
      sourceId: "lesson-lesson-1",
      questions: [
        { kind: "mainIdea", prompt: "What is the situation?" },
        { kind: "detail", prompt: "What did they say?" },
        { kind: "detail", prompt: "When?" },
      ],
      answers: ["work", "not sure", "not sure"],
      questionCount: 3,
      answeredCount: 3,
      correctCount: 1,
      mainIdeaCorrect: true,
      detailCorrect: 0,
      detailTotal: 2,
      playCounts: [1, 2],
      transcriptVisible: false,
      playbackRate: 1,
      speakerIds: [],
      completedAt: 10,
    });
    await emitActivity("production_attempt", {
      attemptId: "production-1",
      lessonId: "lesson-1",
      source: "lesson",
      text: "I am ready.",
      spoken: false,
      wordCount: 3,
      finished: true,
      issueCount: 1,
      createdAt: 11,
    });
    await emitActivity("retry_outcome", {
      attemptId: "retry-1",
      retryOf: "production-1",
      source: "lesson",
      text: "I am ready now.",
      spoken: false,
      wordCount: 4,
      resolved: true,
      issueCount: 0,
      createdAt: 12,
    });

    expect((await getListeningAttempts())[0].payload.correctCount).toBe(1);
    expect((await getProductionAttempts())[0].payload.attemptId).toBe("production-1");
    expect((await getRetryOutcomes())[0].payload.resolved).toBe(true);
  });
});
