import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverageReport,
  extractMessageKeys,
  inspectWavBuffer,
  parseRoadmap,
  purposeSimilarity,
  validateLessonModel,
} from "./validate-lesson-content.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");

function roadmapLesson(overrides = {}) {
  return {
    id: "a2-cooking",
    level: "A2",
    title: "Cooking together",
    topic: "Ingredients, quantities, and cooking instructions",
    objective: "Ask for ingredients and explain a simple cooking step",
    phrases: Array.from({ length: 8 }, (_, index) => ({
      id: `a2-cooking-p${index + 1}`,
      en: `Cooking phrase ${index + 1}`,
      pt: `Frase de cozinha ${index + 1}`,
      concept: `pattern ${index + 1}`,
      note: `Usage note ${index + 1}`,
      clip: `/learn/audio/a2-cooking/${String(index + 1).padStart(2, "0")}.wav`,
    })),
    dialogue: [
      { speaker: "Ana", en: "How much flour?", pt: "Quanta farinha?", clip: "/learn/audio/a2-cooking/dialogue-01.wav" },
      { speaker: "Leo", en: "Two cups.", pt: "Duas xícaras.", clip: "/learn/audio/a2-cooking/dialogue-02.wav" },
    ],
    comprehension: [
      { kind: "mainIdea", prompt: "What are they doing?", options: ["Cooking", "Working", "Driving"], answer: "Cooking" },
      { kind: "detail", prompt: "What ingredient?", options: ["Flour", "Rice", "Salt"], answer: "Flour" },
      { kind: "detail", prompt: "How much?", options: ["One cup", "Two cups", "Three cups"], answer: "Two cups" },
    ],
    productionPrompt: "Explain one simple step from a recipe you know.",
    retryHint: "Keep the quantity and action clear in your second attempt.",
    ...overrides,
  };
}

function pcmWav({ sampleRate = 16_000, seconds = 1, amplitude = 4_000 } = {}) {
  const samples = Math.round(sampleRate * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) buffer.writeInt16LE(amplitude, 44 + index * 2);
  return buffer;
}

describe("lesson roadmap parsing", () => {
  it("derives all targets and backlog ids from the roadmap itself", async () => {
    const markdown = await readFile(path.join(rootDir, "docs/100-lesson-roadmap.md"), "utf8");
    const roadmap = parseRoadmap(markdown);

    expect(roadmap.targets).toEqual({ A1: 15, A2: 22, B1: 25, B2: 18, C1: 12, C2: 8 });
    expect(roadmap.entries).toHaveLength(64);
    expect(new Set(roadmap.entries.map((entry) => entry.id)).size).toBe(64);
    expect(roadmap.entries.find((entry) => entry.id === "a2-cooking")).toMatchObject({ wave: 1, level: "A2" });
  });

  it("extracts PT-BR catalog keys used to gate authored lesson copy", () => {
    expect(extractMessageKeys('  "Lesson title": { pt: "Título" },\n  value: "ignored"')).toEqual(
      new Set(["Lesson title"]),
    );
  });
});

describe("lesson content validation", () => {
  const roadmap = {
    targets: { A2: 22 },
    entries: [{ wave: 1, id: "a2-cooking", level: "A2", focus: "Cooking" }],
  };

  it("accepts a complete roadmap lesson", () => {
    expect(validateLessonModel([roadmapLesson()], roadmap).errors).toEqual([]);
  });

  it("rejects missing authored material and ambiguous answer options", () => {
    const lesson = roadmapLesson({
      objective: undefined,
      comprehension: [
        { kind: "mainIdea", prompt: "What?", options: ["Cooking", "Cooking", "Driving"], answer: "Cooking" },
      ],
    });
    const { errors } = validateLessonModel([lesson], roadmap);

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("needs objective"),
      expect.stringContaining("at least two detail or sequence"),
      expect.stringContaining("duplicate options"),
      expect.stringContaining("answer exactly once"),
    ]));
  });

  it("flags likely duplicate communicative purposes within a level", () => {
    const first = roadmapLesson();
    const second = roadmapLesson({ id: "a2-hotel", title: "Another lesson" });
    const expandedRoadmap = {
      ...roadmap,
      entries: [...roadmap.entries, { wave: 1, id: "a2-hotel", level: "A2", focus: "Hotel" }],
    };
    expect(validateLessonModel([first, second], expandedRoadmap).warnings).toEqual([
      expect.stringContaining("may duplicate purpose"),
    ]);
    expect(purposeSimilarity(first.objective, second.objective)).toBe(1);
  });
});

describe("lesson content reporting", () => {
  it("reports current counts from lesson data and gaps from roadmap targets", () => {
    const report = buildCoverageReport(
      [roadmapLesson()],
      { targets: { A1: 15, A2: 22, B1: 25, B2: 18, C1: 12, C2: 8 }, entries: [] },
    );
    expect(report.totals).toMatchObject({ lessons: 1, phrases: 8 });
    expect(report.byLevel.A2).toMatchObject({ lessons: 1, phrases: 8, target: 22, remaining: 21 });
  });

  it("decodes PCM WAV metadata used by the audio quality gate", () => {
    expect(inspectWavBuffer(pcmWav())).toMatchObject({
      durationSeconds: 1,
      isSilent: false,
      leadingSilenceSeconds: 0,
      trailingSilenceSeconds: 0,
      clippedSampleRatio: 0,
    });
    expect(() => inspectWavBuffer(Buffer.from("not audio"))).toThrow("not a RIFF/WAVE file");
  });
});
