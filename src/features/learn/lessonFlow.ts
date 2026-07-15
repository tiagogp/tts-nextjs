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
}

export interface ListeningChallengeResult {
  total: number;
  answered: number;
  correct: number;
  mainIdeaCorrect: boolean;
  detailCorrect: number;
  detailTotal: number;
  complete: boolean;
  /** A complete answer set is enough to reveal the transcript; perfection is not required. */
  canRevealTranscript: boolean;
  recommendation: "replay-details" | "review-main-idea" | "ready-to-notice" | "complete-attempt";
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

function placeAnswer(answer: string, distractors: string[], seed: string): string[] {
  const choices = distinct(distractors, answer).slice(0, OPTION_COUNT - 1);
  const answerIndex = stableNumber(seed) % (choices.length + 1);
  choices.splice(answerIndex, 0, answer);
  return choices;
}

/** The small, explicit language set studied before the audio-only check. */
export function learningPhrases(lesson: Lesson): LessonPhrase[] {
  return lesson.phrases.slice(0, LEARN_PHRASE_COUNT);
}

/**
 * Build a provider-free comprehension check from the bundled lesson metadata.
 * The checked clip always comes from the language introduced during Learn.
 */
export function buildListeningChallenge(
  lesson: Lesson,
  lessons: readonly Lesson[],
): ListeningChallenge {
  if (lesson.dialogue?.length && lesson.comprehension?.length) {
    return {
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

  const learned = learningPhrases(lesson);
  const firstPhraseIndex = stableNumber(lesson.id) % Math.max(1, learned.length);
  const roundIndexes = Array.from(
    { length: Math.min(LISTENING_ROUND_COUNT, learned.length) },
    (_, offset) => (firstPhraseIndex + offset) % learned.length,
  );

  const sameLevelTopics = lessons
    .filter((candidate) => candidate.id !== lesson.id && candidate.level === lesson.level)
    .map((candidate) => candidate.topic);
  const otherTopics = lessons
    .filter((candidate) => candidate.id !== lesson.id)
    .map((candidate) => candidate.topic);

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

  return {
    audio,
    questions: [
      {
        kind: "mainIdea",
        prompt: "What is the main situation?",
        answer: lesson.topic,
        options: placeAnswer(
          lesson.topic,
          [...sameLevelTopics, ...otherTopics],
          `${lesson.id}:topic`,
        ),
      },
      ...audio.map(({ phraseIndex, roundIndex }, audioIndex) => {
      const phrase = lesson.phrases[phraseIndex] ?? lesson.phrases[0];
      const meaningDistractors = lesson.phrases
        .filter((_, index) => index !== phraseIndex)
        .map((candidate) => candidate.pt);
      return {
        kind: "detail" as const,
        prompt: `Which meaning matches clip ${audioIndex + 1}?`,
        answer: phrase.pt,
        options: placeAnswer(
          phrase.pt,
          meaningDistractors,
          `${lesson.id}:meaning:${roundIndex}`,
        ),
      };
      }),
    ],
  };
}

/**
 * Backward-compatible name for callers that used to gate the lesson on a perfect
 * score. A listening check is ready once it is complete; partial comprehension
 * should lead to transcript review and replay, not a failed lesson.
 */
export function passedListeningChallenge(
  challenge: ListeningChallenge,
  answers: readonly (string | null)[],
): boolean {
  return scoreListeningChallenge(challenge, answers).canRevealTranscript;
}

/**
 * Score comprehension without turning detail recall into a progression gate.
 * The learner must complete the check before seeing the transcript, but a partial
 * result is useful evidence and should lead to noticing/replay rather than failure.
 */
export function scoreListeningChallenge(
  challenge: ListeningChallenge,
  answers: readonly (string | null)[],
): ListeningChallengeResult {
  const answered = challenge.questions.reduce(
    (total, _question, index) => total + (answers[index] ? 1 : 0),
    0,
  );
  const correct = challenge.questions.reduce(
    (total, question, index) => total + (answers[index] === question.answer ? 1 : 0),
    0,
  );
  const mainIdeaIndex = challenge.questions.findIndex((question) => question.kind === "mainIdea");
  const detailQuestions = challenge.questions.filter((question) => question.kind === "detail");
  const detailCorrect = detailQuestions.reduce((total, question) => {
    const index = challenge.questions.indexOf(question);
    return total + (answers[index] === question.answer ? 1 : 0);
  }, 0);
  const complete = answered === challenge.questions.length;
  const mainIdeaCorrect = mainIdeaIndex >= 0 && answers[mainIdeaIndex] === challenge.questions[mainIdeaIndex].answer;
  const recommendation = !complete
    ? "complete-attempt"
    : mainIdeaCorrect && detailCorrect === detailQuestions.length
      ? "ready-to-notice"
      : mainIdeaCorrect
        ? "replay-details"
        : "review-main-idea";

  return {
    total: challenge.questions.length,
    answered,
    correct,
    mainIdeaCorrect,
    detailCorrect,
    detailTotal: detailQuestions.length,
    complete,
    canRevealTranscript: complete,
    recommendation,
  };
}
