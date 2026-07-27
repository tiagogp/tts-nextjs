import { describe, expect, it } from "vitest";
import { LESSONS } from "./lessonDeck";
import {
  buildListeningChallenge,
  learningPhrases,
  passedListeningChallenge,
  scoreListeningChallenge,
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

      // Roadmap lessons carry an authored dialogue and comprehension set; the
      // original curriculum still generates its check from the learned phrases.
      // Both must produce a solvable challenge with one unambiguous answer.
      const authored = Boolean(lesson.dialogue?.length && lesson.comprehension?.length);
      const clips = challenge.audio.map((audio) => audio.clip);
      expect(clips.length).toBeGreaterThanOrEqual(2);
      expect(new Set(clips).size).toBe(clips.length);
      if (!authored) {
        // One question per clip, and nothing else: the old main-idea question was
        // answerable from the lesson title alone.
        expect(challenge.audio).toHaveLength(2);
        expect(challenge.questions).toHaveLength(2);
        expect(challenge.questions.every((question) => question.kind === "detail")).toBe(true);
      }

      for (const question of challenge.questions) {
        expect(new Set(question.options).size).toBe(question.options.length);
        expect(question.options.length).toBeGreaterThanOrEqual(3);
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

  it("allows a complete partial-comprehension attempt to continue", () => {
    const challenge = buildListeningChallenge(LESSONS[0], LESSONS);
    expect(passedListeningChallenge(challenge, challenge.questions.map(() => null))).toBe(false);
    expect(
      passedListeningChallenge(
        challenge,
        challenge.questions.map((question) => question.answer),
      ),
    ).toBe(true);
  });

  it("keeps main-idea and detail evidence separate and allows partial comprehension to continue", () => {
    // This distinction only exists for authored dialogue: synthesized checks carry no
    // mainIdea question (see "asks nothing that is answerable from the lesson title").
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
        {
          kind: "detail" as const,
          prompt: "Who is free?",
          options: ["A", "B", "Both"],
          answer: "B",
        },
      ],
    };
    const challenge = buildListeningChallenge(lesson, LESSONS);
    const answers = challenge.questions.map((question, index) =>
      index === 0 ? question.answer : "not this one",
    );

    expect(scoreListeningChallenge(challenge, answers)).toMatchObject({
      total: 3,
      answered: 3,
      correct: 1,
      mainIdeaCorrect: true,
      detailCorrect: 0,
      detailTotal: 2,
      complete: true,
      canRevealTranscript: true,
      recommendation: "replay-details",
    });
    expect(passedListeningChallenge(challenge, answers)).toBe(true);
  });

  it("does not call an incomplete answer set a listening result", () => {
    const challenge = buildListeningChallenge(LESSONS[0], LESSONS);
    const result = scoreListeningChallenge(challenge, challenge.questions.map(() => null));

    expect(result).toMatchObject({ answered: 0, correct: 0, complete: false, canRevealTranscript: false });
  });

  it("records zero comprehension without making it a failed lesson", () => {
    const challenge = buildListeningChallenge(LESSONS[0], LESSONS);
    const result = scoreListeningChallenge(
      challenge,
      challenge.questions.map(() => "not an answer"),
    );

    expect(result).toMatchObject({
      answered: challenge.questions.length,
      correct: 0,
      mainIdeaCorrect: false,
      detailCorrect: 0,
      complete: true,
      canRevealTranscript: true,
      recommendation: "review-main-idea",
    });
  });

  it("does not change listening semantics when the learner replays", () => {
    const challenge = buildListeningChallenge(LESSONS[0], LESSONS);
    const answers = challenge.questions.map((question) => question.answer);
    const first = scoreListeningChallenge(challenge, answers);
    const replayed = scoreListeningChallenge(challenge, answers);

    expect(replayed).toEqual(first);
    expect(replayed.canRevealTranscript).toBe(true);
  });
});
