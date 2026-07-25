import { describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import { LESSONS } from "./lessonDeck";
import { TRANSFER_RULES, applyTransferRules } from "./transferErrors";

/** Every rule's canonical error, and the English it must become. */
const CORRECTIONS: [string, string][] = [
  ["I have 30 years.", "I am 30 years old."],
  ["He has 12 years old.", "He is 12 years old."],
  ["I am student.", "I am a student."],
  ["I'm engineer.", "I'm an engineer."],
  ["It depends of the weather.", "It depends on the weather."],
  ["We arrive to the office at eight.", "We arrive at the office at eight."],
  ["The people is very friendly.", "The people are very friendly."],
  ["She is married with a doctor.", "She is married to a doctor."],
  ["Can you explain me the rule?", "Can you explain to me the rule?"],
  ["Please say me the answer.", "Please tell me the answer."],
  ["I am agree with you.", "I agree with you."],
  ["The meeting is in Monday.", "The meeting is on Monday."],
  ["She is good in English.", "She is good at English."],
  ["I listen music every day.", "I listen to music every day."],
  ["I want to make a question.", "I want to ask a question."],
  ["I need more informations.", "I need more information."],
  ["This exercise is more easy.", "This exercise is easier."],
  ["I live here since 2020.", "I have lived here since 2020."],
  ["I am here since Monday.", "I have been here since Monday."],
  ["I study every day for learn faster.", "I study every day to learn faster."],
  ["I came here for study.", "I came here to study."],
];

/**
 * Correct English that must pass untouched. False positives are the failure mode that
 * matters: a wrongly "corrected" sentence teaches the learner something untrue and is then
 * scheduled for review.
 */
const MUST_NOT_FIRE = [
  "I am 30 years old.",
  "I am a student and I work at night.",
  "They are students.",
  "It depends on the weather.",
  "We arrive at the office at eight.",
  "The people are very friendly.",
  "She is married to a doctor.",
  "Can you explain the rule to me?",
  "Please tell me the answer.",
  "I agree with you.",
  "The meeting is on Monday.",
  "She is good at English.",
  "I listen to music every day.",
  "I want to ask a question.",
  "I need more information.",
  "This exercise is easier.",
  "I have lived here since 2020.",
  "I have been here since Monday.",
  "I came here to study.",
  // Legal noun readings the narrow rules must leave alone.
  "I travel for work every month.",
  "These are materials for study.",
  "This room is for practice.",
  "I have no doubt about it.",
  "There are many parks in my city.",
  "He is more careful than me.",
  "I have two years of experience.",
];

describe("transferErrors", () => {
  it("rewrites each canonical PT→EN transfer error", () => {
    for (const [wrong, right] of CORRECTIONS) {
      const result = applyTransferRules(wrong);
      expect(result.corrected, wrong).toBe(right);
      expect(result.hits.length, wrong).toBeGreaterThan(0);
    }
  });

  it("leaves correct English untouched and reports nothing", () => {
    for (const sentence of MUST_NOT_FIRE) {
      const result = applyTransferRules(sentence);
      expect(result.corrected, sentence).toBe(sentence);
      expect(result.hits.map((hit) => hit.id), sentence).toEqual([]);
    }
  });

  it("never fires on a bundled lesson phrase", () => {
    // The 292 shipped phrases are correct English. Any hit here is a false positive that
    // would fire on the learner's own reuse of the phrase.
    for (const lesson of LESSONS) {
      for (const phrase of lesson.phrases) {
        const result = applyTransferRules(phrase.en);
        expect(result.hits.map((hit) => hit.id), `${lesson.id}: ${phrase.en}`).toEqual([]);
        expect(result.corrected).toBe(phrase.en);
      }
    }
  });

  it("flags the existential 'tem' pattern without rewriting it", () => {
    const result = applyTransferRules("In my city has many parks.");

    // Fixing this needs restructuring, which is the retry's job, not a substitution's.
    expect(result.corrected).toBe("In my city has many parks.");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ id: "existential-have", rewritten: false });
  });

  it("reports several errors in one sentence", () => {
    const result = applyTransferRules("I am student and I have 25 years.");

    expect(result.corrected).toBe("I am a student and I am 25 years old.");
    expect(result.hits.map((hit) => hit.id).sort()).toEqual(["age-with-have", "missing-article-role"]);
  });

  it("keeps the rule table self-consistent", () => {
    const ids = TRANSFER_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of TRANSFER_RULES) {
      // Global flag required: `applyTransferRules` relies on replace-all semantics.
      expect(rule.pattern.flags, rule.id).toContain("g");
      expect(rule.note.trim().length, rule.id).toBeGreaterThan(0);
    }
  });

  it("has a Portuguese translation for every note", () => {
    // The learners these rules exist for read the UI in Portuguese; an untranslated note
    // would explain a Portuguese-transfer error in English.
    for (const rule of TRANSFER_RULES) {
      expect(messages[rule.note]?.pt, `${rule.id}: ${rule.note}`).toBeTruthy();
    }
  });

  it("is idempotent — running twice changes nothing more", () => {
    for (const [wrong] of CORRECTIONS) {
      const once = applyTransferRules(wrong).corrected;
      expect(applyTransferRules(once).corrected, wrong).toBe(once);
    }
  });
});
