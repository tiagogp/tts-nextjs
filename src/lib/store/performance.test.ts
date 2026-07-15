import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import { clearAll } from "./db";
import {
  getListeningAttemptsForLesson,
  getMethodProgression,
  getProductionAttemptsForLesson,
  getRetryOutcomesForAttempt,
  saveListeningAttempt,
  saveMethodProgression,
  saveProductionAttempt,
  saveRetryOutcome,
} from "./repository";

describe("method performance evidence", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("keeps partial listening comprehension separate from completion", async () => {
    const attempt: ListeningAttempt = {
      id: "listening-1",
      lessonId: "lesson-1",
      sourceId: "lesson-lesson-1",
      questions: [
        { kind: "mainIdea", prompt: "What is happening?" },
        { kind: "detail", prompt: "When?" },
      ],
      answers: ["meeting", "morning"],
      questionCount: 2,
      answeredCount: 2,
      correctCount: 1,
      mainIdeaCorrect: true,
      detailCorrect: 0,
      detailTotal: 1,
      playCounts: [2, 1],
      transcriptVisible: true,
      playbackRate: 1,
      speakerIds: ["speaker-a"],
      durationMs: 12_000,
      finished: true,
      playbackRates: [1, 0.9],
      startedAt: 10,
      completedAt: 20,
    };

    await saveListeningAttempt(attempt);

    await expect(getListeningAttemptsForLesson("lesson-1")).resolves.toEqual([attempt]);
  });

  it("links original production evidence to every retry outcome", async () => {
    const production: ProductionAttempt = {
      id: "production-1",
      lessonId: "lesson-1",
      source: "lesson",
      prompt: "Use the phrase in your own sentence.",
      text: "I am ready.",
      spoken: true,
      wordCount: 3,
      finished: true,
      issueCount: 1,
      createdAt: 10,
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
      createdAt: 20,
    };

    await saveProductionAttempt(production);
    await saveRetryOutcome(retry);

    await expect(getProductionAttemptsForLesson("lesson-1")).resolves.toEqual([production]);
    await expect(getRetryOutcomesForAttempt(production.id)).resolves.toEqual([retry]);
  });

  it("persists the current progression separately from raw performance evidence", async () => {
    await saveMethodProgression({
      id: "current",
      listeningStage: "main_idea",
      speakingStage: "variation",
      listeningScore: 84,
      speakingScore: 81,
      listeningSamples: 4,
      speakingSamples: 5,
      updatedAt: 30,
    });
    await expect(getMethodProgression()).resolves.toMatchObject({
      id: "current",
      listeningStage: "main_idea",
      speakingStage: "variation",
    });
  });
});
