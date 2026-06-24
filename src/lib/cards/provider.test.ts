import { describe, expect, it, vi } from "vitest";
import { generateDeck, generateVettedCards } from "./provider";
import type { CardGenerationProvider } from "./provider";
import type { Card, CardSource, Critique } from "./schema";

const ERROR_ID = "err-1";

const source: CardSource = {
  kind: "error",
  event: {
    id: ERROR_ID,
    original: "I have 25 years",
    corrected: "I am 25 years old",
    errorTypes: ["other"],
    sourceLang: "pt",
    targetLang: "en",
    createdAt: 0,
  },
};

/** A grounded card for `source` (points back to the exact ErrorEvent id). */
function card(front: string): Card {
  return {
    id: crypto.randomUUID(),
    front,
    back: "I am 25 years old",
    concept: "age with 'to be'",
    source: { kind: "error", id: ERROR_ID },
    createdAt: 0,
  };
}

/** Minimal provider whose generate()/critique() are stubbed per test. */
function makeProvider(
  over: Partial<CardGenerationProvider> & Pick<CardGenerationProvider, "generate">,
): CardGenerationProvider {
  return {
    kind: "ollama",
    label: "test",
    isLocal: true,
    mine: vi.fn(),
    critique: vi.fn(),
    ...over,
  } as CardGenerationProvider;
}

describe("generateVettedCards", () => {
  it("skips critique() entirely when the provider opts out", async () => {
    const critique = vi.fn<(card: Card, source: CardSource) => Promise<Critique>>();
    const provider = makeProvider({
      skipCritique: true,
      generate: vi.fn().mockResolvedValue([card("a"), card("b")]),
      critique,
    });

    const kept = await generateVettedCards(provider, source);

    expect(critique).not.toHaveBeenCalled();
    expect(kept).toHaveLength(2);
  });

  it("caps kept cards per source", async () => {
    const provider = makeProvider({
      skipCritique: true,
      generate: vi.fn().mockResolvedValue([card("a"), card("b"), card("c"), card("d")]),
    });

    const kept = await generateVettedCards(provider, source);

    expect(kept).toHaveLength(2);
  });

  it("drops cards not grounded in the source even when skipping critique", async () => {
    const stray = card("stray");
    stray.source = { kind: "error", id: "someone-else" };
    const provider = makeProvider({
      skipCritique: true,
      generate: vi.fn().mockResolvedValue([stray, card("ok")]),
    });

    const kept = await generateVettedCards(provider, source);

    expect(kept).toHaveLength(1);
    expect(kept[0].front).toBe("ok");
  });

  it("still runs the critique gate for providers that keep it", async () => {
    const provider = makeProvider({
      generate: vi.fn().mockResolvedValue([card("keep-me"), card("drop-me")]),
      critique: vi
        .fn<(card: Card) => Promise<Critique>>()
        .mockImplementation(async (c) =>
          c.front === "keep-me"
            ? { verdict: "keep", reason: "good" }
            : { verdict: "drop", reason: "redundant" },
        ),
    });

    const kept = await generateVettedCards(provider, source);

    expect(provider.critique).toHaveBeenCalledTimes(2);
    expect(kept).toHaveLength(1);
    expect(kept[0].front).toBe("keep-me");
  });

  it("stops before starting another source when aborted", async () => {
    const controller = new AbortController();
    const sources = Array.from({ length: 6 }, (_, index): CardSource => ({
      kind: "error",
      event: {
        id: `err-${index}`,
        original: "I have 25 years",
        corrected: "I am 25 years old",
        errorTypes: ["other"],
        sourceLang: "pt",
        targetLang: "en",
        createdAt: 0,
      },
    }));
    const generate = vi.fn(async () => {
      controller.abort();
      return [];
    });
    const provider = makeProvider({
      skipCritique: true,
      generate,
    });

    await expect(generateDeck(provider, sources, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(generate).toHaveBeenCalled();
    expect(generate.mock.calls.length).toBeLessThan(sources.length);
  });

  it("reuses cached embeddings for the same provider model and card fingerprints", async () => {
    const cards = [card("first prompt"), card("second prompt")];
    const embed = vi.fn(async () => [
      [1, 0],
      [0, 1],
    ]);
    const provider = makeProvider({
      skipCritique: true,
      embeddingCacheKey: "test-embed-model",
      generate: vi.fn().mockResolvedValue(cards),
      embed,
    });

    await generateDeck(provider, [source]);
    await generateDeck(provider, [source]);

    expect(embed).toHaveBeenCalledTimes(1);
  });
});
