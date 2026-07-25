import type { ErrorType } from "@/lib/cards/schema";

/**
 * Deterministic, on-device checks for the highest-frequency PT→EN transfer errors, so the
 * provider-free path corrects real grammar instead of only spelling and punctuation.
 *
 * Why this exists: without a configured provider the lesson loop used to correct casing,
 * terminal punctuation and the spelling of the lesson phrase — and nothing else. A learner
 * writing "I am student" or "I have 30 years" was told their sentence was clear, and the
 * uncorrected sentence was then saved as a review card. Spaced repetition of an error is
 * spaced acquisition of an error, so the zero-setup path has to catch at least the errors
 * that are predictable from Portuguese.
 *
 * Design rules for anything added here:
 *   1. Precision over recall. A false positive blocks the learner's correct sentence and
 *      teaches them something untrue; a miss just leaves the sentence as it was. Every
 *      pattern must be one where the English is wrong essentially every time it matches.
 *   2. No model, no network, no lexicon. Closed word lists only, so the check is instant and
 *      identical for every learner.
 *   3. A rule without `fix` flags the error without rewriting it. That is the right choice
 *      when the correct sentence needs restructuring rather than substitution — the retry
 *      step asks the learner to rewrite, which is where restructuring belongs.
 *   4. `note` is an English source string, rendered through `t()`. Add a pt entry in
 *      `messages.ts` for every one.
 *
 * These are transfer errors, not a grammar checker. They do not make the provider-free path
 * equivalent to a model; they make its claim ("your mistakes become drills") true for the
 * errors a Brazilian A2-B1 learner actually makes most.
 */

export interface TransferRule {
  id: string;
  type: ErrorType;
  /** Learner-facing note, English source string. Render through `t()`. */
  note: string;
  pattern: RegExp;
  /** Rewrites the match. Omit to flag the error without rewriting the sentence. */
  fix?: (match: RegExpMatchArray) => string;
}

export interface TransferRuleHit {
  id: string;
  type: ErrorType;
  note: string;
  /** False when the rule only flags the error and leaves the wording to the retry. */
  rewritten: boolean;
}

/** Mirror the source's capitalization so a fix at the start of a sentence stays capitalized. */
function likeCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  const first = source[0];
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const BE_FOR_SUBJECT: Record<string, string> = {
  i: "am",
  you: "are",
  he: "is",
  she: "is",
  it: "is",
  we: "are",
  they: "are",
};

const PARTICIPLE: Record<string, string> = {
  live: "lived",
  work: "worked",
  study: "studied",
  know: "known",
  have: "had",
  wait: "waited",
  play: "played",
};

const COMPARATIVE: Record<string, string> = {
  good: "better",
  bad: "worse",
  easy: "easier",
  big: "bigger",
  small: "smaller",
  cheap: "cheaper",
  fast: "faster",
  old: "older",
  young: "younger",
};

const UNCOUNTABLE_SINGULAR: Record<string, string> = {
  informations: "information",
  advices: "advice",
  feedbacks: "feedback",
  knowledges: "knowledge",
  softwares: "software",
  homeworks: "homework",
  equipments: "equipment",
};

const PROFESSIONS_WITH_AN = new Set([
  "engineer",
  "architect",
  "accountant",
  "electrician",
  "author",
  "artist",
]);

export const AGE_NOTE = "Age uses “to be” in English: I am 30 years old, not I have 30 years.";
export const ARTICLE_NOTE = "A singular job or role needs “a” or “an”: I am a student.";
export const DEPEND_ON_NOTE = "“Depend” takes “on”, not “of”.";
export const ARRIVE_AT_NOTE = "“Arrive” takes “at” or “in”, never “to”.";
export const PEOPLE_PLURAL_NOTE = "“People” is plural in English: people are, people have.";
export const MARRIED_TO_NOTE = "“Married” takes “to”, not “with”.";
export const EXPLAIN_TO_NOTE = "“Explain” needs “to” before the person: explain it to me.";
export const TELL_NOTE = "Use “tell someone”, not “say someone”.";
export const AGREE_NOTE = "“Agree” is the verb by itself: I agree, not I am agree.";
export const WEEKDAY_ON_NOTE = "Days of the week take “on”: on Monday.";
export const GOOD_AT_NOTE = "Use “good at” for skills, not “good in”.";
export const LISTEN_TO_NOTE = "“Listen” needs “to” before what you hear.";
export const ASK_QUESTION_NOTE = "In English you “ask” a question, you do not “make” one.";
export const UNCOUNTABLE_NOTE = "This word has no plural in English.";
export const COMPARATIVE_NOTE = "Short adjectives form the comparative with “-er”, not “more”.";
export const SINCE_PERFECT_NOTE =
  "With “since”, English uses the present perfect: I have lived here since 2020.";
