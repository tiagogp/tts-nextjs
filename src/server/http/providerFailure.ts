import "server-only";

import { NextResponse } from "next/server";

/**
 * Typed taxonomy for LLM-provider and HTTP failures (product.md tracker: "Erros de API").
 *
 * Every route that talks to a provider funnels its catch block through
 * classifyProviderFailure(), so the user always sees recoverable PT-BR copy with a
 * stable machine code — never a raw SDK/network error. The copy follows the Discover
 * fallback rules: say what happened in learner language, give a way forward, no jargon.
 *
 * All providers speak through the OpenAI/Anthropic SDK shapes, so classification keys
 * on: abort/timeout error names, the numeric `status` an APIError carries, and the
 * connection-failure codes undici puts on `error.cause`.
 */

export type ProviderFailureCode =
  | "invalid_input" // 400 — the request itself is malformed or has nothing to work on
  | "provider_not_configured" // 400 — no provider connected for this action
  | "empty_result" // 422 — the provider ran but the quality gate kept nothing
  | "provider_rate_limited" // 429 — upstream rate limit
  | "aborted" // 499 — the user canceled; nothing was lost
  | "provider_auth" // 502 — upstream rejected the saved key
  | "provider_unavailable" // 502 — upstream down or unreachable
  | "provider_failed" // 502 — upstream misbehaved (malformed/empty output)
  | "provider_timeout"; // 504 — upstream too slow

export interface ProviderFailure {
  status: number;
  code: ProviderFailureCode;
  /** User-visible PT-BR copy — safe to render as-is. */
  error: string;
}

const FAILURE_STATUS: Record<ProviderFailureCode, number> = {
  invalid_input: 400,
  provider_not_configured: 400,
  empty_result: 422,
  provider_rate_limited: 429,
  aborted: 499,
  provider_auth: 502,
  provider_unavailable: 502,
  provider_failed: 502,
  provider_timeout: 504,
};

const FAILURE_COPY: Record<ProviderFailureCode, string> = {
  invalid_input:
    "Não consegui entender esse pedido. Recarregue a página e tente de novo.",
  provider_not_configured:
    "Nenhuma IA está conectada para esta ação. Abra Configurações e conecte uma, ou continue pela lição inicial e Estudar.",
  empty_result:
    "A IA não aproveitou nenhuma frase desta vez. Tente frases mais completas ou tente de novo.",
  provider_rate_limited:
    "A IA está recebendo muitos pedidos agora. Espere alguns segundos e tente de novo.",
  aborted: "Operação cancelada. Nada foi salvo — tente de novo quando quiser.",
  provider_auth:
    "A IA recusou a conexão — a chave salva parece inválida ou expirada. Confira a chave em Configurações e tente de novo.",
  provider_unavailable:
    "A IA está fora do ar neste momento. Tente de novo em instantes — sua lição e suas revisões continuam funcionando.",
  provider_failed:
    "A IA respondeu de um jeito inesperado. Tente de novo em instantes.",
  provider_timeout:
    "A IA demorou demais para responder. Tente de novo com menos frases ou troque a IA em Configurações.",
};

/** Build a typed failure, optionally with route-specific PT-BR copy. */
export function providerFailure(
  code: ProviderFailureCode,
  message?: string,
): ProviderFailure {
  return {
    status: FAILURE_STATUS[code],
    code,
    error: message ?? FAILURE_COPY[code],
  };
}

/** Render a typed failure as the JSON response every provider route returns. */
export function failureResponse(
  failure: ProviderFailure,
  extra: Record<string, unknown> = {},
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: failure.error, code: failure.code, ...extra },
    { status: failure.status, ...(headers ? { headers } : {}) },
  );
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "";
}

/** The numeric HTTP status an OpenAI/Anthropic SDK APIError carries, if any. */
function upstreamStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number" && Number.isFinite(status)) return status;
  }
  return null;
}

/** Connection-failure code undici attaches to `fetch failed` errors. */
function causeCode(err: unknown): string {
  if (err instanceof Error && err.cause && typeof err.cause === "object" && "code" in err.cause) {
    const code = (err.cause as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

const TIMEOUT_NAMES = new Set(["TimeoutError", "APIConnectionTimeoutError"]);
const ABORT_NAMES = new Set(["AbortError", "APIUserAbortError"]);
const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

/**
 * Map an unknown provider-call error to a typed failure.
 *
 * Pass the request's combined AbortSignal when there is one: SDKs throw the same
 * abort error for a user cancel and for our own timeout, so the signal's abort
 * reason is the only way to tell 499 (canceled) from 504 (too slow).
 */
export function classifyProviderFailure(
  err: unknown,
  options: { signal?: AbortSignal } = {},
): ProviderFailure {
  const name = errorName(err);
  const message = errorMessage(err);
  const abortish = ABORT_NAMES.has(name) || /request was aborted/i.test(message);
  const timeoutish = TIMEOUT_NAMES.has(name) || /timed?\s?out|ETIMEDOUT/i.test(message);

  const signal = options.signal;
  if (signal?.aborted) {
    const reason = signal.reason;
    return providerFailure(
      reason instanceof Error && TIMEOUT_NAMES.has(reason.name)
        ? "provider_timeout"
        : "aborted",
    );
  }
  if (timeoutish) return providerFailure("provider_timeout");
  if (abortish) {
    // An abort the client didn't ask for is our own deadline firing — report it as a
    // timeout, not a cancel.
    return providerFailure(signal ? "provider_timeout" : "aborted");
  }

  const status = upstreamStatus(err);
  if (status != null) {
    if (status === 401 || status === 402 || status === 403) return providerFailure("provider_auth");
    if (status === 408) return providerFailure("provider_timeout");
    if (status === 429) return providerFailure("provider_rate_limited");
    if (status >= 500) return providerFailure("provider_unavailable");
    return providerFailure("provider_failed");
  }

  if (
    name === "APIConnectionError" ||
    CONNECTION_CODES.has(causeCode(err)) ||
    /fetch failed|connection error|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(message)
  ) {
    return providerFailure("provider_unavailable");
  }

  return providerFailure("provider_failed");
}
