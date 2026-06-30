const STORAGE_KEY = "phraseloop:first-run-activation";

export interface FirstRunActivation {
  source: "demo_lesson";
  lessonId?: string;
  startedAt: number;
  phrasesSavedAt?: number;
  firstReviewAt?: number;
}

export interface ActivationTiming {
  source: "demo_lesson";
  lessonId?: string;
  zeroSetup: true;
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
    const parsed = JSON.parse(raw) as Partial<FirstRunActivation>;
    if (parsed.source !== "demo_lesson" || typeof parsed.startedAt !== "number") return null;
    return {
      source: "demo_lesson",
      lessonId: parsed.lessonId,
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
    lessonId: session.lessonId,
    zeroSetup: true,
    startedAt: session.startedAt,
    elapsedMs: Math.max(0, at - session.startedAt),
  };
}

export function startFirstRunActivation(
  lessonId: string,
  at = Date.now(),
  storage = getStorage(),
): void {
  write({ source: "demo_lesson", lessonId, startedAt: at }, storage);
}

export function markFirstRunPhrasesSaved(input: {
  lessonId: string;
  at?: number;
  storage?: StorageLike | null;
}): ActivationTiming | undefined {
  const at = input.at ?? Date.now();
  const storage = input.storage ?? getStorage();
  const session = read(storage);
  if (!session || session.source !== "demo_lesson") return undefined;
  const next = { ...session, lessonId: input.lessonId, phrasesSavedAt: at };
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
