import "server-only";

import { getOllamaBaseUrl } from "@/server/aiSettings";

export interface OllamaStatus {
  online: boolean;
  models: string[];
}

export function ollamaRoot(explicit?: string): string {
  return (explicit || getOllamaBaseUrl()).replace(/\/+$/, "").replace(/\/v1$/, "");
}

export async function getOllamaStatus(options: {
  baseUrl?: string;
  timeoutMs?: number;
} = {}): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${ollamaRoot(options.baseUrl)}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 1800),
    });
    if (!response.ok) return { online: false, models: [] };
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? [])
      .map((item) => item.name?.trim() ?? "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return { online: true, models };
  } catch {
    return { online: false, models: [] };
  }
}

export async function isOllamaReachable(timeoutMs = 1500): Promise<boolean> {
  return (await getOllamaStatus({ timeoutMs })).online;
}
