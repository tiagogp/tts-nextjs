import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import { Rating } from "@/lib/srs/fsrs";
import type { SrsRecord } from "@/lib/srs/fsrs";
import { STORES, clearAll, del, getMany, put } from "./db";
import {
  countDueCards,
  getCard,
  getCounts,
  getDueCards,
  getReviewsSince,
  getSrs,
  recordReview,
  saveCards,
  saveGeneratedDeck,
} from "./repository";

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

function makeCandidate(id: string, text: string): PhraseCandidate {
  return {
    id,
    sourceId: "source-1",
    text,
    status: "accepted",
    createdAt: 1_700_000_000_000,
  };
}

async function setDue(cardId: string, due: number): Promise<void> {
  const srs = await getSrs(cardId);
  expect(srs).toBeDefined();
  await put<SrsRecord>(STORES.srs, { ...srs!, due });
}

describe("getMany (db)", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("returns records in key order with undefined holes for missing keys", async () => {
    await saveCards([makeCard("a"), makeCard("b")]);
    const result = await getMany<Card>(STORES.cards, ["b", "missing", "a"]);
    expect(result.map((card) => card?.id)).toEqual(["b", undefined, "a"]);
  });

  it("returns an empty array for no keys without opening a transaction", async () => {
    expect(await getMany<Card>(STORES.cards, [])).toEqual([]);
  });
});

describe("countDueCards / getCounts", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("counts only cards due at or before now, straight off the index", async () => {
    const now = 1_700_000_500_000;
    await saveCards([makeCard("due-1"), makeCard("due-2"), makeCard("later")]);
    await setDue("due-1", now - 1_000);
    await setDue("due-2", now);
    await setDue("later", now + 60_000);

    expect(await countDueCards(now)).toBe(2);
    expect((await getDueCards(now)).map((item) => item.card.id)).toEqual([
      "due-1",
      "due-2",
    ]);
  });

  it("keeps getCounts().due in agreement with getDueCards()", async () => {
    await saveCards([makeCard("x"), makeCard("y")]);
    const counts = await getCounts();
    expect(counts.cards).toBe(2);
    expect(counts.due).toBe((await getDueCards()).length);
  });
});

describe("getDueCards batching", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("orders by oldest due first and skips SRS rows whose card is gone", async () => {
    const now = 1_700_000_500_000;
    await saveCards([makeCard("old"), makeCard("new"), makeCard("orphan")]);
    await setDue("old", now - 120_000);
    await setDue("new", now - 1_000);
    await setDue("orphan", now - 60_000);
    // Delete only the card, leaving its SRS row behind.
    await del(STORES.cards, "orphan");

    const due = await getDueCards(now);
    expect(due.map((item) => item.card.id)).toEqual(["old", "new"]);
    expect(due.map((item) => item.srs.cardId)).toEqual(["old", "new"]);
  });
});

describe("scoped card orientation", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("still orients a single card using only its own source", async () => {
    const candidate = makeCandidate("phrase-swap", "I have been working here");
    const card = makeCard("swap", {
      // Portuguese front / English back, with the back matching the source text —
      // exactly the shape orientation must flip so English faces front.
      front: "Eu trabalho aqui",
      back: "I have been working here",
      source: { kind: "phrase", id: candidate.id },
    });
    await saveGeneratedDeck([card], [candidate]);

    const stored = await getCard("swap");
    expect(stored?.front).toBe("I have been working here");
    expect(stored?.back).toBe("Eu trabalho aqui");
  });
});

describe("saveCards batching", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("re-saving cards keeps their SRS state and reports only new additions", async () => {
    await saveCards([makeCard("keep")]);
    const before = await getSrs("keep");
    await recordReview(makeCard("keep"), before!, Rating.Good);
    const advanced = await getSrs("keep");
    expect(advanced!.reps).toBe(before!.reps + 1);

    const { added } = await saveCards([makeCard("keep"), makeCard("fresh")]);
    expect(added).toBe(1);
    // The graded card's SRS state must survive the re-save untouched.
    expect((await getSrs("keep"))!.reps).toBe(advanced!.reps);
    expect(await getSrs("fresh")).toBeDefined();
  });
});

describe("getReviewsSince", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("returns only reviews graded at or after the cutoff", async () => {
    await saveCards([makeCard("r")]);
    const card = makeCard("r");
    const srs1 = await getSrs("r");
    const { next: srs2 } = await recordReview(card, srs1!, Rating.Good, undefined, new Date(1_700_000_000_000));
    await recordReview(card, srs2, Rating.Good, undefined, new Date(1_700_000_200_000));

    const recent = await getReviewsSince(1_700_000_100_000);
    expect(recent).toHaveLength(1);
    expect(recent[0].reviewedAt).toBe(1_700_000_200_000);
    expect(await getReviewsSince(0)).toHaveLength(2);
  });
});
