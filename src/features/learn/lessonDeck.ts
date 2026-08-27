import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import type { LanguagePattern } from "@/lib/language/pattern";
import { isDrillablePattern } from "@/lib/language/pattern";
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
  /**
   * The reusable structure behind this phrase. Authoring it is what turns eight loose
   * expressions into three patterns with variations, and it is the only thing that makes
   * the variation drill and the transfer check possible offline.
   *
   * Optional because the 800 authored phrases are being migrated incrementally. Every
   * pattern-dependent feature reads it through `isDrillablePattern` and simply does not
   * offer the exercise when it is missing — an unauthored phrase yields no drill, never a
   * fabricated one.
   */
  pattern?: LanguagePattern;
  /** Other wordings that answer this prompt correctly. See `Card.acceptedAnswers`. */
  accept?: string[];
}

/** Phrases in this lesson that carry a drillable pattern. */
export function drillablePhrases(lesson: Lesson): LessonPhrase[] {
  return lesson.phrases.filter((phrase) => isDrillablePattern(phrase.pattern));
}

/** Every distinct pattern family taught by a lesson. */
export function lessonPatterns(lesson: Lesson): LanguagePattern[] {
  const seen = new Map<string, LanguagePattern>();
  for (const phrase of drillablePhrases(lesson)) {
    if (phrase.pattern && !seen.has(phrase.pattern.id)) seen.set(phrase.pattern.id, phrase.pattern);
  }
  return [...seen.values()];
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

export function hasCompleteGuidedMaterial(lesson: Lesson): boolean {
  return Boolean(
    lesson.objective?.trim() &&
    lesson.pronunciationFocus?.trim() &&
    lesson.dialogue && lesson.dialogue.length >= 2 &&
    lesson.comprehension && lesson.comprehension.length >= 3 &&
    lesson.productionPrompt?.trim() &&
    lesson.retryHint?.trim(),
  );
}

const ALL_LESSON_CONTENT = lessonsData as Lesson[];

/**
 * Earlier B1 phrase lists without a communicative objective, dialogue, comprehension, and
 * retry contract remain in the source file for future authoring, but are not shipped as
 * guided lessons. Serving a bare list as a lesson would reintroduce recognition-only study.
 */
export const LEGACY_PHRASE_BANK = ALL_LESSON_CONTENT.filter(
  (lesson) => lesson.level === "B1" && !hasCompleteGuidedMaterial(lesson),
);

export const LESSONS = ALL_LESSON_CONTENT.filter(
  (lesson) => lesson.level !== "B1" || hasCompleteGuidedMaterial(lesson),
);

/**
 * Card-id suffix of the PT→EN half of a phrase pair. The receptive half keeps the bare id
 * so lesson-completion detection and pre-split SRS state stay valid.
 */
export const PRODUCTION_CARD_SUFFIX = "production";

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
    const phraseId = phraseKey(phrase, i);
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

  // Both directions, one card each, scheduled independently by FSRS. Production comes first
  // because it is the direction the product promises: a learner who can only recognize the
  // phrase has not learned to use it, and a recognition-only deck clears from acoustic
  // familiarity while FSRS records the non-event as a successful review.
  const cards: Card[] = sorted.flatMap((i) => {
    const phrase = phrases[i];
    const phraseId = phraseKey(phrase, i);
    const pattern = isDrillablePattern(phrase.pattern) ? phrase.pattern : undefined;
    const shared = {
      concept: phrase.concept,
      // An authored pattern id is shared across lessons on purpose: that is what lets
      // interleaving mix two lessons' members of one family. Without one, fall back to a
      // lesson-local id, which keeps recognition/production paired but has a family of one.
      patternId: pattern?.id ?? `${sourceId}:${phrase.concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      patternFrame: pattern?.frame,
      patternSlot: pattern?.slot,
      patternContrast: pattern?.contrast,
      // `[phrase.en]` was a family of one — the shape of a pattern with none of the
      // substance. Only authored examples make the family real.
      examples: pattern?.examples ?? [phrase.en],
      acceptedAnswers: phrase.accept,
      source: { kind: "phrase", id: `${sourceId}-${phraseId}` } as const,
      audioClipPath: phrase.clip,
      createdAt: now,
    };
    return [
      {
        ...shared,
        id: `${sourceId}-card-${phraseId}-${PRODUCTION_CARD_SUFFIX}`,
        front: phrase.pt,
        back: phrase.en,
        direction: "production" as const,
      },
      // Keeps the original id so decks saved before the split retain their SRS state.
      {
        ...shared,
        id: `${sourceId}-card-${phraseId}`,
        front: phrase.en,
        back: phrase.pt,
        direction: "recognition" as const,
      },
    ];
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

/**
 * How a phrase is addressed inside a card id: its authored id, or its position for the
 * original 36 lessons, which predate stable phrase ids. Card ids are the learner's SRS
 * state, so this mapping is frozen — a phrase that moves to another lesson, or is
 * renumbered, orphans everything the learner has built on it.
 */
export function phraseKey(phrase: LessonPhrase, index: number): string {
  return phrase.id ?? String(index);
}

export function lessonCardIds(lesson: Lesson): string[] {
  return lesson.phrases.flatMap((phrase, i) => {
    const base = `lesson-${lesson.id}-card-${phraseKey(phrase, i)}`;
    return [`${base}-${PRODUCTION_CARD_SUFFIX}`, base];
  });
}

/**
 * A lesson ships eight phrases and a sitting teaches five (`learningPhrases`), because
 * eight lexically neighbouring expressions encoded at once interfere with each other. That
 * left the last three of every lesson — roughly 300 authored phrases — taught to nobody:
 * reachable only by tapping them into the picker, never presented, never explained.
 *
 * The fix is a second pass, not a smaller lesson. Which phrases a learner has already been
 * taught is not extra state to store — it is already written in their card ids, so this
 * reads it back out. A lesson is *finished* when every authored phrase has a card, and
 * `nextLessonFor` only returns to an unfinished one after the level's untouched lessons
 * run out, which is what makes the re-encounter spaced rather than immediate.
 */
export interface LessonProgress {
  /** lesson id → phrase keys the learner already has cards for. */
  taught: Map<string, Set<string>>;
}

const LESSON_CARD_ID = new RegExp(`^lesson-(.+)-card-(.+?)(?:-${PRODUCTION_CARD_SUFFIX})?$`, "i");

export function lessonProgressFromCardIds(cardIds: Iterable<string>): LessonProgress {
  const taught = new Map<string, Set<string>>();
  for (const cardId of cardIds) {
    const match = LESSON_CARD_ID.exec(cardId);
    if (!match) continue;
    const [, lessonId, key] = match;
    if (!LESSONS.some((lesson) => lesson.id === lessonId)) continue;
    const keys = taught.get(lessonId) ?? new Set<string>();
    keys.add(key);
    taught.set(lessonId, keys);
  }
  return { taught };
}

/** Progress for callers that only know whole lessons are done — tests, and legacy state. */
export function lessonProgressFromFinishedIds(lessonIds: Iterable<string>): LessonProgress {
  const taught = new Map<string, Set<string>>();
  for (const id of lessonIds) {
    const lesson = LESSONS.find((candidate) => candidate.id === id);
    if (!lesson) continue;
    taught.set(id, new Set(lesson.phrases.map((phrase, index) => phraseKey(phrase, index))));
  }
  return { taught };
}

/** Phrases of this lesson the learner has no card for yet, in authored order. */
export function untaughtPhrases(lesson: Lesson, taught: ReadonlySet<string> | undefined): LessonPhrase[] {
  if (!taught || taught.size === 0) return [...lesson.phrases];
  return lesson.phrases.filter((phrase, index) => !taught.has(phraseKey(phrase, index)));
}

/** True once every authored phrase of the lesson has been taught at least once. */
export function isLessonFinished(lesson: Lesson, progress: LessonProgress): boolean {
  return untaughtPhrases(lesson, progress.taught.get(lesson.id)).length === 0;
}

export function nextLessonFor(
  profile: Pick<LearningProfile, "level">,
  progress: LessonProgress,
): Lesson | null {
  const learnerRank = LEVEL_RANK[profile.level];
  const ordered = ["A2", "B1"].includes(profile.level)
    ? [...LESSONS].sort((left, right) =>
        Number(hasCompleteGuidedMaterial(right)) - Number(hasCompleteGuidedMaterial(left)),
      )
    : LESSONS;
  const untouched = (lesson: Lesson) => !progress.taught.has(lesson.id);
  const unfinished = (lesson: Lesson) => !isLessonFinished(lesson, progress);

  // Within a tier, untouched lessons come first and only then the phrases a started lesson
  // never taught. Two consequences, both wanted: the tail never lands in the same sitting
  // as the opening five, which is what made eight neighbouring expressions interfere; and a
  // level is exhausted before the learner moves up, so the built-in content lasts about
  // twice as long as when three phrases of every lesson were taught to nobody.
  const tiers: ((lesson: Lesson) => boolean)[] = [
    (lesson) => lesson.level === profile.level,
    (lesson) => LEVEL_RANK[lesson.level] > learnerRank,
    (lesson) => LEVEL_RANK[lesson.level] < learnerRank,
    () => true,
  ];
  for (const tier of tiers) {
    const next =
      ordered.find((lesson) => tier(lesson) && untouched(lesson)) ??
      ordered.find((lesson) => tier(lesson) && unfinished(lesson));
    if (next) return next;
  }
  return null;
}

export function firstLesson(): Lesson {
  return LESSONS[0];
}
