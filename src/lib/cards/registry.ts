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
import { isOllamaReachable, OllamaProvider } from "./providers/ollama";
import { LocalProvider } from "./providers/local";

export interface ResolveOptions {
  /** Learner's first language for translation glosses. */
  learnerLang?: string;
  /** Model override (currently honored by Ollama, picked from the UI's model list). */
  model?: string;
}

export const providerRegistry: ProviderRegistry = {
  claude: () => new ClaudeProvider(),
  openai: () => new OpenAIProvider(),
  ollama: () => new OllamaProvider(),
  local: () => new LocalProvider(),
};

/** True when the provider is usable here: a cloud key set, or a local provider. */
export function isProviderAvailable(kind: ProviderKind): boolean {
  if (kind === "local") return true;
  if (kind === "claude") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (kind === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (kind === "ollama") return true;
  return false;
}

/**
 * Best provider available without the user picking one — cloud quality first
 * (Claude → OpenAI), then the local LLM path (Ollama), then the heuristic local fallback.
 * Used by reinforcement generation, which fires from the Study tab where there's no provider selector.
 */
export function bestAvailableProvider(): ProviderKind {
  if (isProviderAvailable("claude")) return "claude";
  if (isProviderAvailable("openai")) return "openai";
  return "local";
}

export async function bestAvailableProviderAsync(): Promise<ProviderKind> {
  if (isProviderAvailable("claude")) return "claude";
  if (isProviderAvailable("openai")) return "openai";
  if (await isOllamaReachable()) return "ollama";
  return "local";
}

export function resolveProvider(
  kind: ProviderKind,
  opts: ResolveOptions = {},
): CardGenerationProvider {
  switch (kind) {
    case "claude":
      return new ClaudeProvider({ learnerLang: opts.learnerLang });
    case "openai":
      return new OpenAIProvider({ learnerLang: opts.learnerLang });
    case "ollama":
      return new OllamaProvider({ learnerLang: opts.learnerLang, model: opts.model });
    case "local":
      return new LocalProvider({ learnerLang: opts.learnerLang });
  }
}
