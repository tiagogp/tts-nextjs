import type { EnglishLevel } from "@/features/discover/types";
import { LEVEL_RANK } from "@/features/discover/levels";
import { stableNumber } from "@/features/learn/lessonFlow";

/**
 * Unprepared questions, answered under a clock.
 *
 * The app already has a timed monologue, but the learner picks the topic and sees the
 * prompt the whole time — so it measures fluency on prepared ground. This is the closest a
 * solo app gets to spontaneous use: a question they did not choose, a few seconds to think,
 * and no prompt on screen while they speak.
 *
 * Two design rules, both about not accidentally making it easy:
 *
 *   1. the prompt is hidden during the answer. Left visible, the exercise becomes reading
 *      comprehension with a microphone;
 *   2. the bank is drawn from a level at or below the learner's, never above. The point is
 *      to remove preparation time from language they already have, not to test new language
 *      under stress, which just produces silence.
 */

export interface TimedPrompt {
  id: string;
  level: EnglishLevel;
  /** English source string, rendered through `t()`. */
  question: string;
  /** Everyday area the question comes from, so a session can avoid repeating one. */
  topic: string;
}

/** Seconds to think before the recording starts. */
export const PREPARATION_SECONDS = 8;
/** Seconds to answer. Long enough for a few sentences, short enough to prevent rehearsal. */
export const RESPONSE_SECONDS = 30;

export const TIMED_PROMPTS: TimedPrompt[] = [
  { id: "a2-weekend", level: "A2", topic: "routine", question: "What did you do last weekend?" },
  { id: "a2-morning", level: "A2", topic: "routine", question: "Describe your morning today." },
  { id: "a2-food", level: "A2", topic: "food", question: "What did you eat yesterday, and did you like it?" },
  { id: "a2-place", level: "A2", topic: "places", question: "Describe the street where you live." },
  { id: "a2-person", level: "A2", topic: "people", question: "Tell me about someone you saw this week." },
  { id: "a2-transport", level: "A2", topic: "travel", question: "How did you get here today?" },
  { id: "a2-plan", level: "A2", topic: "plans", question: "What are you doing tomorrow?" },
  { id: "a2-weather", level: "A2", topic: "small talk", question: "What has the weather been like this week?" },
  { id: "a2-shop", level: "A2", topic: "shopping", question: "What was the last thing you bought?" },
  { id: "a2-free-time", level: "A2", topic: "hobbies", question: "What do you usually do after work?" },

  { id: "b1-problem", level: "B1", topic: "problems", question: "Tell me about something that went wrong recently and what you did." },
  { id: "b1-change", level: "B1", topic: "habits", question: "What is one habit you have changed, and why?" },
  { id: "b1-opinion", level: "B1", topic: "opinions", question: "Do you think working from home is better? Say why." },
  { id: "b1-recommend", level: "B1", topic: "recommendations", question: "Recommend a place in your city and give two reasons." },
  { id: "b1-disagree", level: "B1", topic: "opinions", question: "Describe a time you disagreed with someone. How did it end?" },
  { id: "b1-process", level: "B1", topic: "processes", question: "Explain how you do something you are good at." },
  { id: "b1-goal", level: "B1", topic: "goals", question: "What are you working towards at the moment?" },
  { id: "b1-decision", level: "B1", topic: "decisions", question: "Tell me about a decision you found difficult." },
  { id: "b1-compare", level: "B1", topic: "comparisons", question: "Compare where you live now with where you grew up." },
  { id: "b1-surprise", level: "B1", topic: "stories", question: "Tell me about something that surprised you this year." },
  { id: "b1-advice", level: "B1", topic: "advice", question: "What advice would you give someone starting your job?" },
  { id: "b1-regret", level: "B1", topic: "reflection", question: "Is there something you would do differently? Explain." },
];

export interface TimedPromptOptions {
  level: EnglishLevel;
  /** Prompt ids the learner has already answered; avoided until the bank is exhausted. */
  answered?: Iterable<string>;
  /** Rotates the choice without a random seed, so the same session is reproducible. */
  seed?: number;
  count?: number;
}

/**
 * Pick unanswered questions at or below the learner's level.
 *
 * Falls back to already-answered prompts only when the bank runs out. Returning nothing
 * would be worse — but a repeated question is a prepared question, so the caller should
 * treat a repeat as weaker evidence.
 */
export function selectTimedPrompts({
  level,
  answered = [],
  seed = 0,
  count = 1,
}: TimedPromptOptions): TimedPrompt[] {
  const seen = new Set(answered);
  const learnerRank = LEVEL_RANK[level];
  const eligible = TIMED_PROMPTS.filter((prompt) => LEVEL_RANK[prompt.level] <= learnerRank);
  const pool = eligible.length ? eligible : TIMED_PROMPTS;
  const fresh = pool.filter((prompt) => !seen.has(prompt.id));
  const source = fresh.length ? fresh : pool;

  const chosen: TimedPrompt[] = [];
  const usedTopics = new Set<string>();
  const offset = seed % source.length;
  for (let step = 0; step < source.length && chosen.length < count; step += 1) {
    const prompt = source[(offset + step) % source.length];
    // One question per topic per session: two questions about food is one question.
    if (usedTopics.has(prompt.topic)) continue;
    usedTopics.add(prompt.topic);
    chosen.push(prompt);
  }
  return chosen;
}

/** Stable per-day seed, so the question changes daily rather than on every render. */
export function dailySeed(now: number = Date.now()): number {
  return stableNumber(new Date(now).toISOString().slice(0, 10));
}
