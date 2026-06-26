import type { ProviderKind } from "@/lib/cards/provider";

export const MAX_GENERATION_CANDIDATES = 200;
export const MAX_GENERATION_ERRORS = 200;

export const PUBLIC_CARD_EXPORT_ERROR =
  "Couldn't export the deck right now. Try again in a moment.";
export const PUBLIC_CARD_GENERATION_ERROR =
  "Couldn't generate cards right now. Try again in a moment.";
export const PUBLIC_CARD_TIMEOUT_ERROR =
  "Generation took too long. Try fewer phrases or another provider.";

/** Cap input so one paste can't blow the model's context or the request timeout. */
export const MAX_CORRECTION_TEXT_CHARS = 8000;
export const PUBLIC_CORRECTION_ERROR =
  "Couldn't evaluate the text right now. Try again in a moment.";

export const MAX_THEME_CHARS = 200;
export const MAX_THEME_PHRASES = 20;
export const DEFAULT_THEME_PHRASE_COUNT = 10;

// Cloud provider constructors throw when their API key is missing, so labels stand in
// until the provider can be safely instantiated.
export const PROVIDER_FALLBACK_LABELS: Record<ProviderKind, string> = {
  openrouter: "OpenRouter",
  ollama: "Ollama (local LLM)",
  claude: "Claude (Anthropic)",
  openai: "OpenAI (GPT)",
};
