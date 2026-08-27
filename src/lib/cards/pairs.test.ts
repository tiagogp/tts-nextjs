import { describe, expect, it } from "vitest";
import type { Card, PhraseCandidate } from "./schema";
import { buildProductiveCardPairs } from "./pairs";

const candidate: PhraseCandidate = {
  id: "phrase-1",
  sourceId: "source-1",
  text: "I ran out of time.",
  translation: "Eu fiquei sem tempo.",
  status: "accepted",
  createdAt: 1,
};

const card: Card = {
  id: "card-1",
  front: "I ran out of time.",
  back: "Eu fiquei sem tempo.",
  concept: "run out of",
  source: { kind: "phrase", id: candidate.id },
  createdAt: 1,
};

describe("buildProductiveCardPairs", () => {
  it("adds an explicit production sibling without exposing the answer", () => {
    const result = buildProductiveCardPairs([card], [{ kind: "phrase", candidate }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ direction: "recognition", front: card.front });
    expect(result[1]).toMatchObject({
      direction: "production",
      front: candidate.translation,
      back: candidate.text,
      patternId: result[0].patternId,
    });
  });

  it("does not duplicate cards whose direction is already authored", () => {
    const result = buildProductiveCardPairs([{ ...card, direction: "production" }]);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("production");
  });

  it("uses a cloze when an imported phrase has no learner-language meaning", () => {
    const withoutTranslation = { ...candidate, translation: undefined };
    const production = buildProductiveCardPairs(
      [{ ...card, back: "Explain the meaning." }],
      [{ kind: "phrase", candidate: withoutTranslation }],
    )[1];
    expect(production.front).toContain("____");
    expect(production.front).not.toContain(candidate.text);
    expect(production.back).toBe(candidate.text);
  });
});