export const EXISTENTIAL_NOTE = "Use “there is” / “there are” to say that something exists.";
export const PURPOSE_TO_NOTE = "Use “to” + verb for purpose: I came to study.";

/**
 * Ordered so that a rule which rewrites a word never hides a later rule's match. Kept as a
 * plain exported table so the precision test can enumerate it.
 */
export const TRANSFER_RULES: TransferRule[] = [
  {
    id: "age-with-have",
    type: "vocabulary",
    note: AGE_NOTE,
    pattern: /\b(I|you|he|she|we|they)\s+(have|has)\s+(\d{1,3})\s+years?(?:\s+old)?\b/gi,
    fix: (match) => {
      const [, subject, , age] = match;
      const be = BE_FOR_SUBJECT[subject.toLowerCase()] ?? "am";
      return `${subject} ${be} ${age} years old`;
    },
  },
  {
    id: "missing-article-role",
    type: "article",
    note: ARTICLE_NOTE,
    pattern:
      /\b(am|is|are|'m|'s)\s+(student|teacher|engineer|doctor|nurse|lawyer|programmer|developer|designer|manager|dentist|architect|journalist|accountant|electrician|author|artist)\b/gi,
    fix: (match) => {
      const [, be, role] = match;
      const article = PROFESSIONS_WITH_AN.has(role.toLowerCase()) ? "an" : "a";
      return `${be} ${article} ${role}`;
    },
  },
  {
    id: "depend-of",
    type: "preposition",
    note: DEPEND_ON_NOTE,
    pattern: /\bdepend(s|ed|ing)?\s+of\b/gi,
    fix: (match) => likeCase(match[0], `depend${match[1]} on`),
  },
  {
    id: "arrive-to",
    type: "preposition",
    note: ARRIVE_AT_NOTE,
    pattern: /\barrive(s|d)?\s+to\b/gi,
    fix: (match) => likeCase(match[0], `arrive${match[1]} at`),
  },
  {
    id: "people-singular",
    type: "other",
    note: PEOPLE_PLURAL_NOTE,
    pattern: /\bpeople\s+(is|was|has)\b/gi,
    fix: (match) => {
      const verb = { is: "are", was: "were", has: "have" }[match[1].toLowerCase()] ?? "are";
      return likeCase(match[0], `people ${verb}`);
    },
  },
  {
    id: "married-with",
    type: "collocation",
    note: MARRIED_TO_NOTE,
    pattern: /\bmarried\s+with\b/gi,
    fix: (match) => likeCase(match[0], "married to"),
  },
  {
    id: "explain-without-to",
    type: "preposition",
    note: EXPLAIN_TO_NOTE,
    pattern: /\bexplain\s+(me|him|her|us|them)\b/gi,
    fix: (match) => `${likeCase(match[0], "explain")} to ${match[1]}`,
  },
  {
    id: "say-someone",
    type: "collocation",
    note: TELL_NOTE,
    pattern: /\bsay\s+(me|him|her|us|them)\b/gi,
    fix: (match) => `${likeCase(match[0], "tell")} ${match[1]}`,
  },
  {
    id: "be-agree",
    type: "collocation",
    note: AGREE_NOTE,
    pattern: /\b(I\s+am|I'm)\s+agree\b/gi,
    fix: () => "I agree",
  },
  {
    id: "in-weekday",
    type: "preposition",
    note: WEEKDAY_ON_NOTE,
    pattern: /\bin\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(s?)\b/gi,
    fix: (match) => {
      const day = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
      return `${likeCase(match[0], "on")} ${day}${match[2]}`;
    },
  },
  {
    id: "good-in",
    type: "preposition",
    note: GOOD_AT_NOTE,
    pattern: /\bgood\s+in\s+(english|portuguese|spanish|math|maths|sports|school|programming)\b/gi,
    fix: (match) => `${likeCase(match[0], "good")} at ${match[1]}`,
  },
  {
    id: "listen-without-to",
    type: "preposition",
    note: LISTEN_TO_NOTE,
    pattern: /\blisten\s+(music|songs|podcasts|me|him|her|us|them)\b/gi,
    fix: (match) => `${likeCase(match[0], "listen")} to ${match[1]}`,
  },
  {
    id: "make-a-question",
    type: "collocation",
    note: ASK_QUESTION_NOTE,
    pattern: /\bmake\s+(a\s+|the\s+|some\s+)?(question|questions)\b/gi,
    fix: (match) => `${likeCase(match[0], "ask")} ${match[1] ?? ""}${match[2]}`,
  },
  {
    id: "uncountable-plural",
    type: "vocabulary",
    note: UNCOUNTABLE_NOTE,
    pattern:
      /\b(informations|advices|feedbacks|knowledges|softwares|homeworks|equipments)\b/gi,
    fix: (match) => likeCase(match[0], UNCOUNTABLE_SINGULAR[match[0].toLowerCase()]),
  },
  {
    id: "more-plus-short-adjective",
    type: "other",
    note: COMPARATIVE_NOTE,
    pattern: /\bmore\s+(good|bad|easy|big|small|cheap|fast|old|young)\b/gi,
    fix: (match) => likeCase(match[0], COMPARATIVE[match[1].toLowerCase()]),
  },
  {
    id: "present-with-since",
    type: "tense",
    note: SINCE_PERFECT_NOTE,
    pattern:
      /\b(I|you|we|they|he|she)\s+(live|lives|work|works|study|studies|know|knows|wait|waits|play|plays)\s+([^.?!]*?\bsince\b)/gi,
    fix: (match) => {
      const [, subject, verb, rest] = match;
      const auxiliary = /^(he|she)$/i.test(subject) ? "has" : "have";
      const stem = verb.toLowerCase().replace(/(ie)?s$/, (suffix) => (suffix === "ies" ? "y" : ""));
      return `${subject} ${auxiliary} ${PARTICIPLE[stem] ?? stem} ${rest}`;
    },
  },
  {
    id: "have-with-since",
    type: "tense",
    note: SINCE_PERFECT_NOTE,
    // The lookahead keeps an already-correct perfect ("I have lived here since 2020") from
    // being wrapped a second time; only a plain present "have" is rewritten.
    pattern:
      /\b(I|you|we|they|he|she)\s+(have|has)\s+(?!been\b|had\b|known\b|\w+ed\b)([^.?!]*?\bsince\b)/gi,
    fix: (match) => {
      const [, subject, , rest] = match;
      const auxiliary = /^(he|she)$/i.test(subject) ? "has" : "have";
      return `${subject} ${auxiliary} had ${rest}`;
    },
  },
  {
    id: "be-with-since",
    type: "tense",
    note: SINCE_PERFECT_NOTE,
    pattern: /\b(I\s+am|I'm|you\s+are|we\s+are|they\s+are|he\s+is|she\s+is)\s+([^.?!]*?\bsince\b)/gi,
    fix: (match) => {
      const [, subject, rest] = match;
      const auxiliary = /\b(is)$/i.test(subject) ? "has" : "have";
      const pronoun = subject.replace(/\s*('m|am|are|is)$/i, "").trim() || "I";
      return `${pronoun} ${auxiliary} been ${rest}`;
    },
  },
  {
    id: "purpose-for-verb",
    type: "preposition",
    note: PURPOSE_TO_NOTE,
    // Only words that are verbs and nothing else. "for study", "for practice" and "for work"
    // are all legal noun phrases in English, so they belong to the narrower rule below.
    pattern: /\bfor\s+(learn|improve|speak|understand|eat|buy|meet|become)\b/gi,
    fix: (match) => `${likeCase(match[0], "to")} ${match[1]}`,
  },
  {
    id: "purpose-for-noun-verb",
    type: "preposition",
    note: PURPOSE_TO_NOTE,
    // Gated on a motion verb so the legal noun reading ("materials for study", "I travel for
    // work") cannot match: after "came here", only the purpose reading is possible.
    pattern:
      /\b(came|come|comes|went|go|goes|going|arrived)\s+((?:here|there)\s+)?for\s+(study|practice|travel|work|shop)\b/gi,
    fix: (match) => `${match[1]} ${match[2]}to ${match[3]}`,
  },
  {
    // Flag only: "In my city has many parks" needs restructuring into "There are many parks in
    // my city", which is the retry's job, not a substitution's.
    id: "existential-have",
    type: "other",
    note: EXISTENTIAL_NOTE,
    pattern:
      /\bin\s+(?:my|the|this|that|our)\s+(?:[a-z]+\s+){0,2}(?:has|have)\s+(?:a\s+lot\s+of|many|much|some|\d+)\b/gi,
  },
];

export interface TransferCheckResult {
  corrected: string;
  hits: TransferRuleHit[];
}

/**
 * Apply every transfer rule to a sentence. Rules that carry a `fix` rewrite their match;
 * rules without one report the error and leave the text untouched.
 */
export function applyTransferRules(sentence: string): TransferCheckResult {
  let corrected = sentence;
  const hits: TransferRuleHit[] = [];

  for (const rule of TRANSFER_RULES) {
    // Fresh lastIndex per call: the table is module-level and the regexes are global.
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (!pattern.test(corrected)) continue;
    pattern.lastIndex = 0;

    if (rule.fix) {
      corrected = corrected.replace(pattern, (...args) => {
        const groups = args.slice(0, -2).map((value) => (value === undefined ? "" : String(value)));
        return rule.fix!(groups as unknown as RegExpMatchArray);
      });
    }
    hits.push({ id: rule.id, type: rule.type, note: rule.note, rewritten: Boolean(rule.fix) });
  }

  return { corrected, hits };
}
