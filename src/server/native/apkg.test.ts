import { describe, expect, it, vi } from "vitest";
import { wav } from "./audio";
import { buildCardsDeck, buildCsvDeck } from "./apkg";

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

  it("decodes each source audio once when exporting several clips", async () => {
    const audioPathResolver = vi.fn(async () => "/tmp/source.m4a");
    const audioReader = vi.fn(async () => Buffer.from("source"));
    const audioDecoder = vi.fn(async () => ({
      samples: new Float32Array(72_000),
      sampleRate: 24_000,
    }));
    const synthesizer = vi.fn(async () => wav(new Float32Array(240), 24_000));

    const packageBytes = await buildCardsDeck({
      cards: [
        {
          front: "First",
          back: "first answer",
          source: { kind: "phrase", id: "phrase-1" },
          clip: { sourceId: "source-1", startMs: 0, endMs: 500 },
        },
        {
          front: "Second",
          back: "second answer",
          source: { kind: "phrase", id: "phrase-2" },
          clip: { sourceId: "source-1", startMs: 500, endMs: 1_000 },
        },
      ],
      deck: "Fixture",
      voice: "af_heart",
      speed: 1.15,
      audioPathResolver,
      audioReader,
      audioDecoder,
      synthesizer,
    });

    expect(packageBytes.subarray(0, 2).toString()).toBe("PK");
    expect(audioPathResolver).toHaveBeenCalledOnce();
    expect(audioReader).toHaveBeenCalledOnce();
    expect(audioDecoder).toHaveBeenCalledOnce();
    expect(synthesizer).not.toHaveBeenCalled();
  });
});
