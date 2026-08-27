#!/usr/bin/env node
/**
 * Merge authored pattern blocks into lessons.json.
 *
 * Every frame is checked against its own examples before it is written. A frame that does
 * not match the sentences it claims to describe would silently disable the variation drill
 * and mis-score transfer, so a mismatch fails the run rather than shipping.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const lessonsPath = resolve(here, "../../src/features/learn/lessons.json");
const lessons = JSON.parse(readFileSync(lessonsPath, "utf8"));

const tokenize = (value) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9']+/g, " ").trim().split(/\s+/).filter(Boolean);

function frameRegex(frame) {
  const parts = frame.split(/_{3,}/).map(tokenize);
  const source = parts
    .map((part) => part.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"))
    .join("\\s+\\S[\\s\\S]*?\\s*");
  return new RegExp(`(?:^|\\s)${source}(?:\\s|$)`);
}

const problems = [];
let applied = 0;

for (const file of ["patterns-a2.json", "patterns-b1.json"]) {
  const table = JSON.parse(readFileSync(resolve(here, file), "utf8"));
  for (const [lessonId, phrases] of Object.entries(table)) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) { problems.push(`${file}: no lesson ${lessonId}`); continue; }
    for (const [en, spec] of Object.entries(phrases)) {
      const phrase = lesson.phrases.find((item) => item.en === en);
      if (!phrase) { problems.push(`${lessonId}: no phrase ${JSON.stringify(en)}`); continue; }
      const [id, frame, slot, examples, contrast, accept] = spec;

      if (!/_{3,}/.test(frame)) problems.push(`${lessonId}/${id}: frame has no slot`);
      if (examples.length < 2) problems.push(`${lessonId}/${id}: needs 2+ examples`);
      const matcher = frameRegex(frame);
      for (const example of examples) {
        if (!matcher.test(` ${tokenize(example).join(" ")} `)) {
          problems.push(`${lessonId}/${id}: frame ${JSON.stringify(frame)} does not match example ${JSON.stringify(example)}`);
        }
      }
      // The lesson's own sentence must be one of the family's examples, or the drill would
      // teach a structure the learner was never shown in context.
      if (!examples.includes(en)) problems.push(`${lessonId}/${id}: examples must include the lesson phrase`);
      // A contrast is learner-facing discrimination material, not something the frame has
      // to reject: most minimal pairs are wrong *inside* the slot ("Can I have to the
      // menu?"), which the frame legitimately accepts and `transferErrors.ts` catches. What
      // it must not be is one of the examples, or the pair has nothing to discriminate.
      if (contrast && examples.includes(contrast)) {
        problems.push(`${lessonId}/${id}: contrast is also listed as a correct example`);
      }
      // A suffix slot tokenizes as its own word and can never match. Catch it at authoring
      // time rather than shipping a frame that silently matches nothing.
      if (/_{3,}[a-z]/i.test(frame)) {
        problems.push(`${lessonId}/${id}: frame ${JSON.stringify(frame)} glues the slot to a suffix`);
      }

      phrase.pattern = { id, frame, slot, examples, ...(contrast ? { contrast } : {}) };
      if (accept?.length) phrase.accept = accept;
      applied += 1;
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} pattern problem(s):`);
  for (const problem of problems) console.error("  -", problem);
  process.exit(1);
}

writeFileSync(lessonsPath, `${JSON.stringify(lessons, null, 2)}\n`);
console.log(`applied ${applied} patterns to ${lessonsPath}`);
