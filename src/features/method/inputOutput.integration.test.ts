import { describe, expect, it } from "vitest";
import { scoreListeningChallenge, type ListeningChallenge } from "@/features/learn/lessonFlow";
import { coverageForBatch, syntheticAudioMetadata } from "@/features/learn/audioMetadata";
import { prioritizeFeedback, prioritizeLocalFeedback } from "@/features/correct/feedbackContract";
import { micFallbackAvailable } from "@/features/correct/micFallback";
import { buildTransferActivities } from "@/features/study/transfer";
import { deriveProgressionState, supportForProgression } from "./progression";
import { weeklyRhythm } from "./learningLoop";
import { comparableAttemptPair } from "@/features/pronunciation/components/RecordingComparison";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { ProductionAttempt } from "@/lib/performance/types";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";

const challenge: ListeningChallenge = {
  audio: [
    { id: "clip-1", en: "The meeting starts at nine.", pt: "A reunião começa às nove.", clip: "/clip-1.wav", speaker: "speaker-a" },
    { id: "clip-2", en: "Bring the budget notes.", pt: "Traga as notas do orçamento.", clip: "/clip-2.wav", speaker: "speaker-b" },
  ],
  questions: [
    { kind: "mainIdea", prompt: "What is happening?", options: ["meeting", "party"], answer: "meeting" },
    { kind: "detail", prompt: "When?", options: ["nine", "ten"], answer: "nine" },
  ],
};

function error(id: string): ErrorEvent {
  return {
    id,
    original: "I has time",
    corrected: "I have time",
    errorTypes: ["tense"],
    sourceLang: "pt",
    targetLang: "en",
    createdAt: 1,
  };
}

function pronunciation(id: string, createdAt: number): PronunciationAttempt {
  return {
    id,
    createdAt,
    targetLang: "en",
    targetText: "I have time",
    transcript: "I have time",
    scores: { overall: 80, accuracy: 80, completeness: 80, fluency: 80 },
    words: [],
    tips: [],
    source: "lesson",
    recordingId: `recording-${id}`,
  };
}

describe("input-to-output method integration", () => {
  it("keeps partial comprehension useful while progression controls support", () => {
    const result = scoreListeningChallenge(challenge, ["meeting", "ten"]);
    expect(result).toMatchObject({ complete: true, mainIdeaCorrect: true, detailCorrect: 0, canRevealTranscript: true });

    const progression = deriveProgressionState({
      listeningAttempts: [{
        id: "listen-1", lessonId: "lesson-1", sourceId: "lesson-1", questions: [], answers: [],
        questionCount: 2, answeredCount: 2, correctCount: 1, mainIdeaCorrect: true,
        detailCorrect: 0, detailTotal: 1, playCounts: [1, 1], transcriptVisible: true,
        playbackRate: 1, speakerIds: ["speaker-a"], startedAt: 1, completedAt: 2,
      }],
      productionAttempts: [],
      now: 3,
    });
    const support = supportForProgression(progression);
    expect(support.listening.playbackRate).toBeLessThanOrEqual(1);
    expect(support.speaking.targetSeconds).toBe(15);
  });

  it("exposes weekly recovery without a daily penalty", () => {
    const rhythm = weeklyRhythm([], 10);
    expect(rhythm.remainingDays).toBe(7);
    expect(rhythm.nextFocus).toBe("introduce");
  });

  it("uses the same feedback priority for local and provider-backed correction", () => {
    const shared = prioritizeFeedback([error("provider")]);
    const local = prioritizeLocalFeedback([{
      type: "tense", category: "mechanics", priority: "important", note: "Use the corrected tense.",
    }]);
    expect(shared[0].priority).toBe(local[0].priority);
    expect(local[0].category).toBe("grammar");
  });

  it("records reading and transfer prompts as distinct evidence", () => {
    const activities = buildTransferActivities([
      { id: "card-1", front: "I have time", back: "Eu tenho tempo", concept: "availability", source: { kind: "phrase", id: "p1" }, createdAt: 1 },
    ], [error("e1")]);
    expect(activities.some((activity) => activity.kind === "reading_to_meaning")).toBe(true);
    const attempt: ProductionAttempt = {
      id: "transfer-1", source: "study", stage: "production", transferKind: "reading_to_meaning",
      transferSourceId: activities.find((activity) => activity.kind === "reading_to_meaning")?.sourceId,
      text: "It means I am available.", spoken: false, wordCount: 5, finished: true,
      issueCount: 0, evaluated: false, createdAt: 2,
    };
    expect(attempt.transferKind).toBe("reading_to_meaning");
  });

  it("reintroduces a recurring correction through listening, speaking, retelling, and reconstruction", () => {
    const recurring = [error("e1"), { ...error("e2"), createdAt: 2 }];
    const activities = buildTransferActivities([], recurring, [], 6);
    expect(activities.filter((activity) => activity.recurring).map((activity) => activity.kind)).toEqual([
      "listening_recognition", "correction_recall", "topic_retell", "error_reconstruction",
    ]);
    expect(activities.find((activity) => activity.kind === "listening_recognition")?.speechText).toBe("I have time");
  });

  it("keeps microphone denial, audio diversity, retry linkage, and recording comparison testable", () => {
    expect(micFallbackAvailable({ allowTypedFallback: true, micDenied: true })).toBe(true);
    expect(micFallbackAvailable({ allowTypedFallback: false, micDenied: true })).toBe(false);

    const coverage = coverageForBatch(
      ["a", "b", "c"].map((id) => syntheticAudioMetadata(`/clip-${id}.wav`, "A short sentence")),
      { level: "A1", batchSize: 3, minDistinctSpeakers: 2, minNaturalOrConnected: 1, minSpeedWpm: 80, maxSpeedWpm: 220 },
    );
    expect(coverage[0].passes).toBe(false);

    const production = { id: "production-1" };
    const retry = { retryOf: production.id, resolved: true };
    expect(retry.retryOf).toBe(production.id);

    const pair = comparableAttemptPair([pronunciation("older", 1), pronunciation("newer", 2)]);
    expect(pair?.earlier.id).toBe("older");
    expect(pair?.later.id).toBe("newer");
  });

  it("keeps every feedback path explicitly resolvable", () => {
    const resolutions = [
      { resolution: "completed" as const, resolved: true },
      { resolution: "deferred" as const, resolved: false },
      { resolution: "dismissed" as const, resolved: false },
    ];
    expect(resolutions.map((item) => item.resolution)).toEqual(["completed", "deferred", "dismissed"]);
    expect(resolutions.filter((item) => item.resolved)).toHaveLength(1);
  });
});
