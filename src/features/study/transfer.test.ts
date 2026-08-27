import { describe, expect, it } from "vitest";
import { buildTransferActivities, transferMetrics } from "./transfer";

describe("transfer review", () => {
  it("offers open production for phrases and corrections", () => {
    const activities = buildTransferActivities([
      { id: "c1", front: "I tend to", back: "Eu costumo", concept: "habit", source: { kind: "phrase", id: "p1" }, createdAt: 1 },
    ], [{ id: "e1", original: "I has", corrected: "I have", errorTypes: ["tense"], sourceLang: "pt", targetLang: "en", createdAt: 1 }]);
    expect(activities.map((activity) => activity.kind)).toEqual(["correction_recall", "phrase_to_situation", "reading_to_meaning", "open_cloze"]);
  });

  it("offers source-audio recognition when a card has an authentic clip", () => {
    const activities = buildTransferActivities([
      { id: "c1", front: "I tend to", back: "Eu costumo", concept: "habit", source: { kind: "phrase", id: "p1" }, audioClipPath: "/native.wav", createdAt: 1 },
    ], []);

    expect(activities.find((activity) => activity.kind === "listening_recognition")).toMatchObject({
      audioUrl: "/native.wav",
      sourceId: "c1",
    });
  });

  it("does not reveal the English answer in a production transfer prompt", () => {
    const [activity] = buildTransferActivities([
      { id: "c1", front: "Eu costumo", back: "I tend to", direction: "production", concept: "habit", source: { kind: "phrase", id: "p1" }, createdAt: 1 },
    ], []);
    expect(activity.expected).toBe("I tend to");
    expect(activity.promptVars?.phrase).toBe("Eu costumo");
  });

  it("deduplicates receptive and productive siblings of one pattern", () => {
    const cards = [
      { id: "r", front: "I tend to", back: "Eu costumo", direction: "recognition" as const, patternId: "habit", concept: "habit", source: { kind: "phrase" as const, id: "p1" }, createdAt: 1 },
      { id: "p", front: "Eu costumo", back: "I tend to", direction: "production" as const, patternId: "habit", concept: "habit", source: { kind: "phrase" as const, id: "p1" }, createdAt: 1 },
    ];
    expect(buildTransferActivities(cards, []).filter((item) => item.kind === "phrase_to_situation")).toHaveLength(1);
  });

  it("keeps phrase transfer available when recurring errors are numerous", () => {
    const errors = Array.from({ length: 8 }, (_, index) => ({
      id: `e${index}`,
      original: "I has time",
      corrected: "I have time",
      errorTypes: ["tense" as const],
      sourceLang: "pt",
      targetLang: "en",
      createdAt: index,
    }));
    const activities = buildTransferActivities([
      { id: "c1", front: "I tend to", back: "Eu costumo", concept: "habit", source: { kind: "phrase", id: "p1" }, createdAt: 1 },
    ], errors);
    expect(activities.some((activity) => activity.kind === "correction_recall")).toBe(true);
    expect(activities.some((activity) => activity.kind === "phrase_to_situation")).toBe(true);
    expect(activities.filter((activity) => activity.recurring).map((activity) => activity.kind)).toEqual([
      "listening_recognition", "correction_recall", "topic_retell", "error_reconstruction",
    ]);
    expect(activities.find((activity) => activity.kind === "listening_recognition")?.speechText).toBe("I have time");
    expect(activities.filter((activity) => activity.newContextRequested)).not.toHaveLength(0);
  });

  it("measures cross-context and spoken retrieval separately from card recall", () => {
    expect(transferMetrics([
      { transferKind: "listening_recognition", spoken: false },
      { transferKind: "phrase_to_situation", newContext: true, transferVerified: true, spoken: true },
      { transferKind: "topic_retell", newContext: true, transferVerified: true, retold: true, spoken: true, avoidedErrorIds: ["e1"] },
    ])).toEqual({
      cardRecall: 1,
      openProduction: 2,
      crossContextAttempts: 2,
      crossContextVerified: 2,
      crossContextTransferred: 2,
      crossContextRate: 1,
      retells: 1,
      correctionRecalls: 0,
      spokenRetrieval: 2,
      avoidedErrors: 1,
    });
  });

  it("counts an unverifiable attempt as an attempt, never as a transfer", () => {
    // The item had no authored pattern, so the app could not tell whether the learner left
    // the source sentence behind. That is an attempt with no verdict, not a success.
    const metrics = transferMetrics([
      { transferKind: "phrase_to_situation", transferVerified: false, spoken: true },
    ]);
    expect(metrics.crossContextAttempts).toBe(1);
    expect(metrics.crossContextVerified).toBe(0);
    expect(metrics.crossContextTransferred).toBe(0);
    expect(metrics.crossContextRate).toBeNull();
  });

  it("reports the rate over what was verified, not over what was shown", () => {
    const metrics = transferMetrics([
      { transferKind: "phrase_to_situation", newContext: true, transferVerified: true },
      { transferKind: "phrase_to_situation", newContext: false, transferVerified: true },
      { transferKind: "phrase_to_situation", transferVerified: false },
    ]);
    expect(metrics).toMatchObject({
      crossContextAttempts: 3, crossContextVerified: 2, crossContextTransferred: 1, crossContextRate: 0.5,
    });
  });

  it("carries the pattern frame and source example onto a production activity", () => {
    const [activity] = buildTransferActivities([{
      id: "c1", front: "Acabei ficando em casa.", back: "I ended up staying home.",
      direction: "production", concept: "unplanned outcome", patternId: "ended-up",
      patternFrame: "I ended up ___", examples: ["I ended up staying home.", "I ended up buying it."],
      source: { kind: "phrase", id: "p1" }, createdAt: 1,
    }], []);
    expect(activity.patternFrame).toBe("I ended up ___");
    expect(activity.sourceExample).toBe("I ended up staying home.");
  });
});
