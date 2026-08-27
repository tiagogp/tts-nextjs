import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverageReport,
  extractMessageKeys,
  extractTranslatedMessageKeys,
  inspectWavBuffer,
  parseRoadmap,
  purposeSimilarity,
  validateLessonModel,
  validateColdProbes,
  validatePatterns,
} from "./validate-lesson-content.mjs";
import { usesFrame } from "../src/lib/language/pattern.ts";

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
    const markdown = await readFile(path.join(rootDir, "docs/product.md"), "utf8");
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

  it("extracts unquoted identifier keys, which translate like any other", () => {
    const source = [
      '  Travel: { pt: "Viagem" },',
      '  "Rent": { pt: "Aluguel" },',
      '  "Multi": {',
      '    pt: "Multi",',
      "  },",
    ].join("\n");
    expect(extractMessageKeys(source)).toEqual(new Set(["Travel", "Rent", "Multi"]));
  });

  it("gates on a real pt value, not merely the presence of a key", () => {
    const source = [
      '  Travel: { pt: "Viagem" },',
      '  "Translated": { pt: "Traduzido" },',
      '  "Multi": {',
      '    pt: "Multi",',
      "  },",
      '  "Empty": { pt: "" },',
      '  "OtherLangsOnly": { de: "Reise", es: "Viaje" },',
      '  "NoValue": {},',
    ].join("\n");

    // The old key-only extractor cannot tell these apart, which is why lesson copy
    // is gated on the translated set instead.
    expect(extractMessageKeys(source)).toContain("NoValue");
    expect(extractTranslatedMessageKeys(source)).toEqual(
      new Set(["Travel", "Translated", "Multi"]),
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

  it("requires PT-BR copy for lessons outside the roadmap backlog", () => {
    // nextLessonFor can serve a lesson above the learner's level while their profile
    // keeps the Portuguese UI, so an untranslated lesson renders English copy to a
    // Portuguese learner whether or not the roadmap happens to list it.
    const lesson = roadmapLesson({ id: "c2-unlisted", level: "C2", title: "Unlisted lesson" });
    const { errors } = validateLessonModel([lesson], roadmap, new Set());

    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining('is missing a PT-BR message for "Unlisted lesson"')]),
    );
  });

  it("passes a lesson whose copy is fully translated", () => {
    const lesson = roadmapLesson();
    const translated = new Set([
      lesson.title,
      lesson.topic,
      lesson.objective,
      lesson.productionPrompt,
      lesson.retryHint,
      ...lesson.comprehension.flatMap((question) => [question.prompt, ...question.options]),
    ]);

    expect(validateLessonModel([lesson], roadmap, translated).errors).toEqual([]);
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


describe("validatePatterns", () => {
  const lesson = (pattern) => ([{
    id: "a2-x", level: "A2",
    phrases: [{ en: "I ended up staying home.", pt: "Acabei ficando em casa.", pattern }],
  }]);

  const good = {
    id: "ended-up", frame: "I ended up ___", slot: "-ing verb phrase",
    examples: ["I ended up staying home.", "I ended up buying it."],
    contrast: "I ended up to stay home.",
  };

  it("accepts a well-formed family", () => {
    expect(validatePatterns(lesson(good)).errors).toEqual([]);
  });

  it("rejects a frame with no slot", () => {
    expect(validatePatterns(lesson({ ...good, frame: "I ended up" })).errors.join()).toContain("no ___ slot");
  });

  it("rejects a slot glued to a suffix, which can never match", () => {
    expect(validatePatterns(lesson({ ...good, frame: "I ended ___ing" })).errors.join()).toContain("suffix");
  });

  it("rejects a family of one", () => {
    expect(validatePatterns(lesson({ ...good, examples: ["I ended up staying home."] })).errors.join())
      .toContain("at least two examples");
  });

  it("rejects a frame that does not match its own examples", () => {
    const errors = validatePatterns(lesson({ ...good, examples: ["I ended up staying home.", "I finally stayed."] })).errors;
    expect(errors.join()).toContain("does not match its own example");
  });

  it("rejects one pattern id used with two different frames", () => {
    const lessons = [
      { id: "a", level: "A2", phrases: [{ en: "I ended up staying home.", pattern: good }] },
      { id: "b", level: "A2", phrases: [{ en: "I ended up buying it.", pattern: { ...good, frame: "I ended up really ___" } }] },
    ];
    expect(validatePatterns(lessons).errors.join()).toContain("different frame");
  });

  it("rejects accepted alternatives that cover nothing", () => {
    const phrase = (accept) => [{
      id: "t", level: "A2",
      phrases: [{ en: "It depends on the situation.", accept }],
    }];
    expect(validatePatterns(phrase(["It depends."])).errors).toEqual([]);
    expect(validatePatterns(phrase([])).errors.join()).toContain("non-empty array");
    expect(validatePatterns(phrase(["  "])).errors.join()).toContain("empty alternative");
    expect(validatePatterns(phrase(["It depends on the situation."])).errors.join())
      .toContain("repeats the phrase itself");
    expect(validatePatterns(phrase(["It depends.", "It depends."])).errors.join())
      .toContain("same alternative twice");
  });

  it("expands contractions exactly as the runtime tokenizer does", () => {
    // Same reason as the frame mirror below: the validator runs in plain node at prebuild,
    // so it carries its own copy and the two have to agree.
    const cases = [
      ["I don't ___", "I do not eat meat.", true],
      ["I do not think ___ is ___", "I don't think that objection is decisive.", true],
      ["Let's ___", "Let us agree to disagree.", true],
      // `'d` is would-or-had, so it is never expanded and never silently matched.
      ["I'd like ___", "I would like a coffee.", false],
    ];
    for (const [frame, sentence, expected] of cases) {
      expect(usesFrame(sentence, frame), `${frame} / ${sentence}`).toBe(expected);
      const errors = validatePatterns([{
        id: "t", level: "A2",
        phrases: [{ en: sentence, pattern: { id: "t", frame, slot: "x", examples: [sentence, sentence] } }],
      }]).errors;
      expect(errors.some((error) => error.includes("does not match")), `${frame} / ${sentence}`).toBe(!expected);
    }
  });

  it("matches frames exactly as the runtime does", () => {
    // The validator carries its own copy of the matcher because it runs in plain node at
    // prebuild time. If the two ever disagree, the build passes content the app cannot use.
    const cases = [
      ["I ended up ___", "I ended up cancelling the trip.", true],
      ["I ended up ___", "I finally cancelled the trip.", false],
      ["I ended up ___", "Honestly I ended up paying twice.", true],
      ["I ended up ___", "I ended up.", false],
      ["___ is very ___", "The service is very slow.", true],
      ["Can I have ___?", "Can I have the menu?", true],
    ];
    for (const [frame, sentence, expected] of cases) {
      expect(usesFrame(sentence, frame), `${frame} / ${sentence}`).toBe(expected);
      // Same input through the validator: an unmatched example is reported as an error.
      const errors = validatePatterns([{
        id: "t", level: "A2",
        phrases: [{ en: sentence, pattern: { id: "t", frame, slot: "x", examples: [sentence, sentence] } }],
      }]).errors;
      expect(errors.some((error) => error.includes("does not match")), `${frame} / ${sentence}`).toBe(!expected);
    }
  });
});

describe("validateColdProbes", () => {
  const lessons = [roadmapLesson()];
  const manifest = [{ clip: "/learn/probes/market.wav", recordingKind: "native", license: "CC-BY 4.0" }];
  const probe = (overrides = {}) => ({
    id: "market-queue",
    clip: "/learn/probes/market.wav",
    accent: "Irish",
    speakerId: "probe-market",
    durationSec: 18,
    topic: "queueing at a market stall",
    questions: [
      { kind: "mainIdea", prompt: "What is happening?", options: ["A complaint", "A sale", "A delay"], answer: "A delay" },
      { kind: "detail", prompt: "How long?", options: ["Ten minutes", "An hour", "All day"], answer: "An hour" },
    ],
    ...overrides,
  });

  it("accepts an empty bank: no probe is honest, a fake one is not", () => {
    const result = validateColdProbes({ probes: [] }, { lessons, manifestEntries: [] });
    expect(result.errors).toEqual([]);
    expect(result.clips).toEqual([]);
  });

  it("accepts a licensed native clip", () => {
    const result = validateColdProbes({ probes: [probe()] }, { lessons, manifestEntries: manifest });
    expect(result.errors).toEqual([]);
    expect(result.clips).toEqual(["/learn/probes/market.wav"]);
  });

  it("rejects a probe with no native recording behind it", () => {
    const result = validateColdProbes({ probes: [probe()] }, { lessons, manifestEntries: [] });
    expect(result.errors.some((error) => error.includes("native-audio manifest"))).toBe(true);
  });

  it("rejects a probe that is also lesson audio", () => {
    const clip = lessons[0].phrases[0].clip;
    const result = validateColdProbes(
      { probes: [probe({ clip })] },
      { lessons, manifestEntries: [{ clip, recordingKind: "native", license: "own" }] },
    );
    expect(result.errors.some((error) => error.includes("lesson audio"))).toBe(true);
  });

  it("rejects an unscorable question set", () => {
    const noMainIdea = validateColdProbes(
      { probes: [probe({ questions: [{ kind: "detail", prompt: "?", options: ["a", "b", "c"], answer: "a" }] })] },
      { lessons, manifestEntries: manifest },
    );
    expect(noMainIdea.errors.some((error) => error.includes("exactly one mainIdea"))).toBe(true);

    const badAnswer = validateColdProbes(
      { probes: [probe({ questions: [{ kind: "mainIdea", prompt: "?", options: ["a", "b", "c"], answer: "d" }] })] },
      { lessons, manifestEntries: manifest },
    );
    expect(badAnswer.errors.some((error) => error.includes("not one of its options"))).toBe(true);
  });

  it("rejects a clip too long to hold on one listen", () => {
    const result = validateColdProbes({ probes: [probe({ durationSec: 90 })] }, { lessons, manifestEntries: manifest });
    expect(result.errors.some((error) => error.includes("durationSec"))).toBe(true);
  });

  it("warns about a thin or single-accent bank without blocking the build", () => {
    const result = validateColdProbes({ probes: [probe()] }, { lessons, manifestEntries: manifest });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes("15-25"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("accent"))).toBe(true);
  });
});
