import { describe, expect, it } from "vitest";
import { DEMO_CARD_IDS, DEMO_PHRASES, DEMO_SOURCE_ID, demoDeckFor, demoResult } from "./demoFixture";

describe("demoFixture", () => {
  it("exposes a ready-made transcript with a clip per phrase", () => {
    expect(demoResult.sourceId).toBe(DEMO_SOURCE_ID);
    expect(demoResult.hasAudio).toBe(true);
    expect(demoResult.segments).toHaveLength(DEMO_PHRASES.length);
    for (const segment of demoResult.segments) {
      expect(segment.clipUrl).toMatch(/^\/demo\/audio\/.+\.wav$/);
    }
  });

  it("builds a deck from kept indexes without any provider", () => {
    const { candidates, cards } = demoDeckFor([2, 0]);

    expect(cards).toHaveLength(2);
    expect(candidates).toHaveLength(2);
    // Sorted ascending so output order is deterministic.
    expect(candidates.map((c) => c.segmentIndex)).toEqual([0, 2]);

    const [first] = cards;
    expect(first.front).toBe(DEMO_PHRASES[0].en);
    expect(first.back).toBe(DEMO_PHRASES[0].pt);
    expect(first.source).toEqual({ kind: "phrase", id: `${DEMO_SOURCE_ID}-0` });
    expect(first.audioClipPath).toBe(DEMO_PHRASES[0].clip);

    // Candidates are accepted so they persist as the source of truth.
    expect(candidates.every((c) => c.status === "accepted")).toBe(true);
    // Each card points back to its candidate.
    expect(cards.map((c) => c.source.id)).toEqual(candidates.map((c) => c.id));
  });

  it("ignores out-of-range indexes", () => {
    const { cards } = demoDeckFor([0, 999, -1]);
    expect(cards).toHaveLength(1);
  });

  it("returns empty deck for no kept phrases", () => {
    expect(demoDeckFor([])).toEqual({ candidates: [], cards: [] });
  });

  it("uses stable card ids so a re-run overwrites instead of duplicating (idempotency)", () => {
    const kept = DEMO_PHRASES.map((_, i) => i);
    const first = demoDeckFor(kept).cards.map((c) => c.id);
    const second = demoDeckFor(kept).cards.map((c) => c.id);

    // Same kept set → identical card ids, so persisting twice (`put` by id) leaves
    // the store's card count unchanged rather than creating duplicates.
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
    expect(first).toEqual(DEMO_CARD_IDS);
  });
});
