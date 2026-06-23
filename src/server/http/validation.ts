import "server-only";

import { isPlainObject, type JsonObject } from "@/lib/isObject";
import type { ProviderKind } from "@/lib/cards/provider";

export async function readJsonObject(request: Request): Promise<JsonObject | null> {
  const value = (await request.json().catch(() => null)) as unknown;
  return isPlainObject(value) ? value : null;
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return value === "local" || value === "ollama" || value === "claude" || value === "openai";
}

export function optionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function safeString(value: unknown, fallback: string, maxLength: number): string {
  return optionalString(value, maxLength) ?? fallback;
}

export function httpUrl(value: unknown, maxLength = 2048): string | null {
  const normalized = optionalString(value, maxLength);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? normalized : null;
  } catch {
    return null;
  }
}
