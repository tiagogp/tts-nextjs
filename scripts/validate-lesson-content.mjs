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

/**
 * Keys that carry a non-empty pt value. extractMessageKeys only proves a key
 * exists, so `"Foo": {}` would satisfy the gate while rendering English to a
 * Portuguese learner. Lesson copy is gated on this set instead.
 */
export function extractTranslatedMessageKeys(source) {
  const keys = new Set();
  let current = null;
  const hasPt = (line) => {
    const match = line.match(/(?:^|[{,\s])pt\s*:\s*"((?:\\.|[^"\\])*)"/);
    return Boolean(match) && match[1].trim() !== "";
  };
  for (const line of source.split("\n")) {
    const quoted = line.match(/^\s*"((?:\\.|[^"\\])*)"\s*:/);
    const bare = line.match(/^ {2}([A-Za-z_$][\w$]*)\s*:\s*\{/);
    if (quoted || bare) {
      current = null;
      if (quoted) {
        try {
          current = JSON.parse(`"${quoted[1]}"`);
        } catch {
          // TypeScript parsing reports malformed source; this extractor only gates lesson keys.
        }
      } else {
        current = bare[1];
      }
      // Single-line entries carry their pt value on the same line as the key.
      if (current && hasPt(line)) keys.add(current);
      continue;
    }
    if (!current) continue;
    if (hasPt(line)) keys.add(current);
    if (/^\s*\},?\s*$/.test(line)) current = null;
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

const SLOT = /_{3,}/;

/** Mirror of `expandContraction` in src/lib/language/pattern.ts. */
const NEGATIVE_STEMS = { wo: "will", ca: "can", sha: "shall" };
const CLITICS = { m: "am", re: "are", ve: "have", ll: "will" };
const expandContraction = (token) => {
  if (token === "cannot") return ["can", "not"];
  if (token === "let's") return ["let", "us"];
  if (token.endsWith("n't")) {
    const stem = token.slice(0, -3);
    return [NEGATIVE_STEMS[stem] ?? stem, "not"];
  }
  const [stem, clitic] = token.split("'");
  if (stem && clitic && CLITICS[clitic]) return [stem, CLITICS[clitic]];
  return [token];
};

