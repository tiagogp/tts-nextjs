import { isOnboardingComplete } from "@/features/settings/learningProfile";

/**
 * One process-wide store for the local model installs (Kokoro for voice,
 * Whisper for speech recognition).
 *
 * Several surfaces need this state at once (the app-wide bar, Speak, Correct's
 * deck export, Anki export, the speaking drills). A per-component hook meant
 * one poller per surface hitting `/api/status` every two seconds and as many
 * copies of the truth that could disagree mid-download. A module singleton
 * gives every call site the same snapshot from a single poller, with no
 * provider plumbing — and one poll now covers both models.
 *
 * It also owns the *automatic* first-run Kokoro download: the model is ~349 MB,
 * and the honest moment to fetch it is right after onboarding — while the
 * learner is reading their first lesson — not when they finally press play and
 * hit a wall. See `maybeAutoStart`. Whisper is deliberately *not* auto-started
 * here: the flows that need it start it when they need it — the runtime on the
 * first transcription, the video import by calling `ensure` up front — and this
 * store's job is to make that visible instead of leaving the learner with a
 * silent 488 MB download.
 */

export type LocalModelId = "kokoro" | "whisper";

export const LOCAL_MODEL_IDS: readonly LocalModelId[] = ["kokoro", "whisper"];

interface ModelStatusResponse {
  kokoro_installed?: boolean;
  whisper_installed?: boolean;
  loading_kokoro?: boolean;
  downloading_kokoro?: boolean;
  loading_whisper?: boolean;
  downloading_whisper?: boolean;
  kokoro_progress?: number;
  whisper_progress?: number;
  download_progress?: number;
  error?: string | null;
}

export interface LocalModelSnapshot {
  /** null while the first status check is in flight. */
  ready: boolean | null;
  downloading: boolean;
  /** 0..1 while downloading, undefined otherwise. */
  progress: number | undefined;
  error: string | null;
}

/** Which `/api/status` fields describe each model. */
const STATUS_FIELDS: Record<
  LocalModelId,
  {
    installed: keyof ModelStatusResponse;
    loading: keyof ModelStatusResponse;
    downloading: keyof ModelStatusResponse;
    progress: keyof ModelStatusResponse;
  }
> = {
  kokoro: {
    installed: "kokoro_installed",
    loading: "loading_kokoro",
    downloading: "downloading_kokoro",
    progress: "kokoro_progress",
  },
  whisper: {
    installed: "whisper_installed",
    loading: "loading_whisper",
    downloading: "downloading_whisper",
    progress: "whisper_progress",
  },
};

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_ERROR = "Falha ao iniciar o download.";
const PROFILE_EVENT = "phraseloop:profile-updated";

const INITIAL: LocalModelSnapshot = {
  ready: null,
  downloading: false,
  progress: undefined,
  error: null,
};

interface ModelEntry {
  snapshot: LocalModelSnapshot;
  /**
   * Set the moment an install is attempted — automatically, by hand, or by the
   * server on first use — so a failed download never turns the status poll into
   * a retry loop, and so the runtime's single `error` field is only ever blamed
   * on a model we actually tried to install. Only an explicit "try again"
   * clears it.
   */
  attempted: boolean;
  inFlight: Promise<void> | null;
}

const entries: Record<LocalModelId, ModelEntry> = {
  kokoro: { snapshot: INITIAL, attempted: false, inFlight: null },
  whisper: { snapshot: INITIAL, attempted: false, inFlight: null },
};

const listeners = new Set<() => void>();
let poll: ReturnType<typeof setInterval> | null = null;

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function emit(id: LocalModelId, next: Partial<LocalModelSnapshot>): void {
  const entry = entries[id];
  const merged = { ...entry.snapshot, ...next };
  if (
    merged.ready === entry.snapshot.ready &&
    merged.downloading === entry.snapshot.downloading &&
    merged.progress === entry.snapshot.progress &&
    merged.error === entry.snapshot.error
  ) {
    return;
  }
  entry.snapshot = merged;
  notify();
}

/**
 * Keep polling while any install could still move: one is running, one of our
 * own POSTs is in flight, or a model we started is not on disk yet. A failed
 * install stops the poll — only a retry restarts it.
 */
function syncPolling(): void {
  const busy = LOCAL_MODEL_IDS.some((id) => {
    const { snapshot, attempted, inFlight } = entries[id];
    if (inFlight !== null || snapshot.downloading) return true;
    return attempted && snapshot.ready === false && snapshot.error === null;
  });
  if (busy) {
    if (!poll) poll = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return;
  }
  stopPolling();
}

function stopPolling(): void {
  if (!poll) return;
  clearInterval(poll);
  poll = null;
}

