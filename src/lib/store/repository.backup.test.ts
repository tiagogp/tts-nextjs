import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { Rating } from "@/lib/srs/fsrs";
import { clearAll } from "./db";
import {
  exportLocalBackup,
  getCards,
  getDueCards,
  getReviews,
  getSrs,
  recordReview,
  restoreLocalBackup,
  saveCards,
  saveGeneratedDeck,
  saveProgressAssessment,
  validateLocalBackup,
} from "./repository";

describe("local backup validation", () => {
  it("accepts a PhraseLoop backup and summarizes records", () => {
    const result = validateLocalBackup({
      app: "PhraseLoop",
      schemaVersion: 1,
      exportedAt: "2026-06-28T00:00:00.000Z",
      stores: {
        cards: [{ id: "card-1" }],
        srs: [{ cardId: "card-1" }],
        reviews: [{ id: "review-1" }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.totalRecords).toBe(3);
    expect(result.counts.cards).toBe(1);
    expect(result.counts.srs).toBe(1);
    expect(result.exportedAt).toBe("2026-06-28T00:00:00.000Z");
  });

  it("rejects unknown stores and malformed keyed rows", () => {
    const result = validateLocalBackup({
      app: "PhraseLoop",
      schemaVersion: 1,
      stores: {
        mystery: [{ id: "x" }],
        cards: [{}],
        srs: [{}],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Unknown store: mystery.");
    expect(result.errors).toContain("cards[0] is missing an id.");
    expect(result.errors).toContain("srs[0] is missing a cardId.");
  });
});

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

describe("local backup round-trip (W6)", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("survives an export → wipe → restore cycle with every store intact", async () => {
    await saveCards([makeCard("card-1"), makeCard("card-2")]);
    await saveProgressAssessment({
      id: "assess-1",
      createdAt: 1_700_000_100_000,
      levelEstimate: "B1",
    } as unknown as Parameters<typeof saveProgressAssessment>[0]);

    const srs = await getSrs("card-1");
    expect(srs).toBeDefined();
    await recordReview(makeCard("card-1"), srs!, Rating.Good);

    const backup = await exportLocalBackup();
    expect(backup.app).toBe("PhraseLoop");
    expect(backup.schemaVersion).toBe(1);
    expect(backup.stores.cards).toHaveLength(2);
    expect(backup.stores.reviews).toHaveLength(1);

    // Simulate catastrophic local data loss / a reinstall on a new app version.
    await clearAll();
    expect(await getCards()).toHaveLength(0);
    expect(await getReviews()).toHaveLength(0);

    const result = await restoreLocalBackup(backup);
    expect(result.ok).toBe(true);

    const restoredCards = await getCards();
    expect(restoredCards.map((c) => c.id).sort()).toEqual(["card-1", "card-2"]);
    expect(await getReviews()).toHaveLength(1);
    const restoredSrs = await getSrs("card-1");
    expect(restoredSrs?.cardId).toBe("card-1");
    expect(restoredSrs?.reps).toBe(srs!.reps + 1);
  });

  it("merges by id without deleting records absent from the backup", async () => {
    // A backup taken when the deck had a single card...
    await saveCards([makeCard("card-1", { back: "original" })]);
    const backup = await exportLocalBackup();

    // ...then the user keeps studying: edits card-1 and adds card-2.
    await saveCards([makeCard("card-1", { back: "edited locally" }), makeCard("card-2")]);

    const result = await restoreLocalBackup(backup);
    expect(result.ok).toBe(true);

    const cards = await getCards();
    // card-2 (newer than the backup) must NOT be deleted by a merge restore.
    expect(cards.map((c) => c.id).sort()).toEqual(["card-1", "card-2"]);
    // card-1 is overwritten by the backup copy (merge-by-id).
    expect(cards.find((c) => c.id === "card-1")?.back).toBe("original");
  });
});

describe("stored card orientation", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("reads older saved phrase cards as English front and Portuguese answer", async () => {
    await saveGeneratedDeck(
      [
        makeCard("legacy-oriented-card", {
          front: "Tenho que ir",
          back: "I have to get going",
          source: { kind: "phrase", id: "candidate-1" },
        }),
      ],
      [
        {
          id: "candidate-1",
          sourceId: "source-1",
          text: "I have to get going",
          translation: "Tenho que ir",
          status: "accepted",
          createdAt: 1_700_000_000_000,
        },
      ],
    );

    const [saved] = await getCards();
    expect(saved).toMatchObject({
      front: "I have to get going",
      back: "Tenho que ir",
    });

    const [due] = await getDueCards(Date.now() + 1_000);
    expect(due.card).toMatchObject({
      front: "I have to get going",
      back: "Tenho que ir",
    });
  });
});
