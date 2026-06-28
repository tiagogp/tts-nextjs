import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { MAX_AUDIO_UPLOAD_BYTES } from "@/lib/constants";

const localJson = vi.fn();
const localRequest = vi.fn();
const generateDeck = vi.fn();

vi.mock("@/server/localRuntime", () => ({
  localJson,
  localRequest,
}));

vi.mock("@/lib/cards/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cards/provider")>();
  return {
    ...actual,
    generateDeck,
  };
});

vi.mock("@/lib/cards/registry", () => ({
  isProviderAvailable: vi.fn(() => true),
  resolveProvider: vi.fn(() => ({
    kind: "openrouter",
    label: "OpenRouter",
    isLocal: false,
    mine: vi.fn(),
    generate: vi.fn(),
    critique: vi.fn(),
  })),
  providerRegistry: {
    openrouter: () => ({ label: "OpenRouter" }),
    ollama: () => ({ label: "Ollama" }),
    claude: () => ({ label: "Claude" }),
    openai: () => ({ label: "OpenAI" }),
  },
}));

vi.mock("@/server/integrations/ollama", () => ({
  getOllamaStatus: vi.fn(async () => ({ models: ["llama"], online: true })),
  ollamaRoot: vi.fn((value: string) => value),
}));

vi.mock("@/server/native/apkgDebug", () => ({
  apkgDebugLogPath: vi.fn(() => "/tmp/apkg-debug.jsonl"),
  createApkgDebugId: vi.fn(() => "debug-id"),
  validateApkgBytes: vi.fn(async () => ({ ok: true, notes: 1, mediaEntries: 1 })),
  writeApkgDebug: vi.fn(),
}));

function localResponse(body: Buffer | object, status = 200) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return {
    status,
    headers: {},
    body: buffer,
    json<T>() {
      return JSON.parse(buffer.toString("utf8") || "{}") as T;
    },
  };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(path: string, form: FormData): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: form,
  });
}

describe("API route integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("/api/settings returns public provider settings", async () => {
    const { GET } = await import("@/app/api/settings/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.defaultProvider).toBe("ollama");
    expect(data.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "ollama" }),
    ]));
  });

  it("/api/tts proxies one text request to the local runtime", async () => {
    localJson.mockResolvedValueOnce(localResponse(Buffer.from("wav")));
    const { POST } = await import("@/app/api/tts/route");

    const response = await POST(jsonRequest("/api/tts", { text: "hello" }) as never);
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/wav");
    expect(body.toString()).toBe("wav");
    expect(localJson).toHaveBeenCalledWith("/tts", expect.objectContaining({ text: "hello" }), 300_000);
  });

  it("/api/cards/generate returns cards and APKG data for persisted generation", async () => {
    const card: Card = {
      id: "card-1",
      front: "Front?",
      back: "Back",
      concept: "concept",
      source: { kind: "phrase", id: "candidate-1" },
      createdAt: 0,
    };
    generateDeck.mockResolvedValueOnce({ cards: [card], failures: 0 });
    localJson.mockResolvedValueOnce(localResponse(Buffer.from("apkg")));
    const { POST } = await import("@/app/api/cards/generate/route");

    const response = await POST(jsonRequest("/api/cards/generate", {
      provider: "openrouter",
      persist: true,
      sourceId: "source-1",
      candidates: [{
        id: "candidate-1",
        sourceId: "source-1",
        text: "Back",
        status: "accepted",
        createdAt: 0,
      }],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards).toHaveLength(1);
    expect(data.apkg).toBe(Buffer.from("apkg").toString("base64"));
    expect(generateDeck).toHaveBeenCalledOnce();
  });

  it("/api/pronunciation/assess validates missing audio", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Attach an audio file.");
    expect(localRequest).not.toHaveBeenCalled();
  });

  it("/api/pronunciation/assess validates missing target text", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" }));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Add a phrase to assess.");
    expect(localRequest).not.toHaveBeenCalled();
  });

  it("/api/pronunciation/assess rejects oversized audio", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");
    form.append("file", new File([new Uint8Array(MAX_AUDIO_UPLOAD_BYTES + 1)], "clip.webm"));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error).toBe("Audio too large (max 25 MB).");
    expect(localRequest).not.toHaveBeenCalled();
  });

  it("/api/pronunciation/assess rejects long target text", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "a".repeat(501));
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm"));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Phrase is too long for pronunciation practice.");
    expect(localRequest).not.toHaveBeenCalled();
  });

  it("/api/pronunciation/assess proxies audio to the local runtime", async () => {
    localRequest.mockResolvedValueOnce(localResponse({
      targetText: "Good morning.",
      transcript: "good morning",
      scores: { overall: 99, accuracy: 100, completeness: 100, fluency: 96 },
      words: [],
      tips: ["Good rhythm."],
    }));
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");
    form.append("targetLang", "en");
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" }));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scores.overall).toBe(99);
    expect(localRequest).toHaveBeenCalledWith("/pronunciation/assess", expect.objectContaining({
      method: "POST",
      timeoutMs: 120_000,
      headers: expect.objectContaining({
        "X-Target-Text": encodeURIComponent("Good morning."),
        "X-Target-Lang": "en",
      }),
    }));
  });

  it("/api/pronunciation/assess hides runtime failures", async () => {
    localRequest.mockResolvedValueOnce(localResponse({ detail: "failed" }, 500));
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm"));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toContain("Couldn't assess pronunciation");
  });
});
