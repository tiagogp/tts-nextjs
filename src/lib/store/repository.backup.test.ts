import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { Rating } from "@/lib/srs/fsrs";
import { STORES, clearAll, getAll, putMany, type StoreName } from "./db";
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
  wipeLocalData,
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

/**
 * Phase 4 "Trust & Proof" — zero-loss backup on weeks-scale organic data.
 *
 * A moderated restore run proves zero loss on ONE real participant. This test proves the same property
 * automatically, across ALL 12 stores, through the exact real path a user hits:
 * export → serialize to a JSON file → parse the file back → dry-run validate →
 * restore. It fills every store with weeks of data (not the handful the high-level
 * API touches) and asserts each record survives byte-for-byte, including FSRS due
 * dates — the protocol's step-6 "due count must survive, not reset" check.
 */
describe("local backup round-trip — weeks-scale zero-loss proof (Phase 4)", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  const DAY = 86_400_000;
  const START = Date.UTC(2026, 5, 1); // 3 weeks of history, deterministic.
  /** The keyPath field per store — used to sort before comparing (getAll is key-ordered). */
  const KEY_FIELD: Record<StoreName, string> = {
    [STORES.errorEvents]: "id",
    [STORES.phraseCandidates]: "id",
    [STORES.cards]: "id",
    [STORES.srs]: "cardId",
    [STORES.reviews]: "id",
    [STORES.conversations]: "id",
    [STORES.activityLog]: "id",
    [STORES.learningPlan]: "id",
    [STORES.effortHistory]: "weekOf",
    [STORES.pronunciationAttempts]: "id",
    [STORES.progressAssessments]: "id",
    [STORES.c1Diagnoses]: "id",
    [STORES.levelTests]: "id",
  };

  function buildSeed(): Record<StoreName, Record<string, unknown>[]> {
    const cards = Array.from({ length: 40 }, (_, i) => ({
      id: `card-${i}`,
      front: `front ${i}`,
      back: `back ${i}`,
      concept: `concept ${i % 7}`,
      source: { kind: "phrase", id: `phrase-${i}` },
      createdAt: START + i * (DAY / 2),
    }));
    return {
      [STORES.errorEvents]: Array.from({ length: 25 }, (_, i) => ({
        id: `error-${i}`,
        text: `I has a mistake ${i}`,
        errorType: ["grammar", "vocab", "spelling"][i % 3],
        createdAt: START + i * (DAY / 2),
      })),
      [STORES.phraseCandidates]: Array.from({ length: 30 }, (_, i) => ({
        id: `phrase-${i}`,
        sourceId: `source-${i % 5}`,
        text: `phrase text ${i}`,
        translation: `tradução ${i}`,
        status: i % 2 ? "accepted" : "pending",
        createdAt: START + i * (DAY / 3),
      })),
      [STORES.cards]: cards,
      // FSRS scheduling: due dates spread across (and past) the 3-week window.
      // These are the values step 6 of the protocol insists must survive, not reset.
      [STORES.srs]: cards.map((c, i) => ({
        cardId: c.id,
        due: START + (i + 1) * DAY,
        stability: 3 + i * 0.5,
        difficulty: 5 + (i % 5),
        elapsed_days: i % 4,
        scheduled_days: (i % 10) + 1,
        reps: i % 6,
        lapses: i % 3,
        state: i % 4,
        last_review: START + i * (DAY / 3),
      })),
      [STORES.reviews]: cards.flatMap((c, i) =>
        Array.from({ length: 3 }, (_, r) => ({
          id: `review-${i}-${r}`,
          cardId: c.id,
          grade: (r % 4) + 1,
          reviewedAt: START + i * DAY + r * (DAY / 4),
          previousState: r % 4,
          scheduledDays: r + 1,
          concept: c.concept,
        })),
      ),
      [STORES.conversations]: Array.from({ length: 5 }, (_, i) => ({
        id: `conv-${i}`,
        createdAt: START + i * DAY,
        turns: [
          { role: "user", text: `hi ${i}` },
          { role: "assistant", text: `hello ${i}` },
        ],
      })),
      [STORES.activityLog]: Array.from({ length: 60 }, (_, i) => ({
        id: `act-${i}`,
        type: ["own_source_started", "own_source_completed", "first_loop_completed", "review"][
          i % 4
        ],
        at: START + i * (DAY / 4),
      })),
      [STORES.learningPlan]: [
        { id: "plan-current", createdAt: START, weeks: [{ focus: "prepositions" }] },
      ],
      [STORES.effortHistory]: Array.from({ length: 3 }, (_, i) => ({
        weekOf: `2026-W${22 + i}`,
        reviews: 40 + i * 10,
        minutes: 30 + i * 5,
      })),
      [STORES.pronunciationAttempts]: Array.from({ length: 12 }, (_, i) => ({
        id: `pron-${i}`,
        cardId: `card-${i}`,
        score: 60 + i,
        createdAt: START + i * DAY,
      })),
      [STORES.progressAssessments]: Array.from({ length: 6 }, (_, i) => ({
        id: `assess-${i}`,
        createdAt: START + i * 3 * DAY,
        levelEstimate: ["A2", "B1"][i % 2],
      })),
      [STORES.c1Diagnoses]: Array.from({ length: 4 }, (_, i) => ({
        id: `c1-${i}`,
        domain: "work",
        sampleText: `sample text ${i}`,
        errors: [],
        refinements: [],
        createdAt: START + i * 4 * DAY,
      })),
      [STORES.levelTests]: Array.from({ length: 3 }, (_, i) => ({
        id: `level-test-${i}`,
        fromLevel: "A1",
        targetLevel: "A2",
        createdAt: START + i * 5 * DAY,
        passed: i === 2,
      })),
    };
  }

  const sortByKey = (store: StoreName, rows: Record<string, unknown>[]) =>
    [...rows].sort((a, b) =>
      String(a[KEY_FIELD[store]]).localeCompare(String(b[KEY_FIELD[store]])),
    );

  it("loses nothing across all 11 stores through export → JSON file → restore", async () => {
    const seed = buildSeed();
    const storeNames = Object.values(STORES) as StoreName[];

    // Guard: the proof is only meaningful if every store is exercised.
    for (const store of storeNames) {
      expect(seed[store].length, `seed for ${store}`).toBeGreaterThan(0);
      await putMany(store, seed[store]);
    }

    const backup = await exportLocalBackup();

    // Faithful to the real flow: the backup is written to a .json file and read back.
    const fromFile = JSON.parse(JSON.stringify(backup)) as unknown;

    // Dry run (Settings → "Validar restauração"): counts must match ground truth.
    const dryRun = validateLocalBackup(fromFile);
    expect(dryRun.ok, dryRun.errors.join("; ")).toBe(true);
    for (const store of storeNames) {
      expect(dryRun.counts[store], `dry-run count for ${store}`).toBe(seed[store].length);
    }
    const expectedTotal = storeNames.reduce((sum, store) => sum + seed[store].length, 0);
    expect(dryRun.totalRecords).toBe(expectedTotal);

    // Catastrophic local data loss.
    await clearAll();
    for (const store of storeNames) {
      expect(await getAll(store)).toHaveLength(0);
    }

    const result = await restoreLocalBackup(fromFile);
    expect(result.ok).toBe(true);
    expect(result.totalRecords).toBe(expectedTotal);

    // Zero loss: every store's records survive byte-for-byte.
    for (const store of storeNames) {
      const restored = await getAll<Record<string, unknown>>(store);
      expect(sortByKey(store, restored), `restored ${store}`).toEqual(
        sortByKey(store, seed[store]),
      );
    }

    // Protocol step 6, explicit: FSRS due dates survive, not reset to "now".
    const restoredSrs = sortByKey(STORES.srs, await getAll(STORES.srs));
    const seededSrs = sortByKey(STORES.srs, seed[STORES.srs]);
    expect(restoredSrs.map((row) => row.due)).toEqual(seededSrs.map((row) => row.due));
  });
});

describe("delete all local data (launch checklist item 8)", () => {
  beforeEach(() => clearAll());
  afterEach(() => {
    vi.unstubAllGlobals();
    return clearAll();
  });

  it("wipes every store and localStorage preferences", async () => {
    const entries = new Map<string, string>([["phraseloop:profile", "{}"]]);
    vi.stubGlobal("localStorage", {
      clear: () => entries.clear(),
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    });

    await saveCards([makeCard("card-1")]);
    expect(await getCards()).toHaveLength(1);
    expect(await getSrs("card-1")).toBeDefined();

    await wipeLocalData();

    expect(await getCards()).toHaveLength(0);
    expect(await getSrs("card-1")).toBeUndefined();
    expect(entries.size).toBe(0);
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
