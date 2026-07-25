import { describe, expect, it } from "vitest";
import { LESSONS } from "./lessonDeck";
import {
  buildListeningChallenge,
  learningPhrases,
  passedListeningChallenge,
} from "./lessonFlow";

describe("lessonFlow", () => {
  it("keeps Learn small and uses only learned language for the listening check", () => {
    const lesson = LESSONS[0];
    const learned = learningPhrases(lesson);
    const challenge = buildListeningChallenge(lesson, LESSONS);

    expect(learned).toHaveLength(5);
    expect(challenge.audio).toHaveLength(2);
    for (const audio of challenge.audio) {
      expect(learned.map((phrase) => phrase.clip)).toContain(audio.clip);
    }
  });

  it("builds distinct meaning choices containing one answer", () => {
    for (const lesson of LESSONS) {
      expect(learningPhrases(lesson)).toHaveLength(5);
      const challenge = buildListeningChallenge(lesson, LESSONS, { seed: 0 });
      expect(challenge.audio).toHaveLength(2);
      expect(new Set(challenge.audio.map((audio) => audio.clip)).size).toBe(2);
      // One question per clip, and nothing else: the old main-idea question was answerable
      // from the lesson title alone.
      expect(challenge.questions).toHaveLength(2);
      expect(challenge.questions.every((question) => question.kind === "detail")).toBe(true);
      for (const question of challenge.questions) {
        expect(new Set(question.options).size).toBe(question.options.length);
        expect(question.options).toHaveLength(3);
        expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
      }
    }
  });

  it("asks nothing that is answerable from the lesson title", () => {
    for (const lesson of LESSONS) {
      const challenge = buildListeningChallenge(lesson, LESSONS, { seed: 0 });
      for (const question of challenge.questions) {
        expect(question.answer).not.toBe(lesson.topic);
        expect(question.answer).not.toBe(lesson.title);
      }
    }
  });

  it("flags a synthesized check so it is never reported as listening comprehension", () => {
    // Every bundled lesson currently lacks authored dialogue, so every check is synthesized.
    expect(buildListeningChallenge(LESSONS[0], LESSONS, { seed: 0 }).synthesized).toBe(true);
  });

  it("moves the answer position between attempts", () => {
    const lesson = LESSONS[0];
    const positionsFor = (seed: number) =>
      buildListeningChallenge(lesson, LESSONS, { seed }).questions.map((question) =>
        question.options.indexOf(question.answer),
      );

    // Same attempt → reproducible; a different attempt must not reuse the same slots, or the
    // learner can pass a retry by remembering where the answer sat.
    expect(positionsFor(3)).toEqual(positionsFor(3));
    const seen = new Set([0, 1, 2, 3, 4].map((seed) => positionsFor(seed).join(",")));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("uses authored dialogue and comprehension when lesson material is available", () => {
    const lesson = {
      ...LESSONS[0],
      dialogue: [
        { speaker: "A", en: "Are you free?", pt: "Você está livre?", clip: "/learn/audio/test/01.wav" },
        { speaker: "B", en: "After six.", pt: "Depois das seis.", clip: "/learn/audio/test/02.wav" },
      ],
      comprehension: [
        {
          kind: "mainIdea" as const,
          prompt: "What are they arranging?",
          options: ["A meeting", "A meal", "A trip"],
          answer: "A meeting",
        },
        {
          kind: "detail" as const,
          prompt: "When is B free?",
          options: ["Before five", "At lunch", "After six"],
          answer: "After six",
        },
      ],
    };

    expect(buildListeningChallenge(lesson, LESSONS)).toEqual({
      synthesized: false,
      audio: [
        { id: `${lesson.id}-dialogue-1`, speaker: "A", en: "Are you free?", pt: "Você está livre?", clip: "/learn/audio/test/01.wav" },
        { id: `${lesson.id}-dialogue-2`, speaker: "B", en: "After six.", pt: "Depois das seis.", clip: "/learn/audio/test/02.wav" },
      ],
      questions: lesson.comprehension,
    });
  });

  it("passes only when both comprehension answers are correct", () => {
    const challenge = buildListeningChallenge(LESSONS[0], LESSONS);
    expect(passedListeningChallenge(challenge, challenge.questions.map(() => null))).toBe(false);
    expect(
      passedListeningChallenge(
        challenge,
        challenge.questions.map((question) => question.answer),
      ),
    ).toBe(true);
  });
});
