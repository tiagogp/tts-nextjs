/**
 * Resolve a provider from the user's runtime choice. Server-side only — reads API
 * keys from the environment, so never import this into client components.
 *
 * `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are picked up by the SDKs automatically;
 * the local provider needs no key and is always available. Ollama is local too and defaults
 * to localhost; `OLLAMA_BASE_URL` only overrides that address.
 */

import "server-only";
import type { CardGenerationProvider, ProviderKind, ProviderRegistry } from "./provider";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { OllamaProvider } from "./providers/ollama";
import { LocalProvider } from "./providers/local";
import {
  getOllamaBaseUrl,
  getOllamaModel,
  getProviderApiKey,
} from "@/server/aiSettings";

export interface ResolveOptions {
  /** Learner's first language for translation glosses. */
  learnerLang?: string;
  /** Model override (currently honored by Ollama, picked from the UI's model list). */
  model?: string;
  baseUrl?: string;
}

export const providerRegistry: ProviderRegistry = {
  claude: () => new ClaudeProvider({ apiKey: getProviderApiKey("claude") }),
  openai: () => new OpenAIProvider({ apiKey: getProviderApiKey("openai") }),
  ollama: () => new OllamaProvider({ baseUrl: getOllamaBaseUrl(), model: getOllamaModel() }),
  local: () => new LocalProvider(),
};

/** True when the provider is usable here: a cloud key set, or a local provider. */
export function isProviderAvailable(kind: ProviderKind): boolean {
  if (kind === "local") return true;
  if (kind === "claude") return Boolean(getProviderApiKey("claude"));
  if (kind === "openai") return Boolean(getProviderApiKey("openai"));
  if (kind === "ollama") return true;
  return false;
}

export function resolveProvider(
  kind: ProviderKind,
  opts: ResolveOptions = {},
): CardGenerationProvider {
  switch (kind) {
    case "claude":
      return new ClaudeProvider({
        learnerLang: opts.learnerLang,
        apiKey: getProviderApiKey("claude"),
      });
    case "openai":
      return new OpenAIProvider({
        learnerLang: opts.learnerLang,
        apiKey: getProviderApiKey("openai"),
      });
    case "ollama":
      return new OllamaProvider({
        learnerLang: opts.learnerLang,
        model: opts.model ?? getOllamaModel(),
        baseUrl: opts.baseUrl ?? getOllamaBaseUrl(),
      });
    case "local":
      return new LocalProvider({ learnerLang: opts.learnerLang });
  }
}
