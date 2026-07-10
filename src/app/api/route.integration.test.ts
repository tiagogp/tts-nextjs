import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards/schema";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_BYTES,
  YOUTUBE_IMPORT_MAX_DURATION_MINUTES,
  YOUTUBE_IMPORT_TIMEOUT_MS,
} from "@/lib/constants";

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
        text: "Front?",
        status: "accepted",
        createdAt: 0,
      }],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards).toHaveLength(1);
    expect(data.apkg).toBe(Buffer.from("apkg").toString("base64"));
    expect(generateDeck).toHaveBeenCalledOnce();
    expect(localJson).toHaveBeenCalledWith(
      "/cards/apkg",
      expect.objectContaining({
        cards: [
          expect.objectContaining({
            front: "Front?",
            back: "Back",
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it("/api/cards/generate orients inverted cards before exporting and returning them", async () => {
    const card: Card = {
      id: "card-1",
      front: "Tenho que ir",
      back: "I have to get going",
      concept: "have to",
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
      targetLang: "en",
      candidates: [{
        id: "candidate-1",
        sourceId: "source-1",
        text: "I have to get going",
        translation: "Tenho que ir",
        status: "accepted",
        createdAt: 0,
      }],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards[0]).toMatchObject({
      front: "I have to get going",
      back: "Tenho que ir",
    });
    expect(localJson).toHaveBeenCalledWith(
      "/cards/apkg",
      expect.objectContaining({
        cards: [
          expect.objectContaining({
            front: "I have to get going",
            back: "Tenho que ir",
            audioText: "I have to get going",
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it("/api/cards/generate maps a forced provider timeout to typed PT-BR 504 copy", async () => {
    const timeout = new Error("Card generation timed out");
    timeout.name = "TimeoutError";
    generateDeck.mockRejectedValueOnce(timeout);
    const { POST } = await import("@/app/api/cards/generate/route");

    const response = await POST(jsonRequest("/api/cards/generate", {
      provider: "openrouter",
      candidates: [{ id: "c1", sourceId: "s1", text: "Hello there", status: "accepted", createdAt: 0 }],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.code).toBe("provider_timeout");
    expect(data.error).toContain("demorou demais");
  });

  it("/api/cards/generate maps a client abort to typed PT-BR 499 copy", async () => {
    const controller = new AbortController();
    // The user cancels while generation is in flight: the request signal aborts and
    // the pipeline throws its AbortError.
    generateDeck.mockImplementationOnce(async () => {
      controller.abort();
      const abort = new Error("Operation aborted");
      abort.name = "AbortError";
      throw abort;
    });
    const { POST } = await import("@/app/api/cards/generate/route");

    const request = new Request("http://localhost/api/cards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openrouter",
        candidates: [{ id: "c1", sourceId: "s1", text: "Hello there", status: "accepted", createdAt: 0 }],
      }),
      signal: controller.signal,
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(499);
    expect(data.code).toBe("aborted");
    expect(data.error).toContain("cancelada");
  });

  it("/api/cards/generate maps bad input to typed PT-BR 400 copy", async () => {
    const { POST } = await import("@/app/api/cards/generate/route");

    const response = await POST(jsonRequest("/api/cards/generate", {
      provider: "openrouter",
      candidates: [],
      errors: [],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("invalid_input");
    expect(data.error).toContain("Nenhuma frase");
    expect(generateDeck).not.toHaveBeenCalled();
  });

  it("/api/cards/mine maps an upstream provider rejection to typed PT-BR copy", async () => {
    const { resolveProvider } = await import("@/lib/cards/registry");
    const auth = new Error("401 Incorrect API key provided");
    (auth as Error & { status: number }).status = 401;
    vi.mocked(resolveProvider).mockReturnValueOnce({
      kind: "openrouter",
      label: "OpenRouter",
      isLocal: false,
      mine: vi.fn().mockRejectedValueOnce(auth),
      generate: vi.fn(),
      critique: vi.fn(),
    } as never);
    const { POST } = await import("@/app/api/cards/mine/route");

    const response = await POST(jsonRequest("/api/cards/mine", {
      provider: "openrouter",
      segments: [{ text: "Hello there", startMs: 0, endMs: 1000 }],
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.code).toBe("provider_auth");
    expect(data.error).not.toContain("API key");
    expect(data.error).toContain("Configurações");
  });

  it("/api/data reports the data folder and deletes personal files but keeps models", async () => {
    const { mkdtemp, mkdir, writeFile, access } = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const root = await mkdtemp(path.join(os.tmpdir(), "phraseloop-data-"));
    vi.stubEnv("PHRASELOOP_DATA_DIR", root);
    try {
      await mkdir(path.join(root, "discover-cache"), { recursive: true });
      await mkdir(path.join(root, "logs"), { recursive: true });
      await mkdir(path.join(root, "models", "native"), { recursive: true });
      await writeFile(path.join(root, "discover-cache", "clip.m4a"), "audio");
      await writeFile(path.join(root, "logs", "apkg-debug.jsonl"), "{}");
      await writeFile(path.join(root, "voice-reference.wav"), "wav");
      await writeFile(path.join(root, "models", "native", "model.bin"), "weights");

      const { GET, DELETE } = await import("@/app/api/data/route");

      const location = await (await GET()).json();
      expect(location.path).toBe(root);

      const response = await DELETE();
      expect(response.status).toBe(200);
      expect((await response.json()).ok).toBe(true);

      await expect(access(path.join(root, "discover-cache"))).rejects.toThrow();
      await expect(access(path.join(root, "logs"))).rejects.toThrow();
      await expect(access(path.join(root, "voice-reference.wav"))).rejects.toThrow();
      await access(path.join(root, "models", "native", "model.bin"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("/api/pronunciation/assess validates missing audio", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Grave um áudio primeiro.");
    expect(localRequest).not.toHaveBeenCalled();
  });

  it("/api/pronunciation/assess validates missing target text", async () => {
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" }));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Escolha uma frase para avaliar.");
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
    expect(data.error).toBe("Áudio grande demais (máximo 25 MB).");
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
    expect(data.error).toBe("A frase é longa demais para o treino de pronúncia.");
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
    expect(data.error).toContain("Não consegui avaliar a pronúncia");
  });

  it("/api/pronunciation/assess surfaces the Whisper download state instead of hanging", async () => {
    localRequest.mockResolvedValueOnce(localResponse({
      error: "O reconhecimento de voz (Whisper, ~488MB) ainda está sendo preparado. O download começou — tente de novo quando concluir.",
      code: "model_not_ready",
      downloading: true,
      progress: 0.42,
    }, 409));
    const { POST } = await import("@/app/api/pronunciation/assess/route");
    const form = new FormData();
    form.append("targetText", "Good morning.");
    form.append("file", new File([new Uint8Array([1, 2, 3])], "clip.webm"));

    const response = await POST(formRequest("/api/pronunciation/assess", form) as never);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe("model_not_ready");
    expect(data.downloading).toBe(true);
    expect(data.progress).toBe(0.42);
    expect(data.error).toContain("reconhecimento de voz");
  });

  it("/api/discover/article returns recoverable PT-BR copy for bad input", async () => {
    const { POST } = await import("@/app/api/discover/article/route");

    const response = await POST(jsonRequest("/api/discover/article", { url: "notaurl" }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("link http(s) válido");
  });

  it("/api/discover returns recoverable PT-BR copy for bad YouTube input", async () => {
    const { POST } = await import("@/app/api/discover/route");

    const response = await POST(jsonRequest("/api/discover", { url: "notaurl" }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("link http(s) válido");
    expect(data.error).toContain("lição inicial");
  });

  it("/api/discover returns 30-minute PT-BR copy for YouTube runtime failures", async () => {
    localRequest.mockResolvedValueOnce(localResponse({ detail: "failed" }, 500));
    const { POST } = await import("@/app/api/discover/route");

    const response = await POST(jsonRequest("/api/discover", {
      url: "https://www.youtube.com/watch?v=abc123def45",
      lang: "en",
    }) as never);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(`menos de ${YOUTUBE_IMPORT_MAX_DURATION_MINUTES} minutos`);
    expect(body).toContain("lição inicial");
    expect(localRequest).toHaveBeenCalledWith("/discover", expect.objectContaining({
      timeoutMs: YOUTUBE_IMPORT_TIMEOUT_MS,
    }));
  });

  it("/api/discover/pdf returns recoverable PT-BR copy for oversized files", async () => {
    const { POST } = await import("@/app/api/discover/pdf/route");
    const form = new FormData();
    form.append("file", new File([new Uint8Array(MAX_PDF_UPLOAD_BYTES + 1)], "large.pdf", { type: "application/pdf" }));

    const response = await POST(formRequest("/api/discover/pdf", form) as never);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error).toContain("PDF é grande demais");
    expect(data.error).toContain("lição inicial");
  });

  it("/api/models/whisper starts model preparation without waiting for the full download", async () => {
    localRequest.mockResolvedValueOnce(localResponse({ started: true }, 202));
    const { POST } = await import("@/app/api/models/whisper/route");

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.started).toBe(true);
    expect(localRequest).toHaveBeenCalledWith("/models/whisper/ensure", {
      method: "POST",
      timeoutMs: 3_000,
    });
  });
});
