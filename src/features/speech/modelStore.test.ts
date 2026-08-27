import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onboardingComplete = vi.fn(() => true);

vi.mock("@/features/settings/learningProfile", () => ({
  isOnboardingComplete: () => onboardingComplete(),
}));

import {
  __resetModelStore,
  getSnapshot,
  refresh,
  retry,
  subscribe,
  watchModelNotReady,
} from "@/features/speech/modelStore";

type StatusBody = Record<string, unknown>;

/** Queue of `/api/status` bodies; the last one repeats once the queue drains. */
let statusQueue: StatusBody[] = [];
let ensureResponse: { ok: boolean; body: StatusBody } = { ok: true, body: {} };
let ensureCalls = 0;
let whisperEnsureCalls = 0;

function jsonResponse(ok: boolean, body: StatusBody) {
  return { ok, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  statusQueue = [];
  ensureResponse = { ok: true, body: {} };
  ensureCalls = 0;
  whisperEnsureCalls = 0;
  const listeners = new Map<string, Set<EventListener>>();
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: EventListener) => listeners.get(type)?.delete(fn),
    dispatchEvent: (event: { type: string }) => {
      for (const fn of listeners.get(event.type) ?? []) fn(event as unknown as Event);
      return true;
    },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("/api/models/kokoro")) {
      ensureCalls += 1;
      return jsonResponse(ensureResponse.ok, ensureResponse.body);
    }
    if (String(url).includes("/api/models/whisper")) {
      whisperEnsureCalls += 1;
      return jsonResponse(ensureResponse.ok, ensureResponse.body);
    }
    const next = statusQueue.length > 1 ? statusQueue.shift()! : statusQueue[0] ?? {};
    return jsonResponse(true, next);
  }));
  onboardingComplete.mockReturnValue(true);
});

afterEach(() => {
  __resetModelStore();
  vi.unstubAllGlobals();
});

describe("modelStore — Kokoro", () => {
  it("starts the download by itself once onboarding is done", async () => {
    statusQueue = [{ kokoro_installed: false }, { kokoro_installed: false, downloading_kokoro: true }];

    await refresh();

    expect(ensureCalls).toBe(1);
    expect(getSnapshot("kokoro").downloading).toBe(true);
    expect(getSnapshot("kokoro").ready).toBe(false);
  });

  it("leaves the download alone until onboarding is complete", async () => {
    onboardingComplete.mockReturnValue(false);
    statusQueue = [{ kokoro_installed: false }];

    await refresh();

    expect(ensureCalls).toBe(0);
    expect(getSnapshot("kokoro")).toMatchObject({ ready: false, downloading: false, error: null });
  });

  it("auto-starts as soon as onboarding completes, without a reload", async () => {
    onboardingComplete.mockReturnValue(false);
    statusQueue = [{ kokoro_installed: false }];
    const unsubscribe = subscribe(() => {});
    await refresh();
    expect(ensureCalls).toBe(0);

    onboardingComplete.mockReturnValue(true);
    window.dispatchEvent({ type: "phraseloop:profile-updated" } as Event);
    await vi.waitFor(() => expect(ensureCalls).toBe(1));

    unsubscribe();
  });

  it("does not retry in a loop after a failed install", async () => {
    statusQueue = [{ kokoro_installed: false }];
    ensureResponse = { ok: false, body: { error: "Disk full" } };

    await refresh();
    await vi.waitFor(() => expect(getSnapshot("kokoro").error).toBe("Disk full"));
    expect(getSnapshot("kokoro").downloading).toBe(false);

    // Every later status poll sees the same "missing" model; none may re-fire it.
    await refresh();
    await refresh();
    expect(ensureCalls).toBe(1);
  });

  it("retries only when the user asks", async () => {
    statusQueue = [{ kokoro_installed: false }];
    ensureResponse = { ok: false, body: { error: "Network unreachable" } };
    await refresh();
    await vi.waitFor(() => expect(getSnapshot("kokoro").error).toBe("Network unreachable"));

    ensureResponse = { ok: true, body: {} };
    statusQueue = [{ kokoro_installed: false, downloading_kokoro: true }];
    await retry("kokoro");

    expect(ensureCalls).toBe(2);
    expect(getSnapshot("kokoro")).toMatchObject({ downloading: true, error: null });
  });

  it("clears the banner state once the model is installed", async () => {
    statusQueue = [{ kokoro_installed: true }];

    await refresh();

    expect(getSnapshot("kokoro")).toMatchObject({
      ready: true,
      downloading: false,
      progress: undefined,
      error: null,
    });
    expect(ensureCalls).toBe(0);
  });

  it("keeps every subscriber on one shared snapshot", async () => {
    statusQueue = [
      { kokoro_installed: false, downloading_kokoro: true, kokoro_progress: 0.4 },
    ];
    const seen: number[] = [];
    const unsubA = subscribe(() => seen.push(1));
    const unsubB = subscribe(() => seen.push(2));

    await refresh();

    expect(seen).toContain(1);
    expect(seen).toContain(2);
    expect(getSnapshot("kokoro").progress).toBe(0.4);
    unsubA();
    unsubB();
  });

  it("holds the last good state when a status check fails", async () => {
    statusQueue = [
      { kokoro_installed: false, downloading_kokoro: true, kokoro_progress: 0.6 },
    ];
    await refresh();
    const before = getSnapshot("kokoro");

    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await refresh();

    expect(getSnapshot("kokoro")).toBe(before);
  });
});

