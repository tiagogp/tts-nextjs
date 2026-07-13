/**
 * Level-up test prompts. Both prompts anchor on the per-band CEFR descriptors
 * (`CEFR_LANGUAGE_PROFILE` / `cefrLanguageLine`) — a bare "pitch at B1" instruction
 * makes models collapse bands together, and the whole point of the test is that the
 * *target* band genuinely reads harder than the current one.
 */

import type { EnglishLevel } from "@/features/discover/types";
import { CEFR_LANGUAGE_PROFILE, cefrLanguageLine, isMonolingualLevel } from "@/lib/cards/shared";
import { COMPREHENSION_QUESTIONS, FILL_IN_QUESTIONS } from "./testModel";

export function buildLevelTestPrompt(opts: {
  currentLevel: EnglishLevel;
  targetLevel: EnglishLevel;
  targetLang: string;
  nativeLang: string;
  /** Weak concepts/error-types to bias one or two items toward, if any. */
  focusGaps?: string[];
}): string {
  const focus = (opts.focusGaps ?? []).slice(0, 3);
  return `You are a CEFR examiner authoring a short level-up test in ${opts.targetLang}. The learner is currently at ${opts.currentLevel} and wants to prove they are ready for ${opts.targetLevel}.

Author EVERY part of the test at the ${opts.targetLevel} band:
- ${cefrLanguageLine(opts.targetLevel)}
- For contrast, this is the learner's CURRENT band, which the test must be clearly beyond: ${CEFR_LANGUAGE_PROFILE[opts.currentLevel]}
${focus.length > 0 ? `- The learner has struggled with: ${focus.join(", ")}. Aim 1-2 items at these without making the whole test about them.\n` : ""}
The test has three sections:
1. comprehension — a passage of 80-150 words at the ${opts.targetLevel} band, followed by exactly ${COMPREHENSION_QUESTIONS} multiple-choice questions. Each question has exactly 4 options and one correct answer. Questions must test understanding of the passage, not general knowledge.
2. fillIn — exactly ${FILL_IN_QUESTIONS} independent sentences at the ${opts.targetLevel} band, each with exactly one blank written as ___ . For each, list every answer you would accept (word or short phrase). Target grammar and vocabulary that distinguishes ${opts.targetLevel} from ${opts.currentLevel}.
3. writing — one free-writing prompt that invites 3-6 sentences and can only be answered well with ${opts.targetLevel}-band language.

Return ONLY valid JSON matching this exact shape:
{
  "comprehension": {
    "passage": "string",
    "questions": [
      { "prompt": "string", "options": ["string", "string", "string", "string"], "answerIndex": 0 }
    ]
  },
  "fillIn": [
    { "sentence": "She ___ to work every day.", "acceptedAnswers": ["goes", "walks"] }
  ],
  "writing": { "prompt": "string" }
}`;
}

export function buildWritingGradePrompt(opts: {
  targetLevel: EnglishLevel;
  targetLang: string;
  nativeLang: string;
  writingPrompt: string;
  text: string;
}): string {
  const rationaleLang = isMonolingualLevel(opts.targetLevel) ? opts.targetLang : opts.nativeLang;
  return `You are a CEFR examiner grading a short writing sample in ${opts.targetLang} against the ${opts.targetLevel} band.

The ${opts.targetLevel} band means: ${CEFR_LANGUAGE_PROFILE[opts.targetLevel]}

The task was: "${opts.writingPrompt}"

The learner wrote:
"""
${opts.text}
"""

Grade honestly against the band descriptor — range, accuracy, and complexity all count. Do not reward length alone, and do not punish minor slips a ${opts.targetLevel} writer would also make.

Return ONLY valid JSON matching this exact shape:
{
  "score": 0-100 (how well this performs AT the ${opts.targetLevel} band; 60+ means a solid ${opts.targetLevel} performance),
  "bandFit": "below" | "at" | "above" (where this sample sits relative to ${opts.targetLevel}),
  "feedback": "2-3 sentences for the learner, in ${rationaleLang}: what already works at ${opts.targetLevel}, and the single most important thing to improve",
  "errors": [
    {
      "original": "the learner's exact wording",
      "corrected": "how a native would write it",
      "errorTypes": ["one or more of: collocation, preposition, tense, article, word-order, idiom, vocabulary, register, other"],
      "rationale": "one short sentence in ${rationaleLang} explaining why"
    }
  ]
}
List every real mistake in "errors" (empty array if the text is clean). Quote "original" exactly from the learner's text.`;
}
