/**
 * Helpers shared by every SDK-backed provider (Claude, OpenAI, Ollama, OpenRouter).
 * Kept here so the per-provider files hold only what actually differs between backends.
 */

import { logger } from "@/lib/logger";
import type { GenerationRunOptions, ProviderKind } from "../provider";

/**
 * Pull the first JSON object out of a model response. Less reliable backends (local Ollama
 * models, the free routes OpenRouter defaults to) often wrap JSON in markdown fences or add
 * a sentence of preamble, so we strip fences and, failing a clean parse, fall back to the
 * outermost {...} span before giving up.
 */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    JSON.parse(body);
    return body;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start !== -1 && end > start) return body.slice(start, end + 1);
    return body;
  }
}

/** Covers both the Anthropic (`input_tokens`/`output_tokens`) and OpenAI-compatible
 * (`prompt_tokens`/`completion_tokens`) usage shapes so one call site works for all four SDKs. */
interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** Log per-call token usage so cost is visible without a second telemetry system. */
export function logUsage(provider: ProviderKind, method: string, usage: UsageLike | null | undefined): void {
  if (!usage) return;
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens;
  if (inputTokens == null && outputTokens == null) return;
  logger.info({ provider, method, inputTokens, outputTokens }, "llm_token_usage");
}

export function requestOptions(options: GenerationRunOptions):
  | {
      signal?: AbortSignal;
      timeout?: number;
      maxRetries: 0;
    }
  | undefined {
  if (!options.signal && options.timeoutMs == null) return undefined;
  return {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs != null ? { timeout: options.timeoutMs } : {}),
    maxRetries: 0,
  };
}
