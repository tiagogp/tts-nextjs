import type {
  Lesson,
  LessonComprehensionKind,
  LessonPhrase,
} from "./lessonDeck";

const LEARN_PHRASE_COUNT = 5;
const LISTENING_ROUND_COUNT = 2;
const OPTION_COUNT = 3;

export interface ListeningAudio {
  id: string;
  en: string;
  pt: string;
  clip: string;
  speaker?: string;
}

export interface ListeningQuestion {
  kind: LessonComprehensionKind;
  prompt: string;
  options: string[];
  answer: string;
}

export interface ListeningChallenge {
  audio: ListeningAudio[];
  questions: ListeningQuestion[];
  /**
   * True when the lesson shipped no `dialogue`/`comprehension` and the check was synthesized
   * from the phrases just taught. Such a check measures short-term discrimination among
   * primed items, not listening comprehension: it must be labelled as a recall check in the
   * UI and must never be counted as listening accuracy in any metric.
   */
  synthesized: boolean;
}

export interface ListeningChallengeOptions {
  /**
   * Varies option order between attempts. Pass a value that changes per attempt (the default
   * is the clock); a fixed seed keeps an attempt reproducible for tests. A position derived
   * from the lesson id alone would let a learner memorize where the answer sits.
   */
  seed?: number;
}

function stableNumber(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function distinct(values: Iterable<string>, excluded: string): string[] {
  return [...new Set(values)].filter((value) => value !== excluded);
}

function placeAnswer(answer: string, distractors: string[], seed: number): string[] {
  const choices = distinct(distractors, answer).slice(0, OPTION_COUNT - 1);
  choices.splice(seed % (choices.length + 1), 0, answer);
  return choices;
}

/** The small, explicit language set studied before the audio-only check. */
export function learningPhrases(lesson: Lesson): LessonPhrase[] {
  return lesson.phrases.slice(0, LEARN_PHRASE_COUNT);
}

/**
 * Build the comprehension check for a lesson. Authored `dialogue` + `comprehension` is the
 * real thing and is used verbatim. Without it the check is synthesized from the phrases just
 * taught, which is honestly a recall check — see `ListeningChallenge.synthesized`.
 */
export function buildListeningChallenge(
  lesson: Lesson,
  lessons: readonly Lesson[],
  options: ListeningChallengeOptions = {},
): ListeningChallenge {
  if (lesson.dialogue?.length && lesson.comprehension?.length) {
    return {
      synthesized: false,
      audio: lesson.dialogue.map((line, index) => ({
        id: `${lesson.id}-dialogue-${index + 1}`,
        en: line.en,
        pt: line.pt,
        clip: line.clip,
        speaker: line.speaker,
      })),
      questions: lesson.comprehension.map((question) => ({
        ...question,
        options: [...question.options],
      })),
    };
  }

  const seed = options.seed ?? Date.now();
  const learned = learningPhrases(lesson);
  const firstPhraseIndex = stableNumber(lesson.id) % Math.max(1, learned.length);
  const roundIndexes = Array.from(
    { length: Math.min(LISTENING_ROUND_COUNT, learned.length) },
    (_, offset) => (firstPhraseIndex + offset) % learned.length,
  );

  const audio = roundIndexes.map((phraseIndex, roundIndex) => {
    const phrase = lesson.phrases[phraseIndex] ?? lesson.phrases[0];
    return {
      id: `${lesson.id}-phrase-${phraseIndex}`,
      en: phrase.en,
      pt: phrase.pt,
      clip: phrase.clip,
      phraseIndex,
      roundIndex,
    };
  });

  // Fill for short lessons only: same-lesson meanings are the closest competitors and stay
  // first. Note this does not make the task listening comprehension — every option is still
  // a meaning the learner can discriminate from the phrase they read a minute ago. Only
  // authored dialogue fixes that.
  const unprimedMeanings = lessons
    .filter((candidate) => candidate.id !== lesson.id && candidate.level === lesson.level)
    .flatMap((candidate) => candidate.phrases.map((phrase) => phrase.pt));

  return {
    synthesized: true,
    audio,
    // The old "What is the main situation?" question is gone on purpose: its answer was
    // `lesson.topic`, which the learner can read off the lesson title without playing a
    // single clip. It inflated the pass rate and measured nothing.
    questions: audio.map(({ phraseIndex, roundIndex }, audioIndex) => {
      const phrase = lesson.phrases[phraseIndex] ?? lesson.phrases[0];
      const meaningDistractors = [
        ...lesson.phrases.filter((_, index) => index !== phraseIndex).map((c) => c.pt),
        ...unprimedMeanings,
      ];
      return {
        kind: "detail" as const,
        prompt: `Which meaning matches clip ${audioIndex + 1}?`,
        answer: phrase.pt,
        options: placeAnswer(
          phrase.pt,
          meaningDistractors,
          stableNumber(`${lesson.id}:meaning:${roundIndex}`) + seed,
        ),
      };
    }),
  };
}

export function passedListeningChallenge(
  challenge: ListeningChallenge,
  answers: readonly (string | null)[],
): boolean {
  return challenge.questions.every(
    (question, index) => answers[index] === question.answer,
  );
}
