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
    expect(activities.filter((activity) => activity.newContext)).not.toHaveLength(0);
  });

  it("measures cross-context and spoken retrieval separately from card recall", () => {
    expect(transferMetrics([
      { transferKind: "listening_recognition", spoken: false },
      { transferKind: "phrase_to_situation", newContext: true, spoken: true },
      { transferKind: "topic_retell", newContext: true, retold: true, spoken: true, avoidedErrorIds: ["e1"] },
    ])).toEqual({
      cardRecall: 1,
      openProduction: 2,
      crossContext: 2,
      retells: 1,
      correctionRecalls: 0,
      spokenRetrieval: 2,
      avoidedErrors: 1,
    });
  });
});
