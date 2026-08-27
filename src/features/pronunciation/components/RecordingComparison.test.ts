import { describe, expect, it } from "vitest";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import { comparableAttemptPair } from "./RecordingComparison";

function attempt(overrides: Partial<PronunciationAttempt>): PronunciationAttempt {
  const score = overrides.scores?.overall ?? 80;
  return {
    id: overrides.id ?? crypto.randomUUID(),
    createdAt: overrides.createdAt ?? 0,
    targetLang: "en",
    targetText: overrides.targetText ?? "Good morning",
    transcript: overrides.transcript ?? "Good morning",
    scores: overrides.scores ?? {
      overall: score,
      accuracy: score,
      completeness: score,
      fluency: score,
    },
    words: overrides.words ?? [],
    tips: overrides.tips ?? [],
    source: overrides.source ?? "study",
    recordingId: overrides.recordingId ?? crypto.randomUUID(),
    lessonId: overrides.lessonId,
    cardId: overrides.cardId,
    noticedPhraseId: overrides.noticedPhraseId,
  };
}

describe("comparableAttemptPair", () => {
  it("compares the earliest and latest recording for the same prompt context", () => {
    const pair = comparableAttemptPair([
      attempt({ id: "same-middle", createdAt: 20, targetText: "Good morning", cardId: "card-1" }),
      attempt({ id: "other-card", createdAt: 30, targetText: "Good morning", cardId: "card-2" }),
      attempt({ id: "same-earliest", createdAt: 10, targetText: "Good morning", cardId: "card-1" }),
      attempt({ id: "same-latest", createdAt: 40, targetText: "Good morning", cardId: "card-1" }),
    ]);

    expect(pair?.earlier.id).toBe("same-earliest");
    expect(pair?.later.id).toBe("same-latest");
  });

  it("does not compare recordings from different prompts", () => {
    const pair = comparableAttemptPair([
      attempt({ id: "morning", targetText: "Good morning" }),
      attempt({ id: "evening", targetText: "Good evening" }),
    ]);

    expect(pair).toBeNull();
  });
});
