import { describe, expect, it } from "vitest";
import { modelStatus } from "./models";

describe("model manager", () => {
  it("exposes the API status contract with readiness derived from disk", async () => {
    const status = await modelStatus();
    expect(status).toMatchObject({
      loading_model: false,
      downloading_model: false,
      loading_kokoro: false,
      loading_whisper: false,
      error: null,
    });
    // `ready` is no longer hardcoded — it mirrors whether the TTS model is
    // actually installed, so the apkg flow can gate on a truthful signal.
    expect(typeof status.kokoro_installed).toBe("boolean");
    expect(status.ready).toBe(status.kokoro_installed);
  });
});
