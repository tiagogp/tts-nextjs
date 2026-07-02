import { describe, expect, it } from "vitest";
import {
  markFirstRunPhrasesSaved,
  markFirstRunReviewCompleted,
  startFirstRunActivation,
} from "./firstRun";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("first-run activation timing", () => {
  it("measures bundled lesson start to saved phrases", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation({
      source: "bundled_lesson",
      sourceId: "b1-everyday-demo",
      at: 1000,
      storage,
    });

    expect(markFirstRunPhrasesSaved({ sourceId: "b1-everyday-demo", at: 2500, storage })).toEqual({
      source: "bundled_lesson",
      sourceId: "b1-everyday-demo",
      zeroSetup: true,
      startedAt: 1000,
      elapsedMs: 1500,
    });
  });

  it("measures bundled lesson start to first completed review once phrases are saved", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation({
      source: "bundled_lesson",
      sourceId: "b1-everyday-demo",
      at: 1000,
      storage,
    });
    markFirstRunPhrasesSaved({ sourceId: "lesson-1", at: 3000, storage });

    expect(markFirstRunReviewCompleted({ at: 7000, storage })).toEqual({
      source: "bundled_lesson",
      sourceId: "lesson-1",
      zeroSetup: true,
      startedAt: 1000,
      elapsedMs: 6000,
    });
  });

  it("measures own-source activation without marking it as zero setup", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation({
      source: "own_source",
      sourceId: "https://example.com/video",
      at: 1000,
      storage,
    });

    expect(markFirstRunPhrasesSaved({ sourceId: "youtube-123", at: 5000, storage })).toEqual({
      source: "own_source",
      sourceId: "youtube-123",
      zeroSetup: false,
      startedAt: 1000,
      elapsedMs: 4000,
    });
  });

  it("records first review completion only once", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation({
      source: "bundled_lesson",
      sourceId: "b1-everyday-demo",
      at: 1000,
      storage,
    });
    markFirstRunPhrasesSaved({ sourceId: "b1-everyday-demo", at: 2000, storage });

    expect(markFirstRunReviewCompleted({ at: 3000, storage })?.elapsedMs).toBe(2000);
    expect(markFirstRunReviewCompleted({ at: 4000, storage })).toBeUndefined();
  });

  it("maps legacy demo_lesson timing to bundled_lesson", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "phraseloop:first-run-activation",
      JSON.stringify({ source: "demo_lesson", lessonId: "legacy-demo", startedAt: 1000 }),
    );

    expect(markFirstRunPhrasesSaved({ at: 2500, storage })).toEqual({
      source: "bundled_lesson",
      sourceId: "legacy-demo",
      zeroSetup: true,
      startedAt: 1000,
      elapsedMs: 1500,
    });
  });
});
