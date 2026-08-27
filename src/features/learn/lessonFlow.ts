import type {
  Lesson,
  LessonComprehensionKind,
  LessonPhrase,
} from "./lessonDeck";
import { untaughtPhrases } from "./lessonDeck";

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

export interface ListeningChallengeOptions extends LessonPartOptions {
  /**
   * Varies option order between attempts. Pass a value that changes per attempt (the default
   * is the clock); a fixed seed keeps an attempt reproducible for tests. A position derived
   * from the lesson id alone would let a learner memorize where the answer sits.
   */
  seed?: number;
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

/** Stable hash of a string, so a seeded choice is the same on every render. */
export function stableNumber(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function distinct(values: Iterable<string>, excluded: string): string[] {
  return [...new Set(values)].filter((value) => value !== excluded);
}

/**
 * Insert the correct answer at a seeded position among the distractors. Shared with the
 * pattern drills: an answer that is always in slot one stops being read.
 */
export function placeAnswer(answer: string, distractors: string[], seed: number, limit = OPTION_COUNT): string[] {
  const choices = distinct(distractors, answer).slice(0, limit - 1);
  choices.splice(seed % (choices.length + 1), 0, answer);
  return choices;
}

export interface LessonPartOptions {
  /**
   * Phrase keys the learner already has cards for, from `lessonProgressFromCardIds`.
   * Omitted means a first pass, which is the whole lesson's worth of choices.
   */
  taught?: ReadonlySet<string>;
}

/**
 * The small, explicit language set studied before the audio-only check.
 *
 * Five, not eight, because items encoded together compete; and the five are the ones the
 * learner has not met yet, so a second visit to the lesson teaches its tail instead of
 * re-presenting the same opening phrases. When everything has been taught the lesson still
 * opens on its first five — a re-run is a review, not an empty screen.
 */
export function learningPhrases(lesson: Lesson, options: LessonPartOptions = {}): LessonPhrase[] {
  const untaught = untaughtPhrases(lesson, options.taught);
  return (untaught.length > 0 ? untaught : lesson.phrases).slice(0, LEARN_PHRASE_COUNT);
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
  const seed = options.seed ?? Date.now();

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
      // Authored lessons list the answer first so the JSON stays readable, so the order they
      // ship in cannot be the order the learner sees — otherwise "always pick the top option"
      // passes every authored check without playing a clip. Same per-attempt placement the
      // synthesized branch uses.
      questions: lesson.comprehension.map((question, index) => ({
        ...question,
        options: placeAnswer(
          question.answer,
          question.options,
          seed + stableNumber(`${lesson.id}-${index}`),
        ),
      })),
    };
  }

  // The check has to ask about the phrases this sitting actually taught, so it follows the
  // part rather than the first five. Positions stay those of `lesson.phrases`, so the audio
  // ids of a first pass are unchanged and earlier ListeningAttempts stay comparable.
  const learned = learningPhrases(lesson, { taught: options.taught });
  const first = stableNumber(lesson.id) % Math.max(1, learned.length);
  const rounds = Array.from(
    { length: Math.min(LISTENING_ROUND_COUNT, learned.length) },
    (_, offset) => lesson.phrases.indexOf(learned[(first + offset) % learned.length]),
  );

  const audio = rounds.map((phraseIndex, roundIndex) => {
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
