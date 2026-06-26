/**
 * Resolve a provider from the user's runtime choice. Server-side only — reads API
 * keys from the environment, so never import this into client components.
 *
 * `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` are read from the environment
 * (or saved settings) per provider. Ollama is local and defaults to localhost; `OLLAMA_BASE_URL`
 * only overrides that address.
 */

import "server-only";
import type { CardGenerationProvider, ProviderKind, ProviderRegistry } from "./provider";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { OllamaProvider } from "./providers/ollama";
import { OpenRouterProvider } from "./providers/openrouter";
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
  openrouter: () => new OpenRouterProvider({ apiKey: getProviderApiKey("openrouter") }),
};

/** True when the provider is usable here: a cloud key set, or Ollama (always reachable-ish). */
export function isProviderAvailable(kind: ProviderKind): boolean {
  if (kind === "claude") return Boolean(getProviderApiKey("claude"));
  if (kind === "openai") return Boolean(getProviderApiKey("openai"));
  if (kind === "openrouter") return Boolean(getProviderApiKey("openrouter"));
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
    case "openrouter":
      return new OpenRouterProvider({
        learnerLang: opts.learnerLang,
        apiKey: getProviderApiKey("openrouter"),
      });
  }
}
