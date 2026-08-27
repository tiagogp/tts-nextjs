import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import type { ProofAttempt } from "@/lib/performance/types";
import { computeProofRetention, selectProofItems } from "./proofQueue";
import { LOCAL_JUDGE, modelJudge } from "@/lib/evaluation/judge";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const card = (id: string, direction: Card["direction"] = "production"): Card => ({
  id, front: "f", back: "b", direction, concept: "c",
  source: { kind: "phrase", id: "p" }, createdAt: 1,
});

const attempt = (over: Partial<ProofAttempt>): ProofAttempt => ({
  id: crypto.randomUUID(), cardId: "c1", targetDays: 30, ageDays: 30,
  response: "x", correct: true, evaluatedBy: "local", askedAt: NOW, answeredAt: NOW, ...over,
});

describe("selectProofItems", () => {
  it("selects a card that is due for a window regardless of how well it is known", () => {
    // No SRS state is passed in at all — that is the point. A card the learner keeps
    // failing has exactly the same chance of being proved as one they find easy.
    const chosen = selectProofItems({
      cards: [card("easy"), card("hard")],
      acquiredAt: new Map([["easy", NOW - 30 * DAY], ["hard", NOW - 30 * DAY]]),
      attempts: [],
      now: NOW,
      limit: 5,
    });
    expect(chosen.map((item) => item.cardId).sort()).toEqual(["easy", "hard"]);
    expect(chosen.every((item) => item.targetDays === 30)).toBe(true);
  });

  it("skips recognition cards", () => {
    expect(selectProofItems({
      cards: [card("r", "recognition")],
      acquiredAt: new Map([["r", NOW - 30 * DAY]]),
      attempts: [], now: NOW,
    })).toHaveLength(0);
  });

  it("skips an item outside every window", () => {
    expect(selectProofItems({
      cards: [card("c1")],
      acquiredAt: new Map([["c1", NOW - 18 * DAY]]),
      attempts: [], now: NOW,
    })).toHaveLength(0);
  });

  it("does not repeat a window already proved for that card", () => {
    expect(selectProofItems({
      cards: [card("c1")],
      acquiredAt: new Map([["c1", NOW - 30 * DAY]]),
      attempts: [attempt({ cardId: "c1", targetDays: 30 })],
      now: NOW,
    })).toHaveLength(0);
  });

  it("prefers the longer horizon, which has less time left to catch", () => {
    const chosen = selectProofItems({
      cards: [card("young"), card("old")],
      acquiredAt: new Map([["young", NOW - 7 * DAY], ["old", NOW - 60 * DAY]]),
      attempts: [], now: NOW, limit: 1,
    });
    expect(chosen[0]).toMatchObject({ cardId: "old", targetDays: 60 });
  });

  it("proves one window per card per session", () => {
    // 60 days old: inside the D60 window and still inside the wide D30 one.
    const chosen = selectProofItems({
      cards: [card("c1")],
      acquiredAt: new Map([["c1", NOW - 45 * DAY]]),
      attempts: [], now: NOW, limit: 5,
    });
    expect(chosen).toHaveLength(1);
  });
});

describe("computeProofRetention", () => {
  it("is null, not zero, before anything is proved", () => {
    const retention = computeProofRetention([]);
    expect(retention[7].rate).toBeNull();
    expect(retention[30].rate).toBeNull();
    expect(retention[60].rate).toBeNull();
  });

  it("excludes unjudged attempts from the rate instead of failing them", () => {
    const retention = computeProofRetention([
      attempt({ targetDays: 7, cardId: "a", correct: true }),
      attempt({ targetDays: 7, cardId: "b", correct: false }),
      attempt({ targetDays: 7, cardId: "c", correct: undefined }),
    ]);
    expect(retention[7]).toMatchObject({ attempts: 2, correct: 1, rate: 0.5, unjudged: 1, cards: 2 });
  });
});

describe("computeProofRetention provenance", () => {
  it("names the judge behind the rate", () => {
    const retention = computeProofRetention([
      attempt({ judge: LOCAL_JUDGE }),
      attempt({ judge: modelJudge({ provider: "claude", model: "claude-opus-5" }), correct: false }),
    ]);
    expect(retention[30].judges).toMatchObject({ local: 1, model: 1 });
    // Two instruments behind one percentage: the panel has to say so rather than trend it.
    expect(retention[30].mixed).toBe(true);
  });

  it("does not call a single-instrument window mixed", () => {
    const retention = computeProofRetention([attempt({ judge: LOCAL_JUDGE }), attempt({ judge: LOCAL_JUDGE })]);
    expect(retention[30].mixed).toBe(false);
    expect(retention[30].judges.model).toBe(0);
  });

  it("counts an unstamped attempt as unstamped, not as a local check", () => {
    const retention = computeProofRetention([attempt({})]);
    expect(retention[30].judges).toMatchObject({ local: 0, model: 0, unstamped: 1 });
  });

  it("ignores the judge of an attempt excluded from the rate", () => {
    // Unjudged correctness never reaches the rate, so its provenance must not colour it.
    const retention = computeProofRetention([
      attempt({ judge: LOCAL_JUDGE }),
      attempt({ correct: undefined, judge: modelJudge({ provider: "openai" }) }),
    ]);
    expect(retention[30].judges.model).toBe(0);
    expect(retention[30].unjudged).toBe(1);
    expect(retention[30].mixed).toBe(false);
  });
});
