import { describe, expect, it } from "vitest";
import { classifyProviderFailure, providerFailure } from "./providerFailure";

function namedError(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** Minimal stand-in for an OpenAI/Anthropic SDK APIError. */
function apiError(status: number): Error {
  const error = new Error(`HTTP ${status}`);
  (error as Error & { status: number }).status = status;
  return error;
}

describe("providerFailure", () => {
  it("maps every code to a status and PT-BR copy", () => {
    expect(providerFailure("invalid_input")).toMatchObject({ status: 400 });
    expect(providerFailure("provider_not_configured")).toMatchObject({ status: 400 });
    expect(providerFailure("empty_result")).toMatchObject({ status: 422 });
    expect(providerFailure("provider_rate_limited")).toMatchObject({ status: 429 });
    expect(providerFailure("aborted")).toMatchObject({ status: 499 });
    expect(providerFailure("provider_auth")).toMatchObject({ status: 502 });
    expect(providerFailure("provider_unavailable")).toMatchObject({ status: 502 });
    expect(providerFailure("provider_failed")).toMatchObject({ status: 502 });
    expect(providerFailure("provider_timeout")).toMatchObject({ status: 504 });
  });

  it("allows route-specific copy while keeping the typed code", () => {
    const failure = providerFailure("invalid_input", "Digite um tema primeiro.");
    expect(failure).toEqual({ status: 400, code: "invalid_input", error: "Digite um tema primeiro." });
  });
});

describe("classifyProviderFailure", () => {
  it("classifies timeouts as 504 provider_timeout", () => {
    for (const err of [
      namedError("TimeoutError"),
      namedError("APIConnectionTimeoutError"),
      new Error("Request timed out."),
      new Error("connect ETIMEDOUT 1.2.3.4:443"),
    ]) {
      expect(classifyProviderFailure(err)).toMatchObject({ status: 504, code: "provider_timeout" });
    }
  });

  it("classifies plain aborts as 499 aborted", () => {
    expect(classifyProviderFailure(namedError("AbortError"))).toMatchObject({
      status: 499,
      code: "aborted",
    });
    expect(classifyProviderFailure(namedError("APIUserAbortError", "Request was aborted."))).toMatchObject({
      code: "aborted",
    });
  });

  it("uses the signal's abort reason to tell a cancel from a deadline", () => {
    const canceled = new AbortController();
    canceled.abort();
    expect(
      classifyProviderFailure(namedError("AbortError"), { signal: canceled.signal }),
    ).toMatchObject({ code: "aborted" });

    const timedOut = new AbortController();
    timedOut.abort(namedError("TimeoutError"));
    expect(
      classifyProviderFailure(namedError("AbortError"), { signal: timedOut.signal }),
    ).toMatchObject({ status: 504, code: "provider_timeout" });
  });

  it("treats an abort the client did not request as a timeout", () => {
    const live = new AbortController();
    expect(
      classifyProviderFailure(namedError("AbortError"), { signal: live.signal }),
    ).toMatchObject({ status: 504, code: "provider_timeout" });
  });

  it("classifies upstream statuses", () => {
    expect(classifyProviderFailure(apiError(401))).toMatchObject({ status: 502, code: "provider_auth" });
    expect(classifyProviderFailure(apiError(402))).toMatchObject({ code: "provider_auth" });
    expect(classifyProviderFailure(apiError(408))).toMatchObject({ code: "provider_timeout" });
    expect(classifyProviderFailure(apiError(429))).toMatchObject({ status: 429, code: "provider_rate_limited" });
    expect(classifyProviderFailure(apiError(500))).toMatchObject({ status: 502, code: "provider_unavailable" });
    expect(classifyProviderFailure(apiError(503))).toMatchObject({ code: "provider_unavailable" });
    expect(classifyProviderFailure(apiError(400))).toMatchObject({ status: 502, code: "provider_failed" });
  });

  it("classifies connection failures as 502 provider_unavailable", () => {
    const fetchFailed = new Error("fetch failed");
    (fetchFailed as Error & { cause: { code: string } }).cause = { code: "ECONNREFUSED" };
    expect(classifyProviderFailure(fetchFailed)).toMatchObject({
      status: 502,
      code: "provider_unavailable",
    });
    expect(classifyProviderFailure(namedError("APIConnectionError", "Connection error."))).toMatchObject({
      code: "provider_unavailable",
    });
  });

  it("falls back to provider_failed and never leaks the raw message", () => {
    const raw = new Error("SyntaxError: Unexpected token < in JSON at position 0");
    const failure = classifyProviderFailure(raw);
    expect(failure).toMatchObject({ status: 502, code: "provider_failed" });
    expect(failure.error).not.toContain("SyntaxError");
  });

  it("always returns PT-BR copy, never the raw error", () => {
    for (const err of [
      namedError("TimeoutError"),
      apiError(401),
      apiError(500),
      new Error("boom"),
      "not-an-error",
      null,
    ]) {
      const failure = classifyProviderFailure(err);
      expect(failure.error.length).toBeGreaterThan(10);
      expect(failure.error).not.toMatch(/error|exception|undefined/i);
    }
  });
});
