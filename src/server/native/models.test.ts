import { describe, expect, it } from "vitest";
import { modelStatus } from "./models";

describe("model manager", () => {
  it("exposes the API status contract before first download", () => {
    expect(modelStatus()).toMatchObject({
      ready: true,
      loading_model: false,
      downloading_model: false,
      loading_kokoro: false,
      loading_whisper: false,
      error: null,
    });
  });
});
