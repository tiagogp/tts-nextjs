import { describe, expect, it } from "vitest";
import { LESSONS, firstLesson, lessonById, type LessonPhrase } from "@/features/learn/lessonDeck";
import { buildSpeakingDrill } from "./speakingDrill";

function phrase(en: string): LessonPhrase {
  return { en, pt: `pt:${en}`, concept: "greeting", note: "", clip: `${en}.wav` };
}

describe("buildSpeakingDrill", () => {
  const lesson = firstLesson();

  it("imitates model lines before asking for original production", () => {
    const steps = buildSpeakingDrill({ lesson });

    expect(steps.map((step) => step.kind)).toEqual(["repeat", "repeat", "speak"]);
  });

  it("has the learner repeat the phrases they chose to keep", () => {
    const saved = [phrase("See you tomorrow"), phrase("Nice to meet you")];
    const steps = buildSpeakingDrill({ lesson, savedPhrases: saved });

    expect(steps.slice(0, 2).map((step) => step.phrase.en)).toEqual([
      "See you tomorrow",
      "Nice to meet you",
    ]);
  });

  it("falls back to the lesson's phrases, with their audio, when nothing is saved yet", () => {
    const steps = buildSpeakingDrill({ lesson });

    expect(steps[0].phrase.en).toBe(lesson.phrases[0].en);
    expect(steps[0].phrase.clip).toBeTruthy();
  });

  // Only 64 of the 100 lessons author a productionPrompt, and the first lesson a learner
  // ever sees is not one of them — so the fallback is the common path on day 1, not an edge.
  it("uses the lesson's production prompt when it has one", () => {
    const authored = LESSONS.find((item) => Boolean(item.productionPrompt));
    const steps = buildSpeakingDrill({ lesson: authored! });

    expect(steps.at(-1)!.prompt).toBe(authored!.productionPrompt);
  });

  it("still gives the first lesson a speaking prompt, which authors none", () => {
    const greetings = lessonById("a1-greetings") ?? firstLesson();
    const steps = buildSpeakingDrill({ lesson: greetings });

    expect(greetings.productionPrompt).toBeUndefined();
    expect(steps.at(-1)!.kind).toBe("speak");
    expect(steps.at(-1)!.prompt).toBeTruthy();
  });

  it("never returns a drill with nothing to say", () => {
    for (const item of LESSONS) {
      const steps = buildSpeakingDrill({ lesson: item });
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps.every((step) => step.phrase?.en)).toBe(true);
    }
  });
});
