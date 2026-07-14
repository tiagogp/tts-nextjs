#!/usr/bin/env node
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentPath), "..");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const REQUIRED_PHRASE_FIELDS = ["en", "pt", "concept", "note", "clip"];
const REQUIRED_MATERIAL_FIELDS = [
  "objective",
  "dialogue",
  "comprehension",
  "productionPrompt",
  "retryHint",
];

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedWords(value) {
  return new Set(
    String(value ?? "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

export function purposeSimilarity(left, right) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / new Set([...a, ...b]).size;
}

export function parseRoadmap(markdown) {
  const targets = {};
  const entries = [];
  for (const line of markdown.split("\n")) {
    const target = line.match(/^\| (A1|A2|B1|B2|C1|C2) \| \d+ \| (\d+) \| \d+ \|/);
    if (target) targets[target[1]] = Number(target[2]);

    const backlog = line.match(/^\| ([1-4]) \| `([a-z0-9-]+)` \| (.+) \|$/);
    if (backlog) {
      entries.push({
        wave: Number(backlog[1]),
        id: backlog[2],
        level: backlog[2].slice(0, 2).toUpperCase(),
        focus: backlog[3].trim(),
      });
    }
  }
  return { targets, entries };
}

export function extractMessageKeys(source) {
  const keys = new Set();
  for (const line of source.split("\n")) {
    const quoted = line.match(/^\s*"((?:\\.|[^"\\])*)"\s*:/);
    if (quoted) {
      try {
        keys.add(JSON.parse(`"${quoted[1]}"`));
      } catch {
        // TypeScript parsing will report malformed source; this extractor only gates lesson keys.
      }
      continue;
    }
    // Keys that are valid identifiers are written unquoted (Travel, Study, Continue).
    // They translate at runtime like any other, so the validator has to see them or it
    // reports a missing PT-BR message for a string that is in fact translated. Entries
    // open a brace, which keeps the inner language lines (pt: "...") out of the set.
    const bare = line.match(/^ {2}([A-Za-z_$][\w$]*)\s*:\s*\{/);
    if (bare) keys.add(bare[1]);
  }
  return keys;
}

function addDuplicateErrors(values, label, errors) {
  const seen = new Map();
  for (const { value, owner } of values) {
    const key = String(value).trim().toLocaleLowerCase("en-US");
    if (!key) continue;
    const previous = seen.get(key);
    if (previous) errors.push(`${label} "${value}" is duplicated by ${previous} and ${owner}.`);
    else seen.set(key, owner);
  }
}

function lessonAudio(lesson) {
  return [
    ...(Array.isArray(lesson.phrases)
      ? lesson.phrases.map((phrase) => ({ clip: phrase.clip, text: phrase.en, kind: "phrase" }))
      : []),
    ...(Array.isArray(lesson.dialogue)
      ? lesson.dialogue.map((line) => ({ clip: line.clip, text: line.en, kind: "dialogue" }))
      : []),
  ];
}

export function validateLessonModel(lessons, roadmap, translatedStrings) {
  const errors = [];
  const warnings = [];
  const roadmapById = new Map(roadmap.entries.map((entry) => [entry.id, entry]));
  const lessonIds = [];
  const phraseIds = [];
  const phraseTexts = [];
  const audioIds = [];

  if (!Array.isArray(lessons)) return { errors: ["lessons.json must contain an array."], warnings };

  for (const [lessonIndex, lesson] of lessons.entries()) {
    const owner = nonEmptyString(lesson?.id) ? lesson.id : `lesson at index ${lessonIndex}`;
    for (const field of ["id", "title", "topic"]) {
      if (!nonEmptyString(lesson?.[field])) errors.push(`${owner} is missing ${field}.`);
    }
    if (nonEmptyString(lesson?.id) && !/^[a-z0-9-]+$/.test(lesson.id)) {
      errors.push(`${owner} id must use lowercase letters, numbers, and hyphens only.`);
    }
    if (!LEVELS.includes(lesson?.level)) errors.push(`${owner} has invalid CEFR level ${JSON.stringify(lesson?.level)}.`);
    if (nonEmptyString(lesson?.id)) lessonIds.push({ value: lesson.id, owner });
    if (!Array.isArray(lesson?.phrases) || lesson.phrases.length < 8) {
      errors.push(`${owner} must contain at least 8 phrases.`);
      continue;
    }

    const roadmapEntry = roadmapById.get(lesson.id);
    if (roadmapEntry && lesson.level !== roadmapEntry.level) {
      errors.push(`${owner} is ${lesson.level}, but the roadmap assigns it to ${roadmapEntry.level}.`);
    }

    for (const [phraseIndex, phrase] of lesson.phrases.entries()) {
      const phraseOwner = `${owner} phrase ${phraseIndex + 1}`;
      for (const field of REQUIRED_PHRASE_FIELDS) {
        if (!nonEmptyString(phrase?.[field])) errors.push(`${phraseOwner} is missing ${field}.`);
      }
      phraseTexts.push({ value: phrase?.en ?? "", owner: phraseOwner });
      if (nonEmptyString(phrase?.clip)) audioIds.push({ value: phrase.clip, owner: phraseOwner });
      if (roadmapEntry) {
        if (!nonEmptyString(phrase?.id)) errors.push(`${phraseOwner} needs a stable id.`);
        else {
          phraseIds.push({ value: phrase.id, owner: phraseOwner });
          if (!/^[a-z0-9-]+$/.test(phrase.id)) {
            errors.push(`${phraseOwner} id must use lowercase letters, numbers, and hyphens only.`);
          }
        }
      }
    }

    if (!roadmapEntry) continue;
    for (const field of REQUIRED_MATERIAL_FIELDS) {
      const value = lesson[field];
      if (Array.isArray(value) ? value.length === 0 : !nonEmptyString(value)) {
        errors.push(`${owner} is a roadmap lesson and needs ${field}.`);
      }
    }

    if (Array.isArray(lesson.dialogue)) {
      for (const [lineIndex, line] of lesson.dialogue.entries()) {
        const lineOwner = `${owner} dialogue line ${lineIndex + 1}`;
        for (const field of ["speaker", "en", "pt", "clip"]) {
          if (!nonEmptyString(line?.[field])) errors.push(`${lineOwner} is missing ${field}.`);
        }
        if (nonEmptyString(line?.clip)) audioIds.push({ value: line.clip, owner: lineOwner });
      }
    }

    if (Array.isArray(lesson.comprehension)) {
      const mainIdeas = lesson.comprehension.filter((question) => question?.kind === "mainIdea");
      const meaningChecks = lesson.comprehension.filter((question) => question?.kind !== "mainIdea");
      if (mainIdeas.length !== 1) errors.push(`${owner} needs exactly one mainIdea question.`);
      if (meaningChecks.length < 2) errors.push(`${owner} needs at least two detail or sequence questions.`);
      for (const [questionIndex, question] of lesson.comprehension.entries()) {
        const questionOwner = `${owner} comprehension question ${questionIndex + 1}`;
        if (!["mainIdea", "detail", "sequence"].includes(question?.kind)) {
          errors.push(`${questionOwner} has invalid kind ${JSON.stringify(question?.kind)}.`);
        }
        if (!nonEmptyString(question?.prompt)) errors.push(`${questionOwner} is missing prompt.`);
        if (!Array.isArray(question?.options) || question.options.length < 3) {
          errors.push(`${questionOwner} needs at least three options.`);
          continue;
        }
        if (new Set(question.options).size !== question.options.length) {
          errors.push(`${questionOwner} has duplicate options.`);
        }
        if (question.options.filter((option) => option === question.answer).length !== 1) {
          errors.push(`${questionOwner} must contain its answer exactly once.`);
        }
      }
    }

    if (translatedStrings) {
      const localized = [
        lesson.title,
        lesson.topic,
        lesson.objective,
        lesson.pronunciationFocus,
        lesson.productionPrompt,
        lesson.retryHint,
        ...(lesson.comprehension ?? []).flatMap((question) => [
          question?.prompt,
          ...(question?.options ?? []),
        ]),
      ].filter(nonEmptyString);
      for (const value of localized) {
        if (!translatedStrings.has(value)) errors.push(`${owner} is missing a PT-BR message for "${value}".`);
      }
    }
  }

  addDuplicateErrors(lessonIds, "Lesson id", errors);
  addDuplicateErrors(phraseIds, "Phrase id", errors);
  addDuplicateErrors(phraseTexts, "English phrase", errors);
  addDuplicateErrors(audioIds, "Audio id", errors);

  for (let left = 0; left < lessons.length; left++) {
    for (let right = left + 1; right < lessons.length; right++) {
      const similarity = purposeSimilarity(
        lessons[left].objective ?? lessons[left].topic,
        lessons[right].objective ?? lessons[right].topic,
      );
      if (similarity >= 0.7) {
        warnings.push(
          `${lessons[left].id} and ${lessons[right].id} may duplicate purpose (${Math.round(similarity * 100)}% token overlap).`,
        );
      }
    }
  }

  return { errors, warnings };
}

function findChunk(buffer, name) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkName = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (chunkName === name) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function inspectWavBuffer(buffer) {
  if (
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) throw new Error("not a RIFF/WAVE file");
  const format = findChunk(buffer, "fmt ");
  const data = findChunk(buffer, "data");
  if (!format || format.size < 16 || !data) throw new Error("missing fmt or data chunk");

  const audioFormat = buffer.readUInt16LE(format.offset);
  const channels = buffer.readUInt16LE(format.offset + 2);
  const sampleRate = buffer.readUInt32LE(format.offset + 4);
  const bitsPerSample = buffer.readUInt16LE(format.offset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || sampleRate < 8_000) {
    throw new Error("expected 16-bit PCM WAV at 8 kHz or higher");
  }

  const sampleCount = Math.floor(data.size / 2);
  const frameCount = Math.floor(sampleCount / channels);
  const durationSeconds = frameCount / sampleRate;
  const silenceThreshold = 327;
  let clipped = 0;
  let firstAudibleFrame = frameCount;
  let lastAudibleFrame = -1;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const sample = buffer.readInt16LE(data.offset + sampleIndex * 2);
    if (Math.abs(sample) >= 32760) clipped++;
    if (Math.abs(sample) > silenceThreshold) {
      const frame = Math.floor(sampleIndex / channels);
      firstAudibleFrame = Math.min(firstAudibleFrame, frame);
      lastAudibleFrame = Math.max(lastAudibleFrame, frame);
    }
  }
  return {
    durationSeconds,
    isSilent: lastAudibleFrame < 0,
    leadingSilenceSeconds: firstAudibleFrame / sampleRate,
    trailingSilenceSeconds: lastAudibleFrame < 0 ? durationSeconds : (frameCount - lastAudibleFrame - 1) / sampleRate,
    clippedSampleRatio: sampleCount ? clipped / sampleCount : 0,
  };
}

