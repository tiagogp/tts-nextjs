#!/usr/bin/env node
/**
 * Merge authored guided material into lessons.json and its PT-BR strings into messages.ts.
 *
 * A guided lesson is objective + pronunciation focus + a recorded dialogue + a comprehension
 * check + a production prompt and retry hint. Until every one of those is present the lesson
 * either does not ship as a lesson at all (B1) or ships as a bare recognition list (B2+).
 * This script promotes the legacy phrase lists in one pass.
 *
 * Authored strings carry their own Portuguese here so the two never drift: the script writes
 * the dialogue's `pt` inline and inserts every other localized string into messages.ts, so a
 * missing translation is impossible by construction rather than caught later by the gate.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const lessonsPath = resolve(here, "../../src/features/learn/lessons.json");
const messagesPath = resolve(here, "../../src/i18n/messages.ts");
const materialPath = resolve(here, "guided-material.json");

const lessons = JSON.parse(readFileSync(lessonsPath, "utf8"));
const material = JSON.parse(readFileSync(materialPath, "utf8"));
let messages = readFileSync(messagesPath, "utf8");

const problems = [];
/** en -> pt for every string that must resolve through translate(). */
const translations = new Map();

function want(pair, where) {
  if (!pair || typeof pair.en !== "string" || !pair.en.trim()) {
    problems.push(`${where}: missing English text`);
    return null;
  }
  if (typeof pair.pt !== "string" || !pair.pt.trim()) {
    problems.push(`${where}: missing Portuguese for ${JSON.stringify(pair.en)}`);
    return null;
  }
  const existing = translations.get(pair.en);
  if (existing && existing !== pair.pt) {
    problems.push(`${where}: ${JSON.stringify(pair.en)} already maps to ${JSON.stringify(existing)}`);
  }
  translations.set(pair.en, pair.pt);
  return pair.en;
}

let applied = 0;

for (const [lessonId, spec] of Object.entries(material)) {
  const lesson = lessons.find((item) => item.id === lessonId);
  if (!lesson) {
    problems.push(`no lesson ${lessonId}`);
    continue;
  }

  // title and topic already exist on the lesson; make sure their PT is on record too so a
  // promoted lesson never renders an English title to a Portuguese learner.
  if (spec.title) want({ en: lesson.title, pt: spec.title }, `${lessonId}/title`);
  if (spec.topic) want({ en: lesson.topic, pt: spec.topic }, `${lessonId}/topic`);

  if (spec.objective) {
    const en = want(spec.objective, `${lessonId}/objective`);
    if (en) lesson.objective = en;
  }
  if (spec.pronunciationFocus) {
    const en = want(spec.pronunciationFocus, `${lessonId}/pronunciationFocus`);
    if (en) lesson.pronunciationFocus = en;
  }
  if (spec.productionPrompt) {
    const en = want(spec.productionPrompt, `${lessonId}/productionPrompt`);
    if (en) lesson.productionPrompt = en;
  }
  if (spec.retryHint) {
    const en = want(spec.retryHint, `${lessonId}/retryHint`);
    if (en) lesson.retryHint = en;
  }

  if (spec.dialogue) {
    if (!Array.isArray(spec.dialogue) || spec.dialogue.length < 2) {
      problems.push(`${lessonId}/dialogue: needs at least two lines`);
    } else {
      const speakers = [...new Set(spec.dialogue.map((line) => line.speaker))];
      if (speakers.length !== 2) problems.push(`${lessonId}/dialogue: use exactly two speakers`);
      lesson.dialogue = spec.dialogue.map((line, index) => {
        if (!line.speaker?.trim()) problems.push(`${lessonId}/dialogue ${index + 1}: missing speaker`);
        if (!line.en?.trim()) problems.push(`${lessonId}/dialogue ${index + 1}: missing en`);
        if (!line.pt?.trim()) problems.push(`${lessonId}/dialogue ${index + 1}: missing pt`);
        return {
          speaker: line.speaker,
          en: line.en,
          pt: line.pt,
          clip: `/learn/audio/${lessonId}/d${String(index + 1).padStart(2, "0")}.wav`,
        };
      });
    }
  }

  if (spec.comprehension) {
    if (!Array.isArray(spec.comprehension) || spec.comprehension.length < 3) {
      problems.push(`${lessonId}/comprehension: needs at least three questions`);
    } else {
      const mainIdeas = spec.comprehension.filter((question) => question.kind === "mainIdea");
      if (mainIdeas.length !== 1) problems.push(`${lessonId}/comprehension: needs exactly one mainIdea`);
      lesson.comprehension = spec.comprehension.map((question, index) => {
        const where = `${lessonId}/comprehension ${index + 1}`;
        if (!["mainIdea", "detail", "sequence"].includes(question.kind)) {
          problems.push(`${where}: invalid kind ${JSON.stringify(question.kind)}`);
        }
        const prompt = want(question.prompt, `${where}/prompt`);
        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length < 3) problems.push(`${where}: needs at least three options`);
        const optionTexts = options.map((option, optionIndex) =>
          want(option, `${where}/option ${optionIndex + 1}`),
        );
        if (new Set(optionTexts).size !== optionTexts.length) {
          problems.push(`${where}: options repeat`);
        }
        // Authored lessons list the correct answer first; buildListeningChallenge reshuffles
        // per attempt so the ship order is never the order the learner sees.
        return {
          kind: question.kind,
          prompt,
          options: optionTexts,
          answer: optionTexts[0],
        };
      });
    }
  }

  applied += 1;
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const problem of problems) console.error("  -", problem);
  process.exit(1);
}

// --- messages.ts ------------------------------------------------------------------------
// Keys already present anywhere in the file keep their existing translation; only genuinely
// new strings are appended, in a labelled block just before the closing brace.
const existingKeys = new Set();
for (const match of messages.matchAll(/^\s*"((?:\\.|[^"\\])*)"\s*:/gm)) {
  try {
    existingKeys.add(JSON.parse(`"${match[1]}"`));
  } catch {
    /* messages.ts is TypeScript; a malformed line is its own problem, not ours. */
  }
}

const additions = [];
for (const [en, pt] of translations) {
  if (existingKeys.has(en)) continue;
  additions.push(`  ${JSON.stringify(en)}: { pt: ${JSON.stringify(pt)} },`);
}

if (additions.length) {
  const marker = "\n};\n";
  const at = messages.lastIndexOf(marker);
  if (at < 0) {
    console.error("could not find the messages object's closing brace");
    process.exit(1);
  }
  const block = `\n  /* ── Guided material for the promoted B1–C2 lessons ─── */\n${additions.join("\n")}\n`;
  messages = messages.slice(0, at) + block + messages.slice(at);
  writeFileSync(messagesPath, messages);
}

writeFileSync(lessonsPath, `${JSON.stringify(lessons, null, 2)}\n`);
console.log(`applied guided material to ${applied} lesson(s); added ${additions.length} PT-BR string(s)`);
