import { describe, expect, it, vi } from "vitest";
import { wav } from "./audio";
import { buildCsvDeck } from "./apkg";

describe("Anki package generation", () => {
  it("turns header CSV into an APKG without Python or native SQLite", async () => {
    const synthesizer = vi.fn(async () => wav(new Float32Array(240), 24_000));
    const packageBytes = await buildCsvDeck({
      csv: Buffer.from('pt,en\n"Olá","Hello"\n'),
      deck: "Fixture",
      ptCol: "pt",
      enCol: "en",
      delimiter: ",",
      noHeader: false,
      voice: "af_heart",
      speed: 1.15,
      synthesizer,
    });
    expect(packageBytes.subarray(0, 2).toString()).toBe("PK");
    expect(packageBytes.byteLength).toBeGreaterThan(1_000);
    expect(synthesizer).toHaveBeenCalledOnce();
  });
});