export async function inspectWav(file) {
  const handle = await open(file, "r");
  try {
    const info = await handle.stat();
    const buffer = Buffer.alloc(info.size);
    await handle.read(buffer, 0, info.size, 0);
    return inspectWavBuffer(buffer);
  } finally {
    await handle.close();
  }
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export async function validateAudio(lessons, { publicDir, nativeDir, manifestEntries }) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(manifestEntries)) {
    errors.push("native-audio/manifest.json must contain an array.");
    manifestEntries = [];
  }
  const declaredClips = new Set(lessons.flatMap(lessonAudio).map((item) => item.clip));
  const seenManifestClips = new Set();
  for (const [index, entry] of manifestEntries.entries()) {
    const owner = `native-audio manifest entry ${index + 1}`;
    if (!nonEmptyString(entry?.clip) || !entry.clip.startsWith("/") || !entry.clip.endsWith(".wav")) {
      errors.push(`${owner} needs a valid clip path.`);
      continue;
    }
    if (seenManifestClips.has(entry.clip)) errors.push(`${owner} duplicates ${entry.clip}.`);
    seenManifestClips.add(entry.clip);
    for (const field of ["speaker", "license", "recordedAt", "normalizationStatus"]) {
      if (!nonEmptyString(entry?.[field])) errors.push(`${owner} for ${entry.clip} is missing ${field}.`);
    }
    if (!declaredClips.has(entry.clip)) errors.push(`${owner} references undeclared clip ${entry.clip}.`);
    const nativeSource = path.join(nativeDir, entry.clip.slice(1));
    if (!(await exists(nativeSource))) {
      errors.push(`${owner} has no source recording at native-audio${entry.clip}.`);
    }
  }
  const nativeByClip = new Map(manifestEntries.map((entry) => [entry.clip, entry]));
  const rows = [];

  for (const lesson of lessons) {
    const clips = lessonAudio(lesson);
    let native = 0;
    let synthetic = 0;
    let missing = 0;
    for (const item of clips) {
      if (!nonEmptyString(item.clip) || !item.clip.startsWith("/") || !item.clip.endsWith(".wav")) continue;
      const publicFile = path.resolve(publicDir, item.clip.slice(1));
      if (!publicFile.startsWith(`${path.resolve(publicDir)}${path.sep}`)) {
        errors.push(`${lesson.id}: invalid audio path ${item.clip}.`);
        continue;
      }
      if (!(await exists(publicFile))) {
        errors.push(`${lesson.id}: missing ${item.clip}.`);
        missing++;
        continue;
      }
      const nativeEntry = nativeByClip.get(item.clip);
      if (nativeEntry && await exists(path.join(nativeDir, item.clip.slice(1)))) native++;
      else synthetic++;
      try {
        const quality = await inspectWav(publicFile);
        if (quality.durationSeconds < 0.25 || quality.durationSeconds > 30) {
          errors.push(`${lesson.id}: ${item.clip} duration ${quality.durationSeconds.toFixed(2)}s is outside 0.25-30s.`);
        }
        if (quality.isSilent) errors.push(`${lesson.id}: ${item.clip} contains no audible signal.`);
        if (quality.leadingSilenceSeconds > 0.5 || quality.trailingSilenceSeconds > 0.5) {
          warnings.push(`${lesson.id}: ${item.clip} has more than 0.5s of leading or trailing silence.`);
        }
        if (quality.clippedSampleRatio > 0.001) {
          errors.push(`${lesson.id}: ${item.clip} clips ${(quality.clippedSampleRatio * 100).toFixed(2)}% of samples.`);
        }
      } catch (error) {
        errors.push(`${lesson.id}: ${item.clip} cannot be decoded (${error.message}).`);
      }
    }
    rows.push({ lessonId: lesson.id, level: lesson.level, total: clips.length, native, synthetic, missing });
  }
  return { errors, warnings, rows };
}

