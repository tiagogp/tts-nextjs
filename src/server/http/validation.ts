import "server-only";

import { isPlainObject, type JsonObject } from "@/lib/isObject";
import type { ProviderKind } from "@/lib/cards/provider";

export async function readJsonObject(request: Request, options: { maxBytes?: number } = {}): Promise<JsonObject | null> {
  const maxBytes = options.maxBytes;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (maxBytes != null && contentLength > maxBytes) {
    throw new Error(`JSON body exceeds ${maxBytes} bytes.`);
  }
  const text = await request.text().catch(() => "");
  if (maxBytes != null && Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error(`JSON body exceeds ${maxBytes} bytes.`);
  }
  const value = text ? (JSON.parse(text) as unknown) : null;
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
