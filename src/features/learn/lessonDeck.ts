import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import type { EnglishLevel } from "@/features/discover/types";
import { LEVEL_RANK } from "@/features/discover/levels";
import type { LearningProfile } from "@/features/settings/learningProfile";
import lessonsData from "./lessons.json";

export interface LessonPhrase {
  /** Stable content identifier. Required for roadmap lessons, optional for the original 36. */
  id?: string;
  en: string;
  pt: string;
  concept: string;
  note: string;
  clip: string;
}

export interface LessonDialogueLine {
  speaker: string;
  en: string;
  pt: string;
  clip: string;
}

export type LessonComprehensionKind = "mainIdea" | "detail" | "sequence";

export interface LessonComprehensionQuestion {
  kind: LessonComprehensionKind;
  prompt: string;
  options: string[];
  answer: string;
}

/**
 * Optional on the original curriculum so it can be migrated incrementally.
 * The content validator makes these fields mandatory for every roadmap lesson.
 */
export interface LessonMaterial {
  objective?: string;
  pronunciationFocus?: string;
  dialogue?: LessonDialogueLine[];
  comprehension?: LessonComprehensionQuestion[];
  productionPrompt?: string;
  retryHint?: string;
}

export interface Lesson extends LessonMaterial {
  id: string;
  level: EnglishLevel;
  title: string;
  topic: string;
  phrases: LessonPhrase[];
}

export const LESSONS = lessonsData as Lesson[];

export function buildDeckFromPhrases(
  sourceId: string,
  phrases: LessonPhrase[],
  keptIndexes: Iterable<number>,
): { candidates: PhraseCandidate[]; cards: Card[] } {
  const now = Date.now();
  const sorted = [...keptIndexes]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < phrases.length)
    .sort((a, b) => a - b);

  const candidates: PhraseCandidate[] = sorted.map((i) => {
    const phrase = phrases[i];
    const phraseId = phrase.id ?? String(i);
    return {
      id: `${sourceId}-${phraseId}`,
      sourceId,
      text: phrase.en,
      translation: phrase.pt,
      note: phrase.note,
      status: "accepted",
      segmentIndex: i,
      audioClipPath: phrase.clip,
      createdAt: now,
    };
  });

  const cards: Card[] = sorted.map((i) => {
    const phrase = phrases[i];
    const phraseId = phrase.id ?? String(i);
    return {
      id: `${sourceId}-card-${phraseId}`,
      front: phrase.en,
      back: phrase.pt,
      concept: phrase.concept,
      source: { kind: "phrase", id: `${sourceId}-${phraseId}` },
      audioClipPath: phrase.clip,
      createdAt: now,
    };
  });

  return { candidates, cards };
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

/**
 * Card-id prefix for the learner's own sentence saved at the end of the lesson
 * loop (MistakeStep), on both the mistake and the no-mistake path. Its presence
 * marks the guided loop as completed, independent of whether an ErrorEvent exists.
 */
export const OWN_SENTENCE_CARD_PREFIX = "own-sentence-";

export function lessonCardIds(lesson: Lesson): string[] {
  return lesson.phrases.map((phrase, i) => `lesson-${lesson.id}-card-${phrase.id ?? i}`);
}

export function completedLessonIdsFromCardIds(cardIds: Iterable<string>): Set<string> {
  const completed = new Set<string>();
  for (const cardId of cardIds) {
    const match = /^lesson-(.+)-card-[a-z0-9-]+$/i.exec(cardId);
    if (!match) continue;
    // Saving is the lesson's completion action. Learners deliberately curate
    // the phrase set, so one or more saved cards prove completion; requiring
    // every authored phrase would recommend a finished lesson again whenever
    // even one phrase was deselected.
    if (LESSONS.some((lesson) => lesson.id === match[1])) completed.add(match[1]);
  }
  return completed;
}

export function nextLessonFor(
  profile: Pick<LearningProfile, "level">,
  completedLessonIds: Iterable<string>,
): Lesson | null {
  const completed = new Set(completedLessonIds);
  const learnerRank = LEVEL_RANK[profile.level];
  return (
    LESSONS.find((lesson) => {
      if (completed.has(lesson.id)) return false;
      return lesson.level === profile.level;
    }) ??
    LESSONS.find((lesson) => {
      if (completed.has(lesson.id)) return false;
      return LEVEL_RANK[lesson.level] > learnerRank;
    }) ??
    LESSONS.find((lesson) => {
      if (completed.has(lesson.id)) return false;
      return LEVEL_RANK[lesson.level] < learnerRank;
    }) ??
    LESSONS.find((lesson) => !completed.has(lesson.id)) ??
    null
  );
}

export function firstLesson(): Lesson {
  return LESSONS[0];
}
