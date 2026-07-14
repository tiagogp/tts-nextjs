import type { Lesson, LessonPhrase } from "@/features/learn/lessonDeck";

export interface SpeakingDrillStep {
  /** `repeat` imitates a model line; `speak` is original production. */
  kind: "repeat" | "speak";
  phrase: LessonPhrase;
  /** English source string — render it through `t()`. */
  prompt: string;
}

const DEFAULT_REPEAT_COUNT = 2;

/**
 * The beginner speaking drill: imitate a couple of model lines, then produce one
 * original sentence. It is the method's Repeat → Speak pair, sized for a learner who
 * has never spoken English before, and it runs entirely on local Whisper + Kokoro so it
 * needs no provider.
 *
 * The `speak` prompt falls back to the lesson's own phrase when the lesson has no
 * authored `productionPrompt` — only 64 of the 100 lessons have one, and the very first
 * lesson (`a1-greetings`) is not among them. The fallback is what produces the fixed
 * frames the method asks a beginner for ("My name is…", "I live in…").
 */
export function buildSpeakingDrill(input: {
  lesson: Lesson;
  /** The learner's own saved phrases, so they repeat material they chose to keep. */
  savedPhrases?: LessonPhrase[];
  repeatCount?: number;
}): SpeakingDrillStep[] {
  const { lesson, savedPhrases = [], repeatCount = DEFAULT_REPEAT_COUNT } = input;

  const source = savedPhrases.length > 0 ? savedPhrases : lesson.phrases;
  const models = source.slice(0, Math.max(1, repeatCount));

  const steps: SpeakingDrillStep[] = models.map((phrase) => ({
    kind: "repeat",
    phrase,
    prompt: "Listen, then say it back. Match the rhythm, not every sound.",
  }));

  const target = models[0] ?? lesson.phrases[0];
  steps.push({
    kind: "speak",
    phrase: target,
    prompt: lesson.productionPrompt ?? "Say one sentence of your own using this phrase.",
  });

  return steps;
}
