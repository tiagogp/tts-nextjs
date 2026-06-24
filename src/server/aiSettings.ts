import "server-only";

import type { ProviderKind } from "@/lib/cards/provider";
import type { SecureAiSettings } from "@/types/aiSettings";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type RuntimeStore = {
  settings: SecureAiSettings;
  version: number;
};

const globalStore = globalThis as typeof globalThis & {
  __phraseLoopAiSettings?: RuntimeStore;
};

function store(): RuntimeStore {
  globalStore.__phraseLoopAiSettings ??= { settings: {}, version: 0 };
  return globalStore.__phraseLoopAiSettings;
}

export function replaceRuntimeAiSettings(settings: SecureAiSettings): void {
  const s = store();
  s.settings = { ...settings };
  s.version += 1;
}

export function getRuntimeAiSettings(): SecureAiSettings {
  return { ...store().settings };
}

export function getSettingsVersion(): number {
  return store().version;
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

export function isAuthorizedSettingsRequest(req: Request): boolean {
  const expected = process.env.PHRASELOOP_SETTINGS_TOKEN;
  if (!expected) return false;
  if (req.headers.get("x-phraseloop-settings-token") === expected) return true;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)pl-settings-token=([^;]*)/.exec(cookieHeader);
  return !!match && decodeURIComponent(match[1]) === expected;
}
