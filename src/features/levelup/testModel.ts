/**
 * Level-up test — pure types, validators, and grading. The LLM authors the test
 * *with its own answer key* (`answerIndex` / `acceptedAnswers`), so comprehension and
 * fill-in grade locally and deterministically; only the free-writing sample needs a
 * second LLM call. Kept out of React/IndexedDB (mirrors `analytics.ts` / `band.ts`).
 */

import type { EnglishLevel } from "@/features/discover/types";

export const COMPREHENSION_QUESTIONS = 3;
export const FILL_IN_QUESTIONS = 5;

/** Section pass bars + weights. Overall must also clear {@link PASS_OVERALL}. */
const PASS_COMPREHENSION = 2;
const PASS_FILL_IN = 3;
const PASS_WRITING_SCORE = 60;
const PASS_OVERALL = 70;
const W_COMPREHENSION = 0.3;
const W_FILL_IN = 0.3;
const W_WRITING = 0.4;

/** A failed attempt locks the test for this long — readiness work fills the gap. */
export const RETAKE_COOLDOWN_DAYS = 3;
const DAY_MS = 86_400_000;

export interface ComprehensionQuestion {
  prompt: string;
  options: string[];
  answerIndex: number;
}

export interface FillInQuestion {
  /** The sentence with the blank marked as `___`. */
  sentence: string;
  /** All answers the author accepts, compared normalized. */
  acceptedAnswers: string[];
}

/** The LLM-authored test content (id/level are stamped on by the caller). */
export interface LevelTestContent {
  comprehension: { passage: string; questions: ComprehensionQuestion[] };
  fillIn: FillInQuestion[];
  writing: { prompt: string };
}

export interface LevelTest extends LevelTestContent {
  id: string;
  targetLevel: EnglishLevel;
}

export interface LevelTestAnswers {
  /** Selected option index per comprehension question; null = unanswered. */
  comprehension: (number | null)[];
  /** Typed answer per fill-in sentence. */
  fillIn: string[];
}

export type WritingBandFit = "below" | "at" | "above";

/** What the grading LLM returns about the writing sample (errors are converted to ErrorEvents by the route). */
export interface WritingGradeSummary {
  score: number;
  bandFit: WritingBandFit;
  feedback: string;
}

export interface AttemptEvaluation {
  passed: boolean;
  /** Weighted 0..100 across the three sections. */
  overall: number;
  comprehension: { correct: number; total: number; passed: boolean };
  fillIn: { correct: number; total: number; passed: boolean };
  writing: WritingGradeSummary & { passed: boolean };
}

/** One persisted test attempt (IndexedDB `levelTests` store). */
export interface StoredLevelTestAttempt {
  id: string;
  fromLevel: EnglishLevel;
  targetLevel: EnglishLevel;
  createdAt: number;
  test: LevelTest;
  answers: LevelTestAnswers;
  writingSample: string;
  evaluation: AttemptEvaluation;
  passed: boolean;
}

/* ──────────────────────────── validators ──────────────────────────── */

function nonEmptyStr(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, maxLen) : null;
}

function validateQuestion(raw: unknown): ComprehensionQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const prompt = nonEmptyStr(q.prompt, 300);
  if (!prompt || !Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((o) => nonEmptyStr(o, 200));
  if (options.some((o) => o === null)) return null;
  const answerIndex = q.answerIndex;
  if (typeof answerIndex !== "number" || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return null;
  }
  return { prompt, options: options as string[], answerIndex };
}

function validateFillIn(raw: unknown): FillInQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const sentence = nonEmptyStr(q.sentence, 300);
  if (!sentence || !sentence.includes("___") || !Array.isArray(q.acceptedAnswers)) return null;
  const accepted = q.acceptedAnswers
    .map((a) => nonEmptyStr(a, 80))
    .filter((a): a is string => a !== null);
  if (accepted.length === 0) return null;
  return { sentence, acceptedAnswers: accepted };
}

