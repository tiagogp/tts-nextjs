import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultProvider,
  getOllamaBaseUrl,
  getProviderApiKey,
  replaceRuntimeAiSettings,
} from "./aiSettings";
import { GET as getPublicSettings } from "@/app/api/settings/route";

describe("AI settings", () => {
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalOpenAI = process.env.OPENAI_API_KEY;
  const originalOllama = process.env.OLLAMA_BASE_URL;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    replaceRuntimeAiSettings({});
  });

  afterEach(() => {
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAI;
    if (originalOllama === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllama;
    vi.unstubAllGlobals();
  });

  it("defaults to Ollama without silently selecting cloud AI", () => {
    expect(getDefaultProvider()).toBe("ollama");
  });

  it("gives secure runtime settings precedence over environment values", () => {
    process.env.ANTHROPIC_API_KEY = "env-secret";
    process.env.OLLAMA_BASE_URL = "http://env-ollama:11434";
    replaceRuntimeAiSettings({
      defaultProvider: "claude",
      anthropicApiKey: "secure-secret",
      ollamaBaseUrl: "http://saved-ollama:11434",
    });
    expect(getDefaultProvider()).toBe("claude");
    expect(getProviderApiKey("claude")).toBe("secure-secret");
    expect(getOllamaBaseUrl()).toBe("http://saved-ollama:11434");
  });

  it("never exposes credentials in the public settings response", async () => {
    replaceRuntimeAiSettings({
      anthropicApiKey: "anthropic-private-value",
      openaiApiKey: "openai-private-value",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await getPublicSettings();
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("anthropic-private-value");
    expect(serialized).not.toContain("openai-private-value");
    expect(serialized).not.toContain("apiKey");
  });
});
