const STORAGE_KEY = "phraseloop:first-run-activation";

export type FirstRunActivationSource = "bundled_lesson" | "own_source";

export interface FirstRunActivation {
  source: FirstRunActivationSource;
  sourceId?: string;
  startedAt: number;
  phrasesSavedAt?: number;
  firstReviewAt?: number;
}

export interface ActivationTiming {
  source: FirstRunActivationSource;
  sourceId?: string;
  zeroSetup: boolean;
  startedAt: number;
  elapsedMs: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function read(storage = getStorage()): FirstRunActivation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      source?: string;
      sourceId?: string;
      lessonId?: string;
      startedAt?: unknown;
      phrasesSavedAt?: unknown;
      firstReviewAt?: unknown;
    };
    if (typeof parsed.startedAt !== "number") return null;
    const source = parsed.source === "demo_lesson" ? "bundled_lesson" : parsed.source;
    if (source !== "bundled_lesson" && source !== "own_source") return null;
    return {
      source,
      sourceId: parsed.sourceId ?? parsed.lessonId,
      startedAt: parsed.startedAt,
      phrasesSavedAt: typeof parsed.phrasesSavedAt === "number" ? parsed.phrasesSavedAt : undefined,
      firstReviewAt: typeof parsed.firstReviewAt === "number" ? parsed.firstReviewAt : undefined,
    };
  } catch {
    return null;
  }
}

function write(session: FirstRunActivation, storage = getStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Activation timing is diagnostic only; never block the learner path.
  }
}

function timing(session: FirstRunActivation, at: number): ActivationTiming {
  return {
    source: session.source,
    sourceId: session.sourceId,
    zeroSetup: session.source === "bundled_lesson",
    startedAt: session.startedAt,
    elapsedMs: Math.max(0, at - session.startedAt),
  };
}

export function startFirstRunActivation(input: {
  source: FirstRunActivationSource;
  sourceId?: string;
  at?: number;
  storage?: StorageLike | null;
}): void {
  write(
    {
      source: input.source,
      sourceId: input.sourceId,
      startedAt: input.at ?? Date.now(),
    },
    input.storage ?? getStorage(),
  );
}

export function markFirstRunPhrasesSaved(input: {
  sourceId?: string;
  at?: number;
  storage?: StorageLike | null;
}): ActivationTiming | undefined {
  const at = input.at ?? Date.now();
  const storage = input.storage ?? getStorage();
  const session = read(storage);
  if (!session) return undefined;
  const next = { ...session, sourceId: input.sourceId ?? session.sourceId, phrasesSavedAt: at };
  write(next, storage);
  return timing(next, at);
}

export function markFirstRunReviewCompleted(
  input: { at?: number; storage?: StorageLike | null } = {},
): ActivationTiming | undefined {
  const at = input.at ?? Date.now();
  const storage = input.storage ?? getStorage();
  const session = read(storage);
  if (!session || session.firstReviewAt || !session.phrasesSavedAt) return undefined;
  const next = { ...session, firstReviewAt: at };
  write(next, storage);
  return timing(next, at);
}
