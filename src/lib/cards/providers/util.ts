/**
 * Helpers shared by every SDK-backed provider (Claude, OpenAI, Ollama, OpenRouter).
 * Kept here so the per-provider files hold only what actually differs between backends.
 */

import type { GenerationRunOptions } from "../provider";

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
