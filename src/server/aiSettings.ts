import "server-only";

import type { ProviderKind } from "@/lib/cards/provider";
import type { SecureAiSettings } from "@/types/aiSettings";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type RuntimeStore = {
  settings: SecureAiSettings;
};

const globalStore = globalThis as typeof globalThis & {
  __phraseLoopAiSettings?: RuntimeStore;
};

function store(): RuntimeStore {
  globalStore.__phraseLoopAiSettings ??= { settings: {} };
  return globalStore.__phraseLoopAiSettings;
}

export function replaceRuntimeAiSettings(settings: SecureAiSettings): void {
  store().settings = { ...settings };
}

export function getRuntimeAiSettings(): SecureAiSettings {
  return { ...store().settings };
}

export function getDefaultProvider(): ProviderKind {
  return store().settings.defaultProvider ?? "ollama";
}

export function getOllamaBaseUrl(): string {
  return (
    store().settings.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    DEFAULT_OLLAMA_URL
  );
}

export function getOllamaModel(): string | undefined {
  return store().settings.ollamaModel || process.env.OLLAMA_MODEL || undefined;
}

export function getProviderApiKey(kind: "claude" | "openai"): string | undefined {
  if (kind === "claude") {
    return store().settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
  }
  return store().settings.openaiApiKey || process.env.OPENAI_API_KEY || undefined;
}

export function isInternalSettingsRequest(req: Request): boolean {
  const expected = process.env.PHRASELOOP_SETTINGS_TOKEN;
  return Boolean(expected) && req.headers.get("x-phraseloop-settings-token") === expected;
}
