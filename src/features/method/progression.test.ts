import { describe, expect, it } from "vitest";
import { deriveListeningStage, deriveProgressionState, deriveReadingWritingStage, deriveSpeakingStage, monologueSeconds, selectFamiliarTopic, supportForProgression } from "./progression";
import type { ListeningAttempt, ProductionAttempt } from "@/lib/performance/types";

const listening = (score: number, completedAt: number): ListeningAttempt => ({
  id: crypto.randomUUID(), lessonId: "l1", sourceId: "s1", questions: [], answers: [],
  questionCount: 3, answeredCount: 3, correctCount: 2, mainIdeaCorrect: score >= 60,
  detailCorrect: score >= 60 ? 2 : 0, detailTotal: 2, playCounts: [1], transcriptVisible: true,
  playbackRate: 1, speakerIds: ["speaker"], startedAt: completedAt - 1000, completedAt,
});

const production = (issues: number, createdAt: number): ProductionAttempt => ({
  id: crypto.randomUUID(), source: "lesson", stage: "production", text: "a sentence",
  spoken: true, wordCount: 2, finished: true, issueCount: issues, createdAt,
});

describe("method progression", () => {
  it("promotes only after repeated listening evidence and tolerates imperfect details", () => {
    const decision = deriveListeningStage([listening(80, 1), listening(80, 2), listening(80, 3)]);
    expect(decision.stage).toBe("word_recognition");
    expect(decision.score).toBe(100);
  });

  it("regresses support after repeated production struggle without deleting history", () => {
    const decision = deriveSpeakingStage(
      [production(5, 1), production(5, 2), production(5, 3)],
      [],
      "variation",
    );
    expect(decision.stage).toBe("fixed_phrases");
    expect(decision.regressed).toBe(true);
  });

  it("does not promote from unevaluated transfer practice", () => {
    const decision = deriveSpeakingStage([
      { ...production(0, 1), evaluated: false },
      { ...production(0, 2), evaluated: false },
      { ...production(0, 3), evaluated: false },
    ]);

    expect(decision.stage).toBe("fixed_phrases");
    expect(decision.samples).toBe(0);
  });

  it("does not promote independent transfer from a learner self-check", () => {
    const attempts = Array.from({ length: 5 }, (_, index) => ({
      ...production(0, index + 1),
      spoken: false,
      evaluated: false,
      transferKind: "phrase_to_situation" as const,
      newContext: true,
      transferOutcome: "clear" as const,
    }));

    const decision = deriveReadingWritingStage(attempts, "independent_transfer");
    expect(decision.stage).toBe("independent_transfer");
    expect(decision.samples).toBe(0);
  });

  it("does not promote from skipped or unfinished evidence", () => {
    const decision = deriveListeningStage([
      { ...listening(100, 1), skipped: true },
      { ...listening(100, 2), finished: false },
      { ...listening(100, 3), skipped: true },
    ]);
    expect(decision.stage).toBe("sound_familiarity");
    expect(decision.samples).toBe(0);
  });

  it("does not treat phrase repetition as independent production evidence", () => {
    const decision = deriveSpeakingStage([
      { ...production(0, 1), stage: "repeat" },
      { ...production(0, 2), stage: "repeat" },
      { ...production(0, 3), stage: "repeat" },
    ]);

    expect(decision.stage).toBe("fixed_phrases");
    expect(decision.samples).toBe(0);
  });

  it("uses the explicit short-to-long monologue ladder", () => {
    expect((["fixed_phrases", "variation", "guided_description", "timed_monologue", "simulated_conversation"] as const).map(monologueSeconds))
      .toEqual([15, 30, 60, 120, 300]);
  });

  it("requires timed-stage duration evidence before increasing conversation depth", () => {
    const short = Array.from({ length: 4 }, (_, index) => ({ ...production(0, index + 1), durationMs: 30_000 }));
    const held = Array.from({ length: 4 }, (_, index) => ({ ...production(0, index + 1), durationMs: 120_000 }));
    expect(deriveSpeakingStage(short, [], "timed_monologue").stage).toBe("timed_monologue");
    expect(deriveSpeakingStage(held, [], "timed_monologue").stage).toBe("simulated_conversation");
  });

  it("turns support stages into concrete audio and speaking guidance", () => {
    const support = supportForProgression({ listeningStage: "natural_comprehension", speakingStage: "timed_monologue" });
    expect(support.listening).toMatchObject({ playbackRate: 1, transcriptCondition: "after_replay" });
    expect(support.speaking.targetSeconds).toBe(120);
    expect(support.speaking.prompt).toContain("timer");
    expect(support.speaking.guidance).toContain("timer");
    expect(support.readingWriting.stage).toBe("guided_reading");
  });

  it("gives a C1 learner a full conversation before any evidence has been recorded", () => {
    // Without the level floor this lands on `fixed_phrases` — 4 turns, single follow-up —
    // which is the beginner shape, not the repertoire practice C1/C2 needs.
    const support = supportForProgression(undefined, { level: "C1" });
    expect(support.conversation.maxTurns).toBeGreaterThanOrEqual(12);
    expect(support.conversation.followUpDepth).toBe("counterpoint");
    // The evidence-based ladder itself must not move.
    expect(support.speaking.stage).toBe("fixed_phrases");
  });

  it("leaves the conversation shape untouched below C1", () => {
    const advanced = supportForProgression(undefined, { level: "B2" });
    expect(advanced.conversation).toMatchObject({ maxTurns: 4, followUpDepth: "single" });
    expect(supportForProgression(undefined).conversation).toMatchObject({ maxTurns: 4, followUpDepth: "single" });
  });

  it("never lowers a conversation the learner has already earned through evidence", () => {
    const earned = supportForProgression({ listeningStage: "main_idea", speakingStage: "real_world_production" }, { level: "C2" });
    expect(earned.conversation.maxTurns).toBeGreaterThanOrEqual(12);
    expect(earned.conversation.followUpDepth).toBe("counterpoint");
    expect(earned.speaking.stage).toBe("real_world_production");
  });

  it("promotes reading and writing from repeated transfer evidence", () => {
    const attempts: ProductionAttempt[] = [
      { ...production(0, 1), spoken: false, transferKind: "reading_to_meaning" },
      { ...production(0, 2), spoken: false, transferKind: "reading_to_meaning" },
      { ...production(0, 3), spoken: false, transferKind: "phrase_to_situation" },
      { ...production(0, 4), spoken: false, transferKind: "phrase_to_situation" },
    ];
    const writing = deriveReadingWritingStage(attempts, "open_writing");
    expect(writing.stage).toBe("revision");
  });

  it("promotes guided reading from comprehension evidence without requiring writing first", () => {
    const attempts: ProductionAttempt[] = [
      { ...production(0, 1), spoken: false, transferKind: "reading_to_meaning", comprehensionScore: 100 },
      { ...production(0, 2), spoken: false, transferKind: "reading_to_meaning", comprehensionScore: 100 },
    ];
    expect(deriveReadingWritingStage(attempts).stage).toBe("open_writing");
  });

  it("restores reading/writing support after repeated weak transfer", () => {
    const attempts: ProductionAttempt[] = Array.from({ length: 3 }, (_, index) => ({
      ...production(2, index + 1),
      spoken: false,
      transferKind: "phrase_to_situation",
      newContext: true,
      transferOutcome: "needs_support",
      writingScore: 20,
    }));
    const decision = deriveReadingWritingStage(attempts, "revision");
    expect(decision.stage).toBe("open_writing");
    expect(decision.regressed).toBe(true);
  });

  it("recurs familiar personal topics by least-recent use", () => {
    const now = Date.UTC(2026, 6, 15);
    expect(selectFamiliarTopic([], now).id).toBe("week");
    expect(selectFamiliarTopic([
      { topicId: "week", createdAt: now - 8 * 86_400_000 },
      { topicId: "home", createdAt: now - 2 * 86_400_000 },
      { topicId: "work-study", createdAt: now - 2 * 86_400_000 },
      { topicId: "hobbies", createdAt: now - 2 * 86_400_000 },
    ], now).id).toBe("week");
  });

  it("produces a durable support snapshot without confusing it with attempt history", () => {
    const state = deriveProgressionState({
      listeningAttempts: [listening(80, 1), listening(80, 2), listening(80, 3)],
      productionAttempts: [production(0, 1), production(0, 2), production(0, 3)],
      now: 10,
    });
    expect(state).toMatchObject({
      id: "current",
      listeningStage: "word_recognition",
      speakingStage: "variation",
      listeningSamples: 3,
      speakingSamples: 3,
      updatedAt: 10,
    });
  });

  it("does not climb a second rung on the evidence that earned the first one", () => {
    const listeningAttempts = [listening(80, 1), listening(80, 2), listening(80, 3)];
    const productionAttempts = [production(0, 1), production(0, 2), production(0, 3)];

    let state = deriveProgressionState({ listeningAttempts, productionAttempts, now: 10 });
    expect(state.speakingStage).toBe("variation");

    // Re-derivation happens on every app mount. With no new attempts, the ladder holds.
    for (const now of [20, 30, 40]) {
      state = deriveProgressionState({ listeningAttempts, productionAttempts, previous: state, now });
    }
    expect(state.speakingStage).toBe("variation");
    expect(state.listeningStage).toBe("word_recognition");

    // Fresh evidence recorded at the new stage promotes exactly one rung.
    const afterPromotion = [production(0, 50), production(0, 51), production(0, 52)];
    state = deriveProgressionState({
      listeningAttempts,
      productionAttempts: [...productionAttempts, ...afterPromotion],
      previous: state,
      now: 60,
    });
    expect(state.speakingStage).toBe("guided_description");
  });

  it("withholds promotion for a stored snapshot written before stage entry was stamped", () => {
    const productionAttempts = [production(0, 1), production(0, 2), production(0, 3)];
    const legacy = {
      id: "current" as const,
      listeningStage: "sound_familiarity" as const,
      speakingStage: "variation" as const,
      listeningScore: 0,
      speakingScore: 100,
      listeningSamples: 0,
      speakingSamples: 3,
      updatedAt: 5,
    };

    const state = deriveProgressionState({
      listeningAttempts: [],
      productionAttempts,
      previous: legacy,
      now: 10,
    });

    expect(state.speakingStage).toBe("variation");
    expect(state.speakingStageSince).toBe(10);
    // The displayed signal still reflects the recent window, not the promotion gate.
    expect(state.speakingSamples).toBe(3);
  });
});
