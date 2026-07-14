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

  it("builds distinct main-idea and meaning choices containing one answer", () => {
    for (const lesson of LESSONS) {
      expect(learningPhrases(lesson)).toHaveLength(5);
      const challenge = buildListeningChallenge(lesson, LESSONS);

      // Roadmap lessons carry an authored dialogue and comprehension set; the
      // original curriculum still generates its check from the learned phrases.
      // Both must produce a solvable challenge with one unambiguous answer.
      const authored = Boolean(lesson.dialogue?.length && lesson.comprehension?.length);
      const clips = challenge.audio.map((audio) => audio.clip);
      expect(clips.length).toBeGreaterThanOrEqual(2);
      expect(new Set(clips).size).toBe(clips.length);
      expect(challenge.questions.length).toBeGreaterThanOrEqual(3);
      expect(challenge.questions.filter((question) => question.kind === "mainIdea")).toHaveLength(1);
      if (!authored) {
        expect(challenge.audio).toHaveLength(2);
        expect(challenge.questions).toHaveLength(3);
        expect(challenge.questions[0].kind).toBe("mainIdea");
      }

      for (const question of challenge.questions) {
        expect(new Set(question.options).size).toBe(question.options.length);
        expect(question.options.length).toBeGreaterThanOrEqual(3);
        expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
      }
    }
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
