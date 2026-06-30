import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import type initSqlJsType from "sql.js";
import { wav } from "./audio";
import { buildCardsDeck, buildCsvDeck } from "./apkg";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js/dist/sql-asm.js") as typeof initSqlJsType;

async function noteTypesFromApkg(packageBytes: Buffer): Promise<Array<{
  name: string;
  fields: string[];
}>> {
  const zip = await JSZip.loadAsync(packageBytes);
  const collection = zip.file("collection.anki2") ?? zip.file("collection.anki21");
  if (!collection) throw new Error("collection database not found");
  const SQL = await initSqlJs();
  const db = new SQL.Database(await collection.async("uint8array"));
  try {
    const result = db.exec("select id, name from notetypes order by name")[0];
    return (result?.values ?? []).map(([id, name]) => {
      const fields = db.exec("select name from fields where ntid = ? order by ord", [id])[0];
      return {
        name: String(name),
        fields: (fields?.values ?? []).map(([field]) => String(field)),
      };
    });
  } finally {
    db.close();
  }
}

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

    const zip = await JSZip.loadAsync(packageBytes);
    expect(zip.file("collection.anki2")).toBeTruthy();
    const media = JSON.parse((await zip.file("media")?.async("string")) ?? "{}") as Record<string, string>;
    expect(Object.values(media)).toHaveLength(1);
    expect(Object.values(media)[0]).toMatch(/^anki_tts_en_[a-f0-9]{12}\.wav$/);
    expect(zip.file("0")).toBeTruthy();

    const noteTypes = await noteTypesFromApkg(packageBytes);
    const noteType = noteTypes.find((m) => m.name === "Basic (TTS Import - English Front)");
    expect(noteType?.fields).toEqual(["Front", "Back"]);
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

    const zip = await JSZip.loadAsync(packageBytes);
    const media = JSON.parse((await zip.file("media")?.async("string")) ?? "{}") as Record<string, string>;
    expect(Object.values(media)).toEqual([
      "clip_source-1_0_500.wav",
      "clip_source-1_500_1000.wav",
    ]);

    const noteTypes = await noteTypesFromApkg(packageBytes);
    const noteType = noteTypes.find((m) => m.name === "PhraseLoop Cards (English Front)");
    expect(noteType?.fields.slice(0, 2)).toEqual(["Front", "Back"]);
  });

  it("fails instead of exporting an empty deck", async () => {
    const synthesizer = vi.fn(async () => wav(new Float32Array(240), 24_000));

    await expect(
      buildCsvDeck({
        csv: Buffer.from("pt,en\n,\n"),
        deck: "Fixture",
        ptCol: "pt",
        enCol: "en",
        delimiter: ",",
        noHeader: false,
        voice: "af_heart",
        speed: 1.15,
        synthesizer,
      }),
    ).rejects.toThrow("No usable notes");
    expect(synthesizer).not.toHaveBeenCalled();
  });
});
