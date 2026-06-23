import { afterEach, describe, expect, it, vi } from "vitest";
import { getOllamaStatus, ollamaRoot } from "./ollama";

describe("ollama integration helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes native Ollama roots", () => {
    expect(ollamaRoot("http://localhost:11434/v1/")).toBe("http://localhost:11434");
  });

  it("lists and sorts installed model names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ models: [{ name: "zeta" }, { name: "alpha" }, {}] }),
      ),
    );
    await expect(getOllamaStatus({ baseUrl: "http://ollama", timeoutMs: 1 })).resolves.toEqual({
      online: true,
      models: ["alpha", "zeta"],
    });
  });
});
