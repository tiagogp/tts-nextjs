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

export function parseThemePhraseCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(MAX_THEME_PHRASES, Math.max(3, Math.round(n)))
    : DEFAULT_THEME_PHRASE_COUNT;
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
