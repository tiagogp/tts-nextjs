import { describe, expect, it } from "vitest";
import { orientCardsForTargetFront, targetTextOfCard } from "./orientation";
import type { Card, CardSource } from "./schema";

const phraseSource: CardSource = {
  kind: "phrase",
  candidate: {
    id: "phrase-1",
    sourceId: "source-1",
    text: "I have to get going",
    translation: "Tenho que ir",
    status: "accepted",
    createdAt: 0,
  },
};

function card(front: string, back: string): Card {
  return {
    id: "card-1",
    front,
    back,
    concept: "useful phrase",
    source: { kind: "phrase", id: "phrase-1" },
    createdAt: 0,
  };
}

describe("orientCardsForTargetFront", () => {
  it("keeps English-front cards as-is", () => {
    const [oriented] = orientCardsForTargetFront(
      [card("I have to get going", "Tenho que ir")],
      [phraseSource],
      "en",
    );

    expect(oriented.front).toBe("I have to get going");
    expect(oriented.back).toBe("Tenho que ir");
  });

  it("swaps cards that came back Portuguese-front and English-back", () => {
    const [oriented] = orientCardsForTargetFront(
      [card("Tenho que ir", "I have to get going")],
      [phraseSource],
      "en",
    );

    expect(oriented.front).toBe("I have to get going");
    expect(oriented.back).toBe("Tenho que ir");
  });

  it("never re-orients a card that declares its direction", () => {
    const production: Card = {
      ...card("Tenho que ir", "I have to get going"),
      direction: "production",
    };
    const [oriented] = orientCardsForTargetFront([production], [phraseSource], "en");

    // Portuguese-front is the point of a production card; the heuristic must not undo it.
    expect(oriented.front).toBe("Tenho que ir");
    expect(oriented.back).toBe("I have to get going");
  });
});

describe("targetTextOfCard", () => {
  it("reads the English side from either direction", () => {
    const recognition = { ...card("I have to get going", "Tenho que ir"), direction: "recognition" as const };
    const production = { ...card("Tenho que ir", "I have to get going"), direction: "production" as const };

    expect(targetTextOfCard(recognition)).toBe("I have to get going");
    expect(targetTextOfCard(production)).toBe("I have to get going");
    // Legacy cards carry no direction and are treated as English-front.
    expect(targetTextOfCard(card("I have to get going", "Tenho que ir"))).toBe("I have to get going");
  });
});