/**
 * Kick off the voice-model install by ourselves, once, when the learner has
 * finished onboarding. Before that the welcome modal owns the screen and the
 * profile (level, native language) isn't saved yet — starting a 349 MB download
 * behind a modal the learner hasn't answered is a surprise, not a convenience.
 */
function maybeAutoStart(): void {
  const entry = entries.kokoro;
  if (entry.attempted || entry.snapshot.ready !== false) return;
  if (!isOnboardingComplete()) return;
  void ensure("kokoro");
}

function applyStatus(id: LocalModelId, data: ModelStatusResponse): void {
  const fields = STATUS_FIELDS[id];
  if (data[fields.installed] === true) {
    emit(id, { ready: true, downloading: false, progress: undefined, error: null });
    return;
  }
  const downloading = data[fields.downloading] === true || data[fields.loading] === true;
  // A download the server started on its own (first transcription, say) counts
  // as an attempt: its failure is ours to report and not to retry blindly.
  if (downloading) entries[id].attempted = true;
  const reported = data[fields.progress] as number | undefined;
  emit(id, {
    ready: false,
    downloading,
    progress: reported ?? (downloading ? data.download_progress : undefined),
    error: entries[id].attempted ? data.error ?? null : null,
  });
}

export async function refresh(): Promise<ModelStatusResponse | undefined> {
  try {
    const res = await fetch("/api/status");
    const data = (await res.json()) as ModelStatusResponse;
    for (const id of LOCAL_MODEL_IDS) applyStatus(id, data);
    maybeAutoStart();
    syncPolling();
    return data;
  } catch {
    // Leave the previous state; a transient status hiccup shouldn't flip the UI.
    return undefined;
  }
}

/** Trigger the one-time download for a model and poll until it lands. */
export function ensure(id: LocalModelId): Promise<void> {
  const entry = entries[id];
  if (entry.inFlight) return entry.inFlight;
  entry.attempted = true;
  emit(id, { downloading: true, error: null });
  syncPolling();

  const run = (async () => {
    try {
      const res = await fetch(`/api/models/${id}`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? DEFAULT_ERROR);
      }
      await refresh();
    } catch (error) {
      const status = await refresh();
      const fields = STATUS_FIELDS[id];
      const installInFlight =
        status?.[fields.installed] !== true &&
        (status?.[fields.downloading] === true || status?.[fields.loading] === true);
      // A POST that raced an install already running is not a failure.
      if (installInFlight) {
        emit(id, { error: null });
        return;
      }
      emit(id, {
        downloading: false,
        error: error instanceof Error ? error.message : DEFAULT_ERROR,
      });
    }
  })();

  entry.inFlight = run.finally(() => {
    entry.inFlight = null;
    syncPolling();
  });
  return entry.inFlight;
}

/**
 * Start watching an install the *server* kicked off. The runtime begins the
 * Whisper download the first time something needs to listen and answers 409 —
 * nothing on this side asked for it, so without this call the store would sit
 * idle (it only polls while it believes something is running) and a 488 MB
 * download would run with no bar and no explanation. Call it wherever a
 * `model_not_ready` response is handled.
 */
export function watchModelNotReady(model: string | undefined): void {
  if (model !== "kokoro" && model !== "whisper") return;
  entries[model].attempted = true;
  emit(model, { ready: false, downloading: true });
  syncPolling();
  void refresh();
}

/** Explicit user retry after a failed install: clears the one-attempt latch. */
export function retry(id: LocalModelId): Promise<void> {
  entries[id].attempted = false;
  emit(id, { error: null });
  return ensure(id);
}

const onProfileUpdated = (): void => maybeAutoStart();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener(PROFILE_EVENT, onProfileUpdated);
    void refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener(PROFILE_EVENT, onProfileUpdated);
    // The installs keep running server-side; we just stop watching them.
    stopPolling();
  };
}

/** Stable per-model getters so `useSyncExternalStore` can bail out on no-ops. */
export const SNAPSHOT_GETTERS: Record<LocalModelId, () => LocalModelSnapshot> = {
  kokoro: () => entries.kokoro.snapshot,
  whisper: () => entries.whisper.snapshot,
};

/** Stable identity so SSR and the first client render agree. */
export const getServerSnapshot = (): LocalModelSnapshot => INITIAL;

export const getSnapshot = (id: LocalModelId): LocalModelSnapshot => entries[id].snapshot;

/** Test-only: drop every bit of module state between cases. */
export function __resetModelStore(): void {
  stopPolling();
  listeners.clear();
  for (const id of LOCAL_MODEL_IDS) {
    entries[id] = { snapshot: INITIAL, attempted: false, inFlight: null };
  }
}