/** Mirror of `tokenize` in src/lib/language/pattern.ts. Kept in step by the tests below. */
const patternTokens = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u2018\u2019\u02bc]/g, "'").toLowerCase()
  .replace(/[^a-z0-9']+/g, " ").trim().split(/\s+/).filter(Boolean).flatMap(expandContraction);

/** Mirror of `usesFrame` in src/lib/language/pattern.ts. Kept in step by the tests below. */
function frameMatches(frame, sentence) {
  const parts = frame.split(SLOT).map(patternTokens);
  const source = parts
    .map((part) => part.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"))
    .join("\\s+\\S[\\s\\S]*?\\s*");
  return new RegExp(`(?:^|\\s)${source}(?:\\s|$)`).test(` ${patternTokens(sentence).join(" ")} `);
}

/**
 * Pattern data is what makes the variation drill and the offline transfer check possible,
 * so a malformed frame does not degrade the feature — it silently disables it and, worse,
 * makes every transfer attempt on that item unverifiable. These are errors, not warnings.
 */
export function validatePatterns(lessons) {
  const errors = [];
  const warnings = [];
  const familyFrames = new Map();

  for (const lesson of lessons) {
    for (const phrase of lesson.phrases ?? []) {
      // Accepted alternatives are what stop the app calling correct English wrong, so a
      // duplicate or a stray copy of the phrase itself is not harmless clutter — it is a
      // wording somebody believed was covered and is not.
      if (phrase.accept !== undefined) {
        const where = `${lesson.id}/${JSON.stringify(phrase.en)}`;
        if (!Array.isArray(phrase.accept) || phrase.accept.length === 0) {
          errors.push(`${where}: accept must be a non-empty array when present.`);
        } else {
          if (phrase.accept.some((value) => typeof value !== "string" || !value.trim())) {
            errors.push(`${where}: accept holds an empty alternative.`);
          }
          if (phrase.accept.includes(phrase.en)) {
            errors.push(`${where}: accept repeats the phrase itself.`);
          }
          if (new Set(phrase.accept).size !== phrase.accept.length) {
            errors.push(`${where}: accept lists the same alternative twice.`);
          }
        }
      }

      const pattern = phrase.pattern;
      if (!pattern) continue;
      const where = `${lesson.id}/${pattern.id ?? "?"}`;
      if (!pattern.id || !pattern.frame || !pattern.slot) {
        errors.push(`${where}: pattern needs id, frame and slot.`);
        continue;
      }
      if (!SLOT.test(pattern.frame)) errors.push(`${where}: frame has no ___ slot.`);
      // A suffix slot tokenizes as its own word and can never match anything.
      if (/_{3,}[a-z]/i.test(pattern.frame)) errors.push(`${where}: frame glues the slot to a suffix.`);
      if (!Array.isArray(pattern.examples) || pattern.examples.length < 2) {
        errors.push(`${where}: a pattern family needs at least two examples.`);
        continue;
      }
      if (!pattern.examples.includes(phrase.en)) {
        errors.push(`${where}: examples must include the lesson phrase itself.`);
      }
      for (const example of pattern.examples) {
        if (!frameMatches(pattern.frame, example)) {
          errors.push(`${where}: frame does not match its own example ${JSON.stringify(example)}.`);
        }
      }
      if (pattern.contrast && pattern.examples.includes(pattern.contrast)) {
        errors.push(`${where}: contrast is also listed as a correct example.`);
      }
      // One id, one frame. Two frames sharing an id would interleave unrelated structures.
      const known = familyFrames.get(pattern.id);
      if (known && known !== pattern.frame) {
        errors.push(`${where}: pattern id also used with a different frame ${JSON.stringify(known)}.`);
      }
      familyFrames.set(pattern.id, pattern.frame);
    }
  }

  for (const lesson of lessons) {
    if (!["A2", "B1"].includes(lesson.level)) continue;
    // Only lessons that actually ship. The legacy B1 phrase lists are filtered out of
    // LESSONS by `hasCompleteGuidedMaterial`, so warning about them is noise — they offer
    // no drill because they offer no lesson.
    const shipped = Boolean(
      lesson.objective?.trim() && lesson.pronunciationFocus?.trim() &&
      (lesson.dialogue?.length ?? 0) >= 2 && (lesson.comprehension?.length ?? 0) >= 3 &&
      lesson.productionPrompt?.trim() && lesson.retryHint?.trim(),
    );
    if (!shipped) continue;
    const withPattern = (lesson.phrases ?? []).filter((phrase) => phrase.pattern).length;
    if (withPattern === 0) {
      warnings.push(`${lesson.id}: no phrase carries a pattern, so it offers no variation drill.`);
    }
  }

  return { errors, warnings };
}

/**
 * The cold-listening probe bank.
 *
 * Every rule here exists to keep one property true: a probe is speech the learner has never
 * heard, from a real speaker, heard once. A synthetic probe measures the Kokoro voice; a
 * probe that is also a lesson clip measures a sentence the learner studied; a probe with
 * two plausible answers measures nothing. The bank ships empty, and empty is valid — an
 * absent probe is honest, a fake one is not.
 */
export function validateColdProbes(bank, { lessons, manifestEntries }) {
  const errors = [];
  const warnings = [];
  const probes = Array.isArray(bank?.probes) ? bank.probes : null;
  if (!probes) return { errors: ["src/features/listening/coldProbes.json needs a probes array."], warnings, clips: [] };

  const lessonClips = new Set(lessons.flatMap(lessonAudio).map((item) => item.clip));
  const nativeByClip = new Map(
    (Array.isArray(manifestEntries) ? manifestEntries : [])
      .filter((entry) => nonEmptyString(entry?.clip))
      .map((entry) => [entry.clip, entry]),
  );
  const ids = [];
  const clips = [];
  const accents = new Set();

  for (const [index, probe] of probes.entries()) {
    const owner = `cold probe ${probe?.id ?? index + 1}`;
    for (const field of ["id", "clip", "accent", "speakerId", "topic"]) {
      if (!nonEmptyString(probe?.[field])) errors.push(`${owner} is missing ${field}.`);
    }
    if (!nonEmptyString(probe?.clip)) continue;
    ids.push({ value: probe.id, owner });
    clips.push(probe.clip);
    accents.add(probe.accent);

    if (!probe.clip.startsWith("/") || !probe.clip.endsWith(".wav")) errors.push(`${owner} needs a valid clip path.`);
    if (lessonClips.has(probe.clip)) errors.push(`${owner} uses ${probe.clip}, which is lesson audio. A probe the learner studies is not a cold probe.`);

    const native = nativeByClip.get(probe.clip);
    if (!native) errors.push(`${owner} has no native-audio manifest entry. A probe must be a licensed recording, never synthesis.`);
    else if (native.recordingKind !== "native") errors.push(`${owner} resolves to ${native.recordingKind} audio.`);

    // 10-25s: long enough to carry a main idea, short enough to hold on one listen.
    if (!Number.isFinite(probe.durationSec) || probe.durationSec < 10 || probe.durationSec > 25) {
      errors.push(`${owner} needs durationSec between 10 and 25.`);
    }

    const questions = Array.isArray(probe.questions) ? probe.questions : [];
    const mainIdea = questions.filter((question) => question?.kind === "mainIdea");
    if (mainIdea.length !== 1) errors.push(`${owner} needs exactly one mainIdea question.`);
    for (const [position, question] of questions.entries()) {
      const label = `${owner} question ${position + 1}`;
      if (!["mainIdea", "detail"].includes(question?.kind)) errors.push(`${label} needs kind mainIdea or detail.`);
      if (!nonEmptyString(question?.prompt)) errors.push(`${label} needs a prompt.`);
      const options = Array.isArray(question?.options) ? question.options : [];
      if (options.length < 3) errors.push(`${label} needs at least three options.`);
      if (new Set(options).size !== options.length) errors.push(`${label} repeats an option.`);
      if (!options.includes(question?.answer)) errors.push(`${label} has an answer that is not one of its options.`);
    }
  }

  addDuplicateErrors(ids, "cold probe id", errors);
  addDuplicateErrors(clips.map((clip, index) => ({ value: clip, owner: `cold probe ${index + 1}` })), "cold probe clip", errors);

  // Targets from the audit, as warnings: a thin bank still measures something real, and
  // blocking the build over content the project has not licensed yet helps nobody.
  if (probes.length > 0 && probes.length < 15) warnings.push(`Cold probe bank has ${probes.length} clips; 15-25 gives a fortnightly probe for a year.`);
  if (probes.length > 0 && accents.size < 3) warnings.push(`Cold probe bank covers ${accents.size} accent(s); unfamiliar speech means varied speech.`);

  return { errors, warnings, clips };
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

    // Every lesson needs PT-BR copy, not just roadmap ones: nextLessonFor can serve a
    // lesson above the learner's level while their profile — and so the Portuguese UI —
    // stays put, and translate() falls back to the English source on a missing key.
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

export async function validateAudio(lessons, { publicDir, nativeDir, manifestEntries, probeClips = [] }) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(manifestEntries)) {
    errors.push("native-audio/manifest.json must contain an array.");
    manifestEntries = [];
  }
  // Probe clips are declared by the cold-listening bank rather than by a lesson, and are
  // deliberately absent from lessons.json so nothing can ever synthesize or teach them.
  const declaredClips = new Set([...lessons.flatMap(lessonAudio).map((item) => item.clip), ...probeClips]);
  const seenManifestClips = new Set();
  for (const [index, entry] of manifestEntries.entries()) {
    const owner = `native-audio manifest entry ${index + 1}`;
    if (!nonEmptyString(entry?.clip) || !entry.clip.startsWith("/") || !entry.clip.endsWith(".wav")) {
      errors.push(`${owner} needs a valid clip path.`);
      continue;
    }
    if (seenManifestClips.has(entry.clip)) errors.push(`${owner} duplicates ${entry.clip}.`);
    seenManifestClips.add(entry.clip);
    for (const field of ["recordingKind", "speaker", "speakerId", "accent", "delivery", "provenance", "license", "recordedAt", "normalizationStatus"]) {
      if (!nonEmptyString(entry?.[field])) errors.push(`${owner} for ${entry.clip} is missing ${field}.`);
    }
    if (entry?.recordingKind !== "native") errors.push(`${owner} for ${entry.clip} must use recordingKind native.`);
    if (!["supported", "natural", "connected"].includes(entry?.delivery)) errors.push(`${owner} for ${entry.clip} has invalid delivery.`);
    if (!Number.isFinite(entry?.speedWpm) || entry.speedWpm <= 0) errors.push(`${owner} for ${entry.clip} needs a positive speedWpm.`);
    if (!Array.isArray(entry?.connectedSpeechFeatures)) errors.push(`${owner} for ${entry.clip} needs connectedSpeechFeatures (use [] when none apply).`);
    if (entry?.delivery === "connected" && entry.connectedSpeechFeatures.length === 0) errors.push(`${owner} for ${entry.clip} needs connected-speech evidence.`);
    if (!declaredClips.has(entry.clip)) errors.push(`${owner} references undeclared clip ${entry.clip}.`);
    const nativeSource = path.join(nativeDir, entry.clip.slice(1));
    if (!(await exists(nativeSource))) {
      errors.push(`${owner} has no source recording at native-audio${entry.clip}.`);
    }
  }
  const nativeByClip = new Map(manifestEntries.map((entry) => [entry.clip, entry]));
  for (const clip of probeClips) {
    if (!nonEmptyString(clip) || !clip.startsWith("/") || !clip.endsWith(".wav")) continue;
    const publicFile = path.resolve(publicDir, clip.slice(1));
    if (!publicFile.startsWith(`${path.resolve(publicDir)}${path.sep}`)) {
      errors.push(`cold probe: invalid audio path ${clip}.`);
      continue;
    }
    if (!(await exists(publicFile))) {
      errors.push(`cold probe: missing ${clip} — run yarn learn:audio to install it from native-audio/.`);
      continue;
    }
    try {
      const quality = await inspectWav(publicFile);
      if (quality.isSilent) errors.push(`cold probe: ${clip} contains no audible signal.`);
      if (quality.durationSeconds < 5 || quality.durationSeconds > 40) {
        errors.push(`cold probe: ${clip} duration ${quality.durationSeconds.toFixed(2)}s is outside 5-40s.`);
      }
    } catch (error) {
      errors.push(`cold probe: ${clip} cannot be decoded (${error.message}).`);
    }
  }
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
    readFile(path.join(rootDir, "docs/product.md"), "utf8"),
    readFile(path.join(rootDir, "native-audio/manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDir, "src/i18n/messages.ts"), "utf8"),
  ]);
  const probeBank = await readFile(path.join(rootDir, "src/features/listening/coldProbes.json"), "utf8").then(JSON.parse);
  const roadmap = parseRoadmap(roadmapMarkdown);
  const model = validateLessonModel(lessons, roadmap, extractTranslatedMessageKeys(messagesSource));
  const patterns = validatePatterns(lessons);
  const probes = validateColdProbes(probeBank, { lessons, manifestEntries });
  const audio = await validateAudio(lessons, {
    publicDir: path.join(rootDir, "public"),
    nativeDir: path.join(rootDir, "native-audio"),
    manifestEntries,
    probeClips: probes.clips,
  });
  const report = buildCoverageReport(lessons, roadmap, audio.rows);

  if (args.has("--json")) {
    console.log(JSON.stringify({
      ...report,
      errors: [...model.errors, ...patterns.errors, ...probes.errors, ...audio.errors],
      warnings: [...model.warnings, ...patterns.warnings, ...probes.warnings, ...audio.warnings],
    }, null, 2));
  } else {
    console.log(`Lesson content: ${report.totals.lessons} lessons / ${report.totals.phrases} phrases`);
    for (const level of LEVELS) {
      const row = report.byLevel[level];
      console.log(`  ${level}: ${row.lessons}/${row.target} lessons, ${row.phrases} phrases, ${row.remaining} remaining`);
    }
    console.log(`Roadmap backlog: ${report.totals.roadmapLessonsPresent} present / ${report.totals.roadmapLessonsRemaining} remaining`);
    const patterned = lessons.reduce((sum, lesson) => sum + (lesson.phrases ?? []).filter((p) => p.pattern).length, 0);
    const families = new Set(lessons.flatMap((l) => (l.phrases ?? []).flatMap((p) => (p.pattern ? [p.pattern.id] : []))));
    console.log(`Patterns: ${patterned} phrases across ${families.size} families`);
    console.log(`Cold-listening probes: ${probes.clips.length} authentic clip(s)${probes.clips.length === 0 ? " — unfamiliar-speech comprehension stays unmeasured" : ""}`);
    for (const warning of [...model.warnings, ...patterns.warnings, ...probes.warnings, ...audio.warnings]) console.warn(`WARN: ${warning}`);
    for (const error of [...model.errors, ...patterns.errors, ...probes.errors, ...audio.errors]) console.error(`ERROR: ${error}`);
  }

  if (model.errors.length + patterns.errors.length + probes.errors.length + audio.errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
