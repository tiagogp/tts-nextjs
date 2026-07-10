import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCoverage,
  collectNativeRecordings,
  firstRunLessonIds,
  installNativeRecordings,
  isRiffWave,
  lessonAudioItems,
  nativeInstallState,
  readNativeManifest,
  synthesisTargets,
  validateNativeLibrary,
} from "./generate-learn-audio.mjs";

const tempDirs = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "learn-audio-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  // temp dirs are small; leave cleanup to the OS to keep the tests simple
  tempDirs.length = 0;
});

function lessonFixture() {
  return [
    {
      id: "a1-greetings",
      level: "A1",
      phrases: [
        { en: "Hello.", clip: "/learn/audio/a1-greetings/01.wav" },
        { en: "Good morning.", clip: "/learn/audio/a1-greetings/02.wav" },
      ],
    },
    {
      id: "a1-second",
      level: "A1",
      phrases: [{ en: "Bye.", clip: "/learn/audio/a1-second/01.wav" }],
    },
    {
      id: "a2-food",
      level: "A2",
      phrases: [{ en: "I like rice.", clip: "/learn/audio/a2-food/01.wav" }],
    },
    {
      id: "b1-opinions",
      level: "B1",
      phrases: [{ en: "I think so.", clip: "/learn/audio/b1-opinions/01.wav" }],
    },
    {
      id: "b1-everyday-demo",
      level: "B1",
      phrases: [{ en: "Let's check in.", clip: "/demo/audio/01.wav" }],
    },
    {
      id: "b2-arguments",
      level: "B2",
      phrases: [{ en: "On the other hand.", clip: "/learn/audio/b2-arguments/01.wav" }],
    },
  ];
}

describe("lessonAudioItems", () => {
  it("collects valid clips with targets under public/", () => {
    const publicDir = path.join(os.tmpdir(), "pl-public");
    const items = lessonAudioItems(lessonFixture(), publicDir);
    expect(items).toHaveLength(7);
    expect(items[0]).toMatchObject({
      clip: "/learn/audio/a1-greetings/01.wav",
      lessonIds: ["a1-greetings"],
    });
    expect(items[0].target).toBe(path.join(publicDir, "learn", "audio", "a1-greetings", "01.wav"));
  });

  it("skips invalid phrases and dedups clips shared across lessons", () => {
    const publicDir = path.join(os.tmpdir(), "pl-public");
    const lessons = [
      {
        id: "one",
        level: "A1",
        phrases: [
          { en: "Shared.", clip: "/learn/audio/shared/01.wav" },
          { en: "   ", clip: "/learn/audio/blank/01.wav" },
          { en: "No slash.", clip: "learn/audio/x/01.wav" },
          { en: "Not wav.", clip: "/learn/audio/x/01.mp3" },
        ],
      },
      { id: "two", level: "A1", phrases: [{ en: "Shared again.", clip: "/learn/audio/shared/01.wav" }] },
    ];
    const items = lessonAudioItems(lessons, publicDir);
    expect(items).toHaveLength(1);
    expect(items[0].lessonIds).toEqual(["one", "two"]);
  });

  it("rejects clip paths escaping public/", () => {
    const publicDir = path.join(os.tmpdir(), "pl-public");
    const lessons = [{ id: "evil", level: "A1", phrases: [{ en: "Nope.", clip: "/../outside.wav" }] }];
    expect(() => lessonAudioItems(lessons, publicDir)).toThrow(/Invalid lesson audio path/);
  });
});

describe("firstRunLessonIds", () => {
  it("takes the first A1/A2/B1 lesson plus any demo-clip lesson, nothing else", () => {
    const ids = firstRunLessonIds(lessonFixture());
    expect([...ids].sort()).toEqual(["a1-greetings", "a2-food", "b1-everyday-demo", "b1-opinions"]);
  });
});

describe("native library validation", () => {
  it("flags unmanifested recordings, orphan entries, and missing provenance", () => {
    const recordings = new Map([
      ["/learn/audio/a1-greetings/01.wav", "/tmp/x/01.wav"],
      ["/learn/audio/not-declared/01.wav", "/tmp/x/nd.wav"],
    ]);
    const declaredClips = new Set(["/learn/audio/a1-greetings/01.wav", "/learn/audio/a2-food/01.wav"]);
    const errors = validateNativeLibrary({
      recordings,
      strayFiles: ["learn/audio/a1-greetings/01.mp3"],
      manifestEntries: [
        { clip: "/learn/audio/a2-food/01.wav", speaker: "", license: "own recording" },
        { clip: "not-a-path" },
        { clip: "/learn/audio/a2-food/01.wav", speaker: "dup", license: "dup" },
      ],
      declaredClips,
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("01.mp3 is not a .wav file"),
        expect.stringContaining('missing "speaker"'),
        expect.stringContaining("has no recording at native-audio/learn/audio/a2-food/01.wav"),
        expect.stringContaining('needs a "clip"'),
        expect.stringContaining("more than once"),
        expect.stringContaining("native-audio/learn/audio/not-declared/01.wav does not match any clip"),
        expect.stringContaining("native-audio/learn/audio/a1-greetings/01.wav has no manifest entry"),
      ]),
    );
  });

  it("accepts a complete, well-formed library", () => {
    const recordings = new Map([["/learn/audio/a1-greetings/01.wav", "/tmp/x/01.wav"]]);
    const errors = validateNativeLibrary({
      recordings,
      strayFiles: [],
      manifestEntries: [
        { clip: "/learn/audio/a1-greetings/01.wav", speaker: "Jane (US native)", license: "own recording" },
      ],
      declaredClips: new Set(["/learn/audio/a1-greetings/01.wav"]),
    });
    expect(errors).toEqual([]);
  });
});

