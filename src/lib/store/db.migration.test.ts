import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { STORES, getAll, openDb, type StoreName } from "./db";
import {
  getC1Diagnoses,
  getCards,
  getDueCards,
  getProgressAssessments,
  getSrs,
  saveC1Diagnosis,
  saveProgressAssessment,
} from "./repository";

/**
 * Migration safety. The trust-critical property of a local-first app: a user who installed
 * an older build (lower IndexedDB version, fewer object stores) must upgrade to the current
 * schema *without losing the study data they already accumulated*. `openDb`'s
 * `onupgradeneeded` only ever creates missing stores — it must never drop existing ones.
 *
 * This file is intentionally separate from repository.backup.test.ts so it gets a fresh
 * module state (and therefore a null `dbPromise`): we can seed a legacy-version DB by hand
 * *before* the real code opens the database at the current version and runs the upgrade.
 */

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

/**
 * Recreate an early version of the DB: only the `cards` and `srs` stores existed, seeded
 * with real study data. Newer stores (progressAssessments, pronunciationAttempts, …) are
 * deliberately absent so the upgrade has to add them.
 */
function seedLegacyDb(version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tts-cards", version);
    req.onupgradeneeded = () => {
      const db = req.result;
      const cards = db.createObjectStore("cards", { keyPath: "id" });
      cards.createIndex("createdAt", "createdAt");
      const srs = db.createObjectStore("srs", { keyPath: "cardId" });
      srs.createIndex("due", "due");
    };
    req.onsuccess = () => {
      const db = req.result;
      const t = db.transaction(["cards", "srs"], "readwrite");
      t.objectStore("cards").put(makeCard("legacy-card"));
      t.objectStore("srs").put({
        cardId: "legacy-card",
        due: 1_000,
        reps: 3,
        lapses: 1,
        stability: 4.2,
        difficulty: 5.1,
        state: 2,
        lastReview: 1_700_000_050_000,
      });
      t.oncomplete = () => {
        // Must close before the real code reopens at a higher version, or the
        // version-change transaction is blocked.
        db.close();
        resolve();
      };
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe("IndexedDB schema migration", () => {
  it("upgrades a legacy DB to the current schema without dropping existing data", async () => {
    await seedLegacyDb(1);

    // The real code opens at the current DB_VERSION, firing onupgradeneeded (1 -> current).
    // Existing stores keep their rows; missing stores get created.
    const cards = await getCards();
    expect(cards.map((c) => c.id)).toContain("legacy-card");

    const srs = await getSrs("legacy-card");
    expect(srs?.reps).toBe(3);
    expect(srs?.lapses).toBe(1);

    // Indexes declared on pre-existing stores keep working after the upgrade: the `due`
    // index is what the whole Study queue depends on.
    const due = await getDueCards(2_000);
    expect(due.map((d) => d.card.id)).toContain("legacy-card");

    // A store that did NOT exist in the legacy DB must now be present and writable.
    await saveProgressAssessment({
      id: "assess-after-migration",
      createdAt: 1_700_000_200_000,
      levelEstimate: "B1",
    } as unknown as Parameters<typeof saveProgressAssessment>[0]);
    const assessments = await getProgressAssessments();
    expect(assessments.map((a) => a.id)).toContain("assess-after-migration");

    await saveC1Diagnosis({
      id: "c1-after-migration",
      domain: "work",
      sampleText: "sample",
      errors: [],
      refinements: [],
      createdAt: 1_700_000_300_000,
    });
    const diagnoses = await getC1Diagnoses();
    expect(diagnoses.map((d) => d.id)).toContain("c1-after-migration");
  });

  it("exposes every declared store as a readable object store after open", async () => {
    const db = await openDb();
    const declared = Object.values(STORES) as StoreName[];
    for (const store of declared) {
      expect(db.objectStoreNames.contains(store)).toBe(true);
      // Reading through the real helper must not throw for any declared store.
      await expect(getAll(store)).resolves.toBeInstanceOf(Array);
    }
  });
});
