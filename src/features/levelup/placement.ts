/**
 * Local placement check — builds and grades a short starting-level check entirely from
 * bundled lesson content. No provider, no network, no API key.
 *
 * This is deliberately *not* {@link ./testModel} — the level-up test is a promotion gate that
 * uses an LLM to author and grade. This one answers a much smaller question at onboarding:
 * "which lesson band should this person start in?", for a learner who may never configure AI.
 *
 * Two honesty constraints shape the whole module:
 *
 * 1. The estimate is built from the objective items only (listening + cloze). The writing
 *    sample is self-assessed, and self-assessment inflates — it is recorded as evidence the
 *    learner can look back at, and it never moves the suggested level. See
 *    {@link PlacementResult.writingCountsTowardLevel}.
 * 2. Too few objective answers produce `"insufficient"`, not a confident guess. A suggested
 *    level with no evidence behind it reads exactly like one with evidence, which is worse
 *    than saying nothing.
 */

import type { EnglishLevel } from "@/features/discover/types";
import { LEVEL_RANK } from "@/features/discover/levels";
import type { Lesson } from "@/features/learn/lessonDeck";

/** Bands probed, easiest first. C1/C2 are out of scope: this places A1-B1 learners. */
export const PLACEMENT_BANDS: readonly EnglishLevel[] = ["A1", "A2", "B1", "B2"];

/** Items drawn per band. One of each kind keeps the whole check under ~5 minutes. */
const LISTENING_PER_BAND = 1;
const CLOZE_PER_BAND = 1;
const OPTION_COUNT = 3;

/** A band counts as held when the learner clears this share of its objective items. */
const BAND_PASS_RATIO = 0.5;

/** Below this many answered objective items the result is "insufficient", not a level. */
const MIN_ANSWERED = 4;

export interface PlacementListeningItem {
  kind: "listening";
  id: string;
  band: EnglishLevel;
  /** Audio the learner hears. The English text is never shown before answering. */
  clip: string;
  /** Portuguese meanings; exactly one matches the clip. */
  options: string[];
  answer: string;
}

export interface PlacementClozeItem {
  kind: "cloze";
  id: string;
  band: EnglishLevel;
  /** The sentence with one content word replaced by `___`. */
  sentence: string;
  /** Portuguese translation of the whole sentence, as the meaning cue. */
  meaning: string;
  answer: string;
}

export type PlacementItem = PlacementListeningItem | PlacementClozeItem;

export interface PlacementWritingTask {
  /** An authored production prompt, reused rather than generated. */
  prompt: string;
  band: EnglishLevel;
}

export interface PlacementCheck {
  items: PlacementItem[];
  writing: PlacementWritingTask;
}

/** How the learner rated their own writing sample. Never feeds the level estimate. */
export type PlacementSelfRating = "struggled" | "managed" | "comfortable";

export interface PlacementAnswers {
  /** Answer per item, aligned with `check.items`; null = skipped. */
  items: (string | null)[];
  writingSample: string;
  selfRating: PlacementSelfRating | null;
}

export interface PlacementBandScore {
  band: EnglishLevel;
  correct: number;
  answered: number;
  total: number;
  held: boolean;
}

export interface PlacementResult {
  /** null when the evidence is too thin to suggest anything — render the reason, not a level. */
  suggestedLevel: EnglishLevel | null;
  outcome: "suggested" | "insufficient";
  bands: PlacementBandScore[];
  correct: number;
  answered: number;
  total: number;
  /** Always false. Present so callers cannot quietly start counting the self-rating. */
  writingCountsTowardLevel: false;
  /** Recorded verbatim for the learner's own before/after comparison. */
  writingSample: string;
  selfRating: PlacementSelfRating | null;
}

/* ──────────────────────────── building ──────────────────────────── */

