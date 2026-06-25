/**
 * D1 — local-first store: a tiny promise wrapper over IndexedDB.
 *
 * Browser-only. Everything the long-game needs (sources, cards, SRS state, reviews)
 * lives here so nothing leaves the device. The sources (ErrorEvent / PhraseCandidate)
 * are the source of truth; cards and reviews are derived.
 */

const DB_NAME = "tts-cards";
// v4: adds `learningPlan` and `effortHistory` stores (90-day plan system).
const DB_VERSION = 4;

export const STORES = {
  errorEvents: "errorEvents",
  phraseCandidates: "phraseCandidates",
  cards: "cards",
  srs: "srs",
  reviews: "reviews",
  conversations: "conversations",
  activityLog: "activityLog",
  learningPlan: "learningPlan",
  effortHistory: "effortHistory",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function isStoreAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openDb(): Promise<IDBDatabase> {
  if (!isStoreAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.errorEvents)) {
        db.createObjectStore(STORES.errorEvents, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.phraseCandidates)) {
        const s = db.createObjectStore(STORES.phraseCandidates, { keyPath: "id" });
        s.createIndex("sourceId", "sourceId");
      }
      if (!db.objectStoreNames.contains(STORES.cards)) {
        const s = db.createObjectStore(STORES.cards, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORES.srs)) {
        const s = db.createObjectStore(STORES.srs, { keyPath: "cardId" });
        s.createIndex("due", "due");
      }
      if (!db.objectStoreNames.contains(STORES.reviews)) {
        const s = db.createObjectStore(STORES.reviews, { keyPath: "id" });
        s.createIndex("cardId", "cardId");
        s.createIndex("reviewedAt", "reviewedAt");
      }
      if (!db.objectStoreNames.contains(STORES.conversations)) {
        const s = db.createObjectStore(STORES.conversations, { keyPath: "id" });
        s.createIndex("startedAt", "startedAt");
      }
      if (!db.objectStoreNames.contains(STORES.activityLog)) {
        const s = db.createObjectStore(STORES.activityLog, { keyPath: "id" });
        s.createIndex("ts", "ts");
        s.createIndex("type", "type");
      }
      if (!db.objectStoreNames.contains(STORES.learningPlan)) {
        db.createObjectStore(STORES.learningPlan, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.effortHistory)) {
        db.createObjectStore(STORES.effortHistory, { keyPath: "weekOf" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Atomically write many records into one store in a single transaction. */
export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    const os = t.objectStore(store);
    for (const v of values) os.put(v);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return reqToPromise(db.transaction(store, "readonly").objectStore(store).get(key));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return reqToPromise(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function getAllFromIndex<T>(
  store: StoreName,
  index: string,
  query?: IDBKeyRange | IDBValidKey,
): Promise<T[]> {
  const db = await openDb();
  return reqToPromise(
    db.transaction(store, "readonly").objectStore(store).index(index).getAll(query),
  );
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function count(store: StoreName): Promise<number> {
  const db = await openDb();
  return reqToPromise(db.transaction(store, "readonly").objectStore(store).count());
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const names = Object.values(STORES) as StoreName[];
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(names, "readwrite");
    for (const n of names) t.objectStore(n).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
