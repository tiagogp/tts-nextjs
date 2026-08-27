import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAll } from "@/lib/store/db";
import { getMethodProgression, saveListeningAttempt, saveProductionAttempt } from "@/lib/store/repository";
import { refreshMethodProgression } from "./progressionPersistence";

describe("progression persistence", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("derives and saves support from newly persisted evidence without a progress view", async () => {
    await Promise.all([1, 2, 3].map((completedAt) => saveListeningAttempt({
      id: `listening-${completedAt}`,
      lessonId: "lesson-1",
      sourceId: "lesson-1",
      questions: [],
      answers: [],
      questionCount: 2,
      answeredCount: 2,
      correctCount: 2,
      mainIdeaCorrect: true,
      detailCorrect: 1,
      detailTotal: 1,
      playCounts: [1],
      transcriptVisible: true,
      playbackRate: 1,
      speakerIds: ["speaker-1"],
      startedAt: completedAt - 1,
      completedAt,
    })));
    await Promise.all([1, 2, 3].map((createdAt) => saveProductionAttempt({
      id: `production-${createdAt}`,
      source: "lesson",
      stage: "production",
      text: "I can say this clearly.",
      spoken: true,
      wordCount: 5,
      finished: true,
      issueCount: 0,
      createdAt,
    })));

    const refreshed = await refreshMethodProgression();

    expect(refreshed).toMatchObject({
      id: "current",
      listeningStage: "word_recognition",
      speakingStage: "variation",
    });
    await expect(getMethodProgression()).resolves.toMatchObject(refreshed);
  });
});
