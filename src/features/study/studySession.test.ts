import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { Rating } from "@/lib/srs/fsrs";
import { clearAll } from "@/lib/store/db";
import { getDueCards, recordReview, saveCards } from "@/lib/store/repository";
import { loadOrderedDueQueue, loadStudySnapshot } from "./studySession";

function makeCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    front: `front ${id}`,
    back: `back ${id}`,
    concept: "preposition after a motion verb",
    source: { kind: "phrase", id: `phrase-${id}` },
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

afterEach(async () => {
  await clearAll();
});

describe("loadStudySnapshot", () => {
  it("returns an empty snapshot when nothing is stored", async () => {
    const snapshot = await loadStudySnapshot();
    expect(snapshot.queue).toEqual([]);
    expect(snapshot.counts).toEqual({ cards: 0, reviews: 0, due: 0 });
    expect(snapshot.cards).toEqual([]);
    expect(snapshot.reviews).toEqual([]);
    expect(snapshot.gate.verdict).toBeDefined();
  });

  it("puts saved cards in the due queue and counts", async () => {
    await saveCards([makeCard("a"), makeCard("b")]);
    const snapshot = await loadStudySnapshot();
    expect(snapshot.counts.cards).toBe(2);
    expect(snapshot.counts.due).toBe(2);
    expect(snapshot.queue.map((c) => c.card.id).sort()).toEqual(["a", "b"]);
  });

  it("lists saved cards newest first", async () => {
    await saveCards([
      makeCard("old"),
      makeCard("new", { createdAt: 1_700_000_000_500 }),
    ]);
    const snapshot = await loadStudySnapshot();
    expect(snapshot.cards.map((c) => c.id)).toEqual(["new", "old"]);
  });

  it("reflects a recorded review in reviews and counts", async () => {
    await saveCards([makeCard("a")]);
    const due = await getDueCards();
    await recordReview(due[0].card, due[0].srs, Rating.Good);
    const snapshot = await loadStudySnapshot();
    expect(snapshot.reviews).toHaveLength(1);
    expect(snapshot.counts.reviews).toBe(1);
  });
});

describe("loadOrderedDueQueue", () => {
  it("returns the same band-gated ordering as the full snapshot", async () => {
    await saveCards([makeCard("a"), makeCard("b"), makeCard("c")]);
    const snapshot = await loadStudySnapshot();
    const ordered = await loadOrderedDueQueue();
    expect(ordered.queue.map((c) => c.card.id)).toEqual(
      snapshot.queue.map((c) => c.card.id),
    );
    expect(ordered.gate.verdict).toBe(snapshot.gate.verdict);
  });

  it("drops a card scheduled out by a review from the due queue", async () => {
    await saveCards([makeCard("a"), makeCard("b")]);
    const due = await getDueCards();
    await recordReview(due[0].card, due[0].srs, Rating.Easy);
    const { queue } = await loadOrderedDueQueue();
    expect(queue.map((c) => c.card.id)).not.toContain(due[0].card.id);
    expect(queue.map((c) => c.card.id)).toContain(due[1].card.id);
  });
});
