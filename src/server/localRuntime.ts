import "server-only";

import { writeApkgDebug } from "./native/apkgDebug";
import {
  dispatch,
  type LocalRequestOptions,
  type LocalResponse,
} from "./routes";
import { LOCAL_REQUEST_TIMEOUT_MS } from "@/lib/constants";

export type { LocalRequestOptions, LocalResponse } from "./routes";

function localLog(debugId: string | undefined, step: string, details: Record<string, unknown> = {}): void {
  writeApkgDebug(debugId, `local-${step}`, details);
}

export async function localRequest(
  requestPath: string,
  options: LocalRequestOptions = {},
): Promise<LocalResponse> {
  const timeoutMs = options.timeoutMs ?? LOCAL_REQUEST_TIMEOUT_MS;
  return new Promise<LocalResponse>((resolve, reject) => {
    if (options.signal?.aborted) {
      const error = new Error("PhraseLoop local request aborted");
      error.name = "AbortError";
      reject(error);
      return;
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const requestOptions = { ...options, signal: controller.signal };
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const abort = () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) controller.abort(options.signal?.reason);
      const error = new Error("PhraseLoop local request aborted");
      error.name = "AbortError";
      localLog(options.debugId, "request-aborted", {
        path: requestPath,
        method: options.method ?? "GET",
        durationMs: Date.now() - startedAt,
      });
      settle(() => reject(error));
    };
    const timer = setTimeout(() => {
      options.signal?.removeEventListener("abort", abort);
      const error = new Error("PhraseLoop local request timed out");
      error.name = "TimeoutError";
      if (!controller.signal.aborted) controller.abort(error);
      localLog(options.debugId, "request-timed-out", {
        path: requestPath,
        method: options.method ?? "GET",
        timeoutMs,
        durationMs: Date.now() - startedAt,
      });
      settle(() => reject(error));
    }, timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    localLog(options.debugId, "request-started", {
      path: requestPath,
      method: options.method ?? "GET",
      timeoutMs,
    });
    dispatch(requestPath, requestOptions).then(
      (value) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        if (settled) return;
        localLog(options.debugId, "request-finished", {
          path: requestPath,
          method: options.method ?? "GET",
          status: value.status,
          bytes: value.body.byteLength,
          durationMs: Date.now() - startedAt,
        });
        settle(() => resolve(value));
      },
      (error) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        if (settled) return;
        localLog(options.debugId, "request-failed", {
          path: requestPath,
          method: options.method ?? "GET",
          error: error instanceof Error ? error.message : "unknown",
          durationMs: Date.now() - startedAt,
        });
        settle(() => reject(error));
      },
    );
  });
}

export function localJson(
  requestPath: string,
  value: unknown,
  timeoutOrOptions?: number | { timeoutMs?: number; signal?: AbortSignal },
): Promise<LocalResponse> {
  const requestOptions =
    typeof timeoutOrOptions === "number"
      ? { timeoutMs: timeoutOrOptions }
      : (timeoutOrOptions ?? {});
  return localRequest(requestPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    debugId: value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).debugId === "string"
      ? String((value as Record<string, unknown>).debugId)
      : undefined,
    ...requestOptions,
  });
}
