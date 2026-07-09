import "server-only";

import { isPlainObject, type JsonObject } from "@/lib/isObject";
import type { ProviderKind } from "@/lib/cards/provider";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Stable machine code for the client; the message is user-visible PT-BR. */
    public readonly code: string = "invalid_input",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

const PAYLOAD_TOO_LARGE_MESSAGE =
  "O conteúdo enviado é grande demais para processar. Tente algo menor.";

export async function readJsonObject(request: Request, options: { maxBytes?: number } = {}): Promise<JsonObject | null> {
  const maxBytes = options.maxBytes;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (maxBytes != null && contentLength > maxBytes) {
    throw new HttpError(413, PAYLOAD_TOO_LARGE_MESSAGE, "payload_too_large");
  }
  const text = await request.text().catch(() => "");
  if (maxBytes != null && Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new HttpError(413, PAYLOAD_TOO_LARGE_MESSAGE, "payload_too_large");
  }
  let value: unknown = null;
  try {
    value = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new HttpError(
      400,
      "Não consegui ler esse pedido. Recarregue a página e tente de novo.",
    );
  }
  return isPlainObject(value) ? value : null;
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return value === "openrouter" || value === "ollama" || value === "claude" || value === "openai";
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