describe("modelStore — Whisper", () => {
  it("surfaces a download the server started on its own", async () => {
    statusQueue = [
      {
        kokoro_installed: true,
        whisper_installed: false,
        downloading_whisper: true,
        whisper_progress: 0.25,
      },
    ];

    await refresh();

    expect(getSnapshot("whisper")).toMatchObject({
      ready: false,
      downloading: true,
      progress: 0.25,
    });
    // Watching is not starting: the transcription route owns that trigger.
    expect(whisperEnsureCalls).toBe(0);
  });

  it("never auto-starts on its own the way Kokoro does", async () => {
    statusQueue = [{ kokoro_installed: true, whisper_installed: false }];

    await refresh();
    await refresh();

    expect(whisperEnsureCalls).toBe(0);
    expect(getSnapshot("whisper")).toMatchObject({ ready: false, downloading: false });
  });

  it("tracks each model's own progress when both download at once", async () => {
    statusQueue = [
      {
        kokoro_installed: false,
        downloading_kokoro: true,
        kokoro_progress: 0.8,
        whisper_installed: false,
        downloading_whisper: true,
        whisper_progress: 0.1,
      },
    ];

    await refresh();

    expect(getSnapshot("kokoro").progress).toBe(0.8);
    expect(getSnapshot("whisper").progress).toBe(0.1);
  });

  it("blames the runtime's error only on a model that was actually started", async () => {
    statusQueue = [
      {
        kokoro_installed: false,
        downloading_kokoro: true,
        whisper_installed: false,
        error: "Checksum mismatch for kokoro-1.0",
      },
    ];

    await refresh();

    expect(getSnapshot("kokoro").error).toBe("Checksum mismatch for kokoro-1.0");
    expect(getSnapshot("whisper").error).toBeNull();
  });

  it("reports a failure of a download the server started", async () => {
    statusQueue = [
      { kokoro_installed: true, whisper_installed: false, downloading_whisper: true },
      { kokoro_installed: true, whisper_installed: false, error: "Model download failed (503)" },
    ];

    await refresh();
    expect(getSnapshot("whisper").downloading).toBe(true);

    await refresh();

    expect(getSnapshot("whisper")).toMatchObject({
      ready: false,
      downloading: false,
      error: "Model download failed (503)",
    });
  });

  it("starts watching a download the runtime kicked off behind a 409", async () => {
    // Nothing is downloading yet as far as this client knows, so the store is
    // idle — exactly the case where the download used to run invisibly.
    statusQueue = [{ kokoro_installed: true, whisper_installed: false }];
    await refresh();
    expect(getSnapshot("whisper").downloading).toBe(false);

    statusQueue = [
      {
        kokoro_installed: true,
        whisper_installed: false,
        downloading_whisper: true,
        whisper_progress: 0.05,
      },
    ];
    watchModelNotReady("whisper");

    expect(getSnapshot("whisper").downloading).toBe(true);
    await vi.waitFor(() => expect(getSnapshot("whisper").progress).toBe(0.05));
    // It watches; it never fires a second install of its own.
    expect(whisperEnsureCalls).toBe(0);
  });

  it("ignores a model id it does not know", async () => {
    statusQueue = [{ kokoro_installed: true, whisper_installed: false }];
    await refresh();

    watchModelNotReady(undefined);
    watchModelNotReady("llama");

    expect(getSnapshot("whisper").downloading).toBe(false);
  });

  it("marks the model ready once it lands", async () => {
    statusQueue = [
      { kokoro_installed: true, whisper_installed: false, downloading_whisper: true },
      { kokoro_installed: true, whisper_installed: true },
    ];

    await refresh();
    await refresh();

    expect(getSnapshot("whisper")).toMatchObject({
      ready: true,
      downloading: false,
      progress: undefined,
      error: null,
    });
  });
});