/** Structural check over the generation LLM's JSON; null on any malformation. */
export function validateLevelTest(raw: unknown): LevelTestContent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const comprehension = obj.comprehension as Record<string, unknown> | undefined;
  const passage = nonEmptyStr(comprehension?.passage, 2000);
  if (!passage || !Array.isArray(comprehension?.questions)) return null;
  const questions = comprehension.questions.map(validateQuestion);
  if (questions.length !== COMPREHENSION_QUESTIONS || questions.some((q) => q === null)) return null;

  if (!Array.isArray(obj.fillIn)) return null;
  const fillIn = obj.fillIn.map(validateFillIn);
  if (fillIn.length !== FILL_IN_QUESTIONS || fillIn.some((q) => q === null)) return null;

  const writing = obj.writing as Record<string, unknown> | undefined;
  const writingPrompt = nonEmptyStr(writing?.prompt, 500);
  if (!writingPrompt) return null;

  return {
    comprehension: { passage, questions: questions as ComprehensionQuestion[] },
    fillIn: fillIn as FillInQuestion[],
    writing: { prompt: writingPrompt },
  };
}

/** Structural check over the grading LLM's JSON summary (errors are validated separately). */
export function validateWritingGrade(raw: unknown): WritingGradeSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.score !== "number" || !Number.isFinite(obj.score)) return null;
  const bandFit = obj.bandFit;
  if (bandFit !== "below" && bandFit !== "at" && bandFit !== "above") return null;
  const feedback = nonEmptyStr(obj.feedback, 1000);
  if (!feedback) return null;
  return { score: Math.max(0, Math.min(100, Math.round(obj.score))), bandFit, feedback };
}

/* ──────────────────────────── grading ──────────────────────────── */

/** Case-, punctuation-, and whitespace-insensitive comparison for fill-in answers. */
function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:'"‘’“”`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeObjectiveSections(
  test: LevelTestContent,
  answers: LevelTestAnswers,
): { comprehensionCorrect: number; fillInCorrect: number } {
  let comprehensionCorrect = 0;
  test.comprehension.questions.forEach((q, i) => {
    if (answers.comprehension[i] === q.answerIndex) comprehensionCorrect++;
  });
  let fillInCorrect = 0;
  test.fillIn.forEach((q, i) => {
    const given = normalizeAnswer(answers.fillIn[i] ?? "");
    if (given && q.acceptedAnswers.some((a) => normalizeAnswer(a) === given)) fillInCorrect++;
  });
  return { comprehensionCorrect, fillInCorrect };
}

export function evaluateAttempt(
  test: LevelTestContent,
  answers: LevelTestAnswers,
  writing: WritingGradeSummary,
): AttemptEvaluation {
  const { comprehensionCorrect, fillInCorrect } = gradeObjectiveSections(test, answers);
  const comprehensionTotal = test.comprehension.questions.length;
  const fillInTotal = test.fillIn.length;

  const comprehensionPassed = comprehensionCorrect >= PASS_COMPREHENSION;
  const fillInPassed = fillInCorrect >= PASS_FILL_IN;
  const writingPassed = writing.score >= PASS_WRITING_SCORE && writing.bandFit !== "below";

  const overall = Math.round(
    (comprehensionCorrect / comprehensionTotal) * W_COMPREHENSION * 100 +
      (fillInCorrect / fillInTotal) * W_FILL_IN * 100 +
      writing.score * W_WRITING,
  );

  return {
    passed: comprehensionPassed && fillInPassed && writingPassed && overall >= PASS_OVERALL,
    overall,
    comprehension: { correct: comprehensionCorrect, total: comprehensionTotal, passed: comprehensionPassed },
    fillIn: { correct: fillInCorrect, total: fillInTotal, passed: fillInPassed },
    writing: { ...writing, passed: writingPassed },
  };
}

/**
 * Epoch ms when the test may be retaken, given the newest attempt *for the current
 * transition*. 0 = available now (no attempt, a pass, or an expired cooldown).
 */
export function retakeAvailableAt(
  attempts: StoredLevelTestAttempt[],
  fromLevel: EnglishLevel,
  now: number = Date.now(),
): number {
  const newest = attempts
    .filter((attempt) => attempt.fromLevel === fromLevel)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!newest || newest.passed) return 0;
  const at = newest.createdAt + RETAKE_COOLDOWN_DAYS * DAY_MS;
  return at > now ? at : 0;
}
