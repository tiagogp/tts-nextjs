import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind } from "@/server/http/validation";
import type { ProviderKind } from "@/lib/cards/provider";
import type { ExportErrorPayload } from "./types";
import {
  DEFAULT_THEME_PHRASE_COUNT,
  MAX_THEME_PHRASES,
} from "./constants";

export function cardProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
}

export function providerErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.trim();
  if (!message) return null;
  if (
    message.includes("Ollama") ||
    message.includes("OpenAI") ||
    message.includes("Claude") ||
    message.includes("Anthropic") ||
    message.includes("API key") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connect") ||
    message.includes("ECONNREFUSED")
  ) {
    return message;
  }
  return null;
}

export function readExportError(body: Buffer): ExportErrorPayload {
  try {
    const parsed = JSON.parse(body.toString("utf8") || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ExportErrorPayload)
      : {};
  } catch {
    return {};
  }
}

function timeoutError(): Error {
  const error = new Error("Card generation timed out");
  error.name = "TimeoutError";
  return error;
}

export function combinedSignal(signal: AbortSignal, timeoutMs: number): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(signal.reason);
  const timer = setTimeout(() => controller.abort(timeoutError()), timeoutMs);
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener("abort", abortFromRequest, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abortFromRequest);
    },
  };
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

export function parseThemePhraseCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(MAX_THEME_PHRASES, Math.max(3, Math.round(n)))
    : DEFAULT_THEME_PHRASE_COUNT;
}

export function fallbackThemePhrases(theme: string, count: number): string[] {
  const clean = theme.trim() || "everyday conversation";
  const generic = [
    `Could you help me with ${clean}?`,
    `I'm trying to figure out ${clean}.`,
    `What would you recommend for ${clean}?`,
    `I need a little more time to decide.`,
    `Could you say that another way?`,
    `That works for me, thank you.`,
    `I'm not sure I understood the last part.`,
    `Can we go over the details again?`,
    `I'd like to make sure I got this right.`,
    `Is there anything else I should know?`,
    `That sounds good, but I have one question.`,
    `Could we start with the most important point?`,
  ];
  return generic.slice(0, count);
}

export function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 180);
}

export function uniquePhrases(values: string[], count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= count) break;
  }
  return out;
}