describe("collectNativeRecordings / readNativeManifest", () => {
  it("walks the library, ignores metadata files, and reports non-wav strays", async () => {
    const dir = await tempDir();
    await mkdir(path.join(dir, "learn", "audio", "a2-food"), { recursive: true });
    await writeFile(path.join(dir, "learn", "audio", "a2-food", "01.wav"), "x");
    await writeFile(path.join(dir, "learn", "audio", "a2-food", "01.m4a"), "x");
    await writeFile(path.join(dir, "manifest.json"), "[]");
    await writeFile(path.join(dir, "README.md"), "readme");
    await writeFile(path.join(dir, ".DS_Store"), "");

    const { recordings, strayFiles } = await collectNativeRecordings(dir);
    expect([...recordings.keys()]).toEqual(["/learn/audio/a2-food/01.wav"]);
    expect(strayFiles).toEqual(["learn/audio/a2-food/01.m4a"]);
  });

  it("returns empty for a missing library and reports malformed manifests", async () => {
    const missing = path.join(os.tmpdir(), "learn-audio-none", String(Date.now()));
    expect((await collectNativeRecordings(missing)).recordings.size).toBe(0);
    expect((await readNativeManifest(missing)).entries).toEqual([]);

    const dir = await tempDir();
    await writeFile(path.join(dir, "manifest.json"), "{ nope");
    expect((await readNativeManifest(dir)).errors[0]).toMatch(/not valid JSON/);

    await writeFile(path.join(dir, "manifest.json"), '{"clips": []}');
    expect((await readNativeManifest(dir)).errors[0]).toMatch(/must be a JSON array/);
  });
});

describe("isRiffWave", () => {
  it("accepts RIFF/WAVE headers and rejects anything else", async () => {
    const dir = await tempDir();
    const good = path.join(dir, "good.wav");
    const header = Buffer.alloc(16);
    header.write("RIFF", 0);
    header.write("WAVE", 8);
    await writeFile(good, header);
    const bad = path.join(dir, "bad.wav");
    await writeFile(bad, "ID3 this is actually an mp3");

    expect(await isRiffWave(good)).toBe(true);
    expect(await isRiffWave(bad)).toBe(false);
  });
});

describe("synthesisTargets", () => {
  const items = [
    { clip: "/a.wav", text: "a" },
    { clip: "/b.wav", text: "b" },
    { clip: "/c.wav", text: "c" },
  ];

  it("never synthesizes native clips, even when regenerating", () => {
    const native = new Set(["/a.wav"]);
    const present = new Set(["/a.wav", "/b.wav"]);
    expect(synthesisTargets(items, native, present, false).map((i) => i.clip)).toEqual(["/c.wav"]);
    expect(synthesisTargets(items, native, present, true).map((i) => i.clip)).toEqual(["/b.wav", "/c.wav"]);
  });
});

describe("buildCoverage", () => {
  it("scores per-lesson coverage and fails the gate on synthetic first-run clips", () => {
    const lessons = lessonFixture();
    const installed = new Set([
      "/learn/audio/a1-greetings/01.wav",
      "/learn/audio/a2-food/01.wav",
      "/learn/audio/b1-opinions/01.wav",
      "/demo/audio/01.wav",
    ]);
    const present = new Set([...installed, "/learn/audio/a1-greetings/02.wav"]);
    const coverage = buildCoverage(lessons, installed, present);

    const greetings = coverage.rows.find((row) => row.lessonId === "a1-greetings");
    expect(greetings).toMatchObject({ total: 2, native: 1, synthetic: 1, missing: 0, inGate: true });
    expect(coverage.gate.complete).toBe(false);
    expect(coverage.gate.gaps).toEqual(["/learn/audio/a1-greetings/02.wav"]);
  });

  it("passes the gate once every first-run clip is native", () => {
    const lessons = lessonFixture();
    const installed = new Set([
      "/learn/audio/a1-greetings/01.wav",
      "/learn/audio/a1-greetings/02.wav",
      "/learn/audio/a2-food/01.wav",
      "/learn/audio/b1-opinions/01.wav",
      "/demo/audio/01.wav",
    ]);
    const coverage = buildCoverage(lessons, installed, installed);
    expect(coverage.gate.complete).toBe(true);
    const b2 = coverage.rows.find((row) => row.lessonId === "b2-arguments");
    expect(b2).toMatchObject({ native: 0, missing: 1, inGate: false });
  });
});

describe("installNativeRecordings", () => {
  it("copies new and stale recordings, keeps identical ones", async () => {
    const dir = await tempDir();
    const source = path.join(dir, "native", "01.wav");
    const target = path.join(dir, "public", "learn", "audio", "a2-food", "01.wav");
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(source, "native take 1");

    const recordings = new Map([["/learn/audio/a2-food/01.wav", source]]);
    const itemsByClip = new Map([["/learn/audio/a2-food/01.wav", { clip: "/learn/audio/a2-food/01.wav", target }]]);

    const first = await installNativeRecordings(recordings, itemsByClip);
    expect(first.copied).toEqual(["/learn/audio/a2-food/01.wav"]);
    expect(await readFile(target, "utf8")).toBe("native take 1");

    const second = await installNativeRecordings(recordings, itemsByClip);
    expect(second.copied).toEqual([]);

    await writeFile(target, "kokoro overwrote me");
    const state = await nativeInstallState(recordings, itemsByClip);
    expect(state.pending).toEqual([{ clip: "/learn/audio/a2-food/01.wav", reason: "stale" }]);

    const third = await installNativeRecordings(recordings, itemsByClip);
    expect(third.copied).toEqual(["/learn/audio/a2-food/01.wav"]);
    expect(await readFile(target, "utf8")).toBe("native take 1");
  });
});