function stableNumber(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function placeAnswer(answer: string, distractors: string[], seed: number): string[] {
  const choices = [...new Set(distractors)].filter((value) => value !== answer).slice(0, OPTION_COUNT - 1);
  choices.splice(seed % (choices.length + 1), 0, answer);
  return choices;
}

/** Rotate a band's lessons by seed so a retake does not replay the same items. */
function pick<T>(values: T[], seed: number, count: number): T[] {
  if (values.length === 0) return [];
  return Array.from({ length: Math.min(count, values.length) }, (_, offset) => values[(seed + offset) % values.length]);
}

/**
 * The word the cloze blanks. Long content words carry the meaning; blanking "the" tests
 * nothing. Returns null when the sentence has no word worth blanking.
 */
function clozeTarget(sentence: string): string | null {
  const words = sentence.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const candidates = words.filter((word) => word.length >= 4);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

function blank(sentence: string, word: string): string {
  return sentence.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "___");
}

/**
 * Build the check from bundled lessons. `seed` varies the drawn items between runs; pass a
 * fixed value for a reproducible check (tests, or a retake the learner wants repeated).
 */
export function buildPlacementCheck(lessons: readonly Lesson[], seed: number = Date.now()): PlacementCheck {
  const items: PlacementItem[] = [];

  for (const band of PLACEMENT_BANDS) {
    const bandLessons = lessons.filter((lesson) => lesson.level === band);
    if (bandLessons.length === 0) continue;

    // Meaning distractors come from *other* bands so a wrong answer signals comprehension,
    // not a coin flip between two phrasings of the same idea.
    const otherMeanings = lessons
      .filter((lesson) => lesson.level !== band)
      .flatMap((lesson) => lesson.phrases.map((phrase) => phrase.pt));

    for (const [offset, lesson] of pick(bandLessons, seed + LEVEL_RANK[band], LISTENING_PER_BAND).entries()) {
      const phrase = lesson.phrases[(seed + offset) % lesson.phrases.length];
      const distractors = [
        ...lesson.phrases.filter((other) => other.pt !== phrase.pt).map((other) => other.pt),
        ...otherMeanings,
      ];
      items.push({
        kind: "listening",
        id: `${lesson.id}-listening-${offset}`,
        band,
        clip: phrase.clip,
        options: placeAnswer(phrase.pt, distractors, stableNumber(`${lesson.id}-${offset}-${seed}`)),
        answer: phrase.pt,
      });
    }

    for (const [offset, lesson] of pick(bandLessons, seed + LEVEL_RANK[band] + 1, CLOZE_PER_BAND).entries()) {
      const phrase = lesson.phrases.find((candidate) => clozeTarget(candidate.en) !== null);
      if (!phrase) continue;
      const target = clozeTarget(phrase.en);
      if (!target) continue;
      items.push({
        kind: "cloze",
        id: `${lesson.id}-cloze-${offset}`,
        band,
        sentence: blank(phrase.en, target),
        meaning: phrase.pt,
        answer: target,
      });
    }
  }

  // The writing task is only ever evidence, so its band is the middle of the range rather
  // than something the learner has to earn.
  const writingLessons = lessons.filter((lesson) => lesson.level === "A2" && lesson.productionPrompt);
  const writingLesson = writingLessons[seed % Math.max(1, writingLessons.length)];

  return {
    items,
    writing: {
      prompt: writingLesson?.productionPrompt ?? "Write three sentences about your week.",
      band: writingLesson?.level ?? "A2",
    },
  };
}

/* ──────────────────────────── grading ──────────────────────────── */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:'"‘’“”`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrect(item: PlacementItem, given: string | null): boolean {
  if (given === null) return false;
  return normalize(given) === normalize(item.answer);
}

export function gradePlacement(check: PlacementCheck, answers: PlacementAnswers): PlacementResult {
  const bands: PlacementBandScore[] = [];
  let correct = 0;
  let answered = 0;

  for (const band of PLACEMENT_BANDS) {
    const indexes = check.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.band === band);
    if (indexes.length === 0) continue;

    let bandCorrect = 0;
    let bandAnswered = 0;
    for (const { item, index } of indexes) {
      const given = answers.items[index] ?? null;
      if (given !== null && given !== "") bandAnswered++;
      if (isCorrect(item, given)) bandCorrect++;
    }
    correct += bandCorrect;
    answered += bandAnswered;
    bands.push({
      band,
      correct: bandCorrect,
      answered: bandAnswered,
      total: indexes.length,
      held: bandCorrect / indexes.length >= BAND_PASS_RATIO,
    });
  }

  const base = {
    bands,
    correct,
    answered,
    total: check.items.length,
    writingCountsTowardLevel: false as const,
    writingSample: answers.writingSample,
    selfRating: answers.selfRating,
  };

  if (answered < MIN_ANSWERED) {
    return { ...base, suggestedLevel: null, outcome: "insufficient" };
  }

  // The suggestion is the highest band held *without a gap below it*: clearing B1 while
  // missing A2 is noise, not evidence of a B1 learner.
  let suggested: EnglishLevel | null = null;
  for (const band of bands) {
    if (!band.held) break;
    suggested = band.band;
  }

  // Nothing held means the objective items were answered and missed — that is evidence, and
  // it points at the first band, not at "no idea".
  return { ...base, suggestedLevel: suggested ?? PLACEMENT_BANDS[0], outcome: "suggested" };
}
