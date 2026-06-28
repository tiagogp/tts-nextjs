import { describe, expect, it } from "vitest";
import { httpUrl, isHttpError, isProviderKind, optionalString, readJsonObject, safeString } from "./validation";

describe("route validation helpers", () => {
  it("accepts only known provider kinds", () => {
    expect(isProviderKind("ollama")).toBe(true);
    expect(isProviderKind("gpt-4")).toBe(false);
  });

  it("normalizes bounded strings", () => {
    expect(optionalString("  hello  ", 3)).toBe("hel");
    expect(optionalString("   ", 3)).toBeUndefined();
    expect(safeString(null, "fallback", 10)).toBe("fallback");
  });

  it("accepts http(s) URLs only", () => {
    expect(httpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(httpUrl("ftp://example.com/a")).toBeNull();
    expect(httpUrl("not a url")).toBeNull();
  });

  it("reports malformed and oversized JSON as HTTP errors", async () => {
    await expect(readJsonObject(new Request("http://test", { body: "{", method: "POST" }))).rejects.toMatchObject({
      status: 400,
    });

    try {
      await readJsonObject(new Request("http://test", { body: "{\"ok\":true}", method: "POST" }), { maxBytes: 2 });
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      expect(error).toMatchObject({ status: 413 });
    }
  });
});
