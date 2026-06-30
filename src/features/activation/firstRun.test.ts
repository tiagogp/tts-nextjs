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
  it("measures demo start to saved phrases", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation("b1-everyday-demo", 1000, storage);

    expect(markFirstRunPhrasesSaved({ lessonId: "b1-everyday-demo", at: 2500, storage })).toEqual({
      source: "demo_lesson",
      lessonId: "b1-everyday-demo",
      zeroSetup: true,
      startedAt: 1000,
      elapsedMs: 1500,
    });
  });

  it("measures demo start to first completed review once phrases are saved", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation("b1-everyday-demo", 1000, storage);
    markFirstRunPhrasesSaved({ lessonId: "lesson-1", at: 3000, storage });

    expect(markFirstRunReviewCompleted({ at: 7000, storage })).toEqual({
      source: "demo_lesson",
      lessonId: "lesson-1",
      zeroSetup: true,
      startedAt: 1000,
      elapsedMs: 6000,
    });
  });

  it("records first review completion only once", () => {
    const storage = new MemoryStorage();
    startFirstRunActivation("b1-everyday-demo", 1000, storage);
    markFirstRunPhrasesSaved({ lessonId: "b1-everyday-demo", at: 2000, storage });

    expect(markFirstRunReviewCompleted({ at: 3000, storage })?.elapsedMs).toBe(2000);
    expect(markFirstRunReviewCompleted({ at: 4000, storage })).toBeUndefined();
  });
});