export function buildCoverageReport(lessons, roadmap, audioRows = []) {
  const byLevel = Object.fromEntries(LEVELS.map((level) => [level, {
    lessons: 0,
    phrases: 0,
    target: roadmap.targets[level] ?? null,
    remaining: null,
  }]));
  const grammarPatterns = {};
  const communicativeFunctions = {};
  const domains = {};
  for (const lesson of lessons) {
    byLevel[lesson.level].lessons++;
    byLevel[lesson.level].phrases += lesson.phrases.length;
    const purpose = lesson.objective ?? lesson.topic;
    communicativeFunctions[purpose] = (communicativeFunctions[purpose] ?? 0) + 1;
    domains[lesson.topic] = (domains[lesson.topic] ?? 0) + 1;
    for (const phrase of lesson.phrases) {
      grammarPatterns[phrase.concept] = (grammarPatterns[phrase.concept] ?? 0) + 1;
    }
  }
  for (const level of LEVELS) {
    const row = byLevel[level];
    row.remaining = row.target === null ? null : Math.max(0, row.target - row.lessons);
  }
  const presentIds = new Set(lessons.map((lesson) => lesson.id));
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      lessons: lessons.length,
      phrases: lessons.reduce((total, lesson) => total + lesson.phrases.length, 0),
      roadmapLessonsPresent: roadmap.entries.filter((entry) => presentIds.has(entry.id)).length,
      roadmapLessonsRemaining: roadmap.entries.filter((entry) => !presentIds.has(entry.id)).length,
    },
    byLevel,
    communicativeFunctions,
    domains,
    grammarPatterns,
    audio: audioRows,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const [lessons, roadmapMarkdown, manifestEntries, messagesSource] = await Promise.all([
    readFile(path.join(rootDir, "src/features/learn/lessons.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDir, "docs/100-lesson-roadmap.md"), "utf8"),
    readFile(path.join(rootDir, "native-audio/manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDir, "src/i18n/messages.ts"), "utf8"),
  ]);
  const roadmap = parseRoadmap(roadmapMarkdown);
  const model = validateLessonModel(lessons, roadmap, extractMessageKeys(messagesSource));
  const audio = await validateAudio(lessons, {
    publicDir: path.join(rootDir, "public"),
    nativeDir: path.join(rootDir, "native-audio"),
    manifestEntries,
  });
  const report = buildCoverageReport(lessons, roadmap, audio.rows);

  if (args.has("--json")) {
    console.log(JSON.stringify({ ...report, errors: [...model.errors, ...audio.errors], warnings: [...model.warnings, ...audio.warnings] }, null, 2));
  } else {
    console.log(`Lesson content: ${report.totals.lessons} lessons / ${report.totals.phrases} phrases`);
    for (const level of LEVELS) {
      const row = report.byLevel[level];
      console.log(`  ${level}: ${row.lessons}/${row.target} lessons, ${row.phrases} phrases, ${row.remaining} remaining`);
    }
    console.log(`Roadmap backlog: ${report.totals.roadmapLessonsPresent} present / ${report.totals.roadmapLessonsRemaining} remaining`);
    for (const warning of [...model.warnings, ...audio.warnings]) console.warn(`WARN: ${warning}`);
    for (const error of [...model.errors, ...audio.errors]) console.error(`ERROR: ${error}`);
  }

  if (model.errors.length + audio.errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
