import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import a1b1 from "@/plans/a1-b1.json";
import type { PlanGenerationResult } from "@/features/plan/schema";
import { resolveInterfaceLang } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import {
  LESSONS,
  buildDeckFromPhrases,
  lessonProgressFromCardIds,
  lessonProgressFromFinishedIds,
  hasCompleteGuidedMaterial,
  isLessonFinished,
  lessonCardIds,
  nextLessonFor,
  phraseKey,
  untaughtPhrases,
} from "./lessonDeck";
import { learningPhrases } from "./lessonFlow";

describe("lessonDeck", () => {
  it("ships a substantial lesson library across every CEFR level", () => {
    const expectedLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    expect(LESSONS.length).toBeGreaterThanOrEqual(36);
    expect(LESSONS.reduce((count, lesson) => count + lesson.phrases.length, 0)).toBeGreaterThanOrEqual(292);
    for (const level of expectedLevels) {
      expect(LESSONS.filter((lesson) => lesson.level === level).length).toBeGreaterThanOrEqual(3);
    }
    const lessonIds = LESSONS.map((lesson) => lesson.id);
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(LESSONS.every((lesson) => lesson.phrases.length >= 8)).toBe(true);
    expect(
      LESSONS.filter((lesson) => ["A2", "B1"].includes(lesson.level)).every(hasCompleteGuidedMaterial),
    ).toBe(true);
  });

  it("builds provider-free decks with stable ids", () => {
    const lesson = LESSONS[0];
    const first = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [2, 0]);
    const second = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0, 2]);

    expect(first.candidates.map((candidate) => candidate.segmentIndex)).toEqual([0, 2]);
    expect(first.cards.map((card) => card.id)).toEqual(second.cards.map((card) => card.id));
    expect(first.candidates.every((candidate) => candidate.status === "accepted")).toBe(true);
    expect(new Set(first.cards.map((card) => card.source.id))).toEqual(
      new Set(first.candidates.map((candidate) => candidate.id)),
    );

    const authored = buildDeckFromPhrases(
      `lesson-${lesson.id}`,
      lesson.phrases.map((phrase, index) => ({ ...phrase, id: `target-${index + 1}` })),
      [0],
    );
    expect(authored.cards.map((card) => card.id)).toEqual([
      `lesson-${lesson.id}-card-target-1-production`,
      `lesson-${lesson.id}-card-target-1`,
    ]);
    expect(authored.cards.every((card) => card.source.id === `lesson-${lesson.id}-target-1`)).toBe(
      true,
    );
  });

  it("gives every kept phrase both recall directions, scheduled as separate cards", () => {
    const lesson = LESSONS[0];
    const { cards } = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0]);
    const [production, recognition] = cards;

    expect(cards).toHaveLength(2);
    // PT → EN comes first: producing the phrase is the direction the product promises.
    expect(production).toMatchObject({
      id: `lesson-${lesson.id}-card-0-production`,
      direction: "production",
      front: lesson.phrases[0].pt,
      back: lesson.phrases[0].en,
      audioClipPath: lesson.phrases[0].clip,
    });
    // The receptive half keeps the pre-split id so existing SRS state survives.
    expect(recognition).toMatchObject({
      id: `lesson-${lesson.id}-card-0`,
      direction: "recognition",
      front: lesson.phrases[0].en,
      back: lesson.phrases[0].pt,
    });
    expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
  });

  it("ignores card ids that name no shipped lesson", () => {
    const lesson = LESSONS[0];
    expect(lessonProgressFromCardIds(lessonCardIds(lesson)).taught.get(lesson.id)?.size).toBe(
      lesson.phrases.length,
    );
    expect(lessonProgressFromCardIds([]).taught.size).toBe(0);
    expect(lessonProgressFromCardIds(["lesson-not-real-card-0"]).taught.size).toBe(0);
    expect(lessonProgressFromCardIds(["own-sentence-123"]).taught.size).toBe(0);
  });

  it("reads which phrases a lesson already taught out of the card ids", () => {
    const lesson = LESSONS[0];
    const firstPass = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0, 1, 2, 3, 4]);
    const progress = lessonProgressFromCardIds(firstPass.cards.map((card) => card.id));
    const taught = progress.taught.get(lesson.id);

    expect(taught?.size).toBe(5);
    expect(untaughtPhrases(lesson, taught)).toEqual(lesson.phrases.slice(5));
    expect(isLessonFinished(lesson, progress)).toBe(false);
    expect(isLessonFinished(lesson, lessonProgressFromFinishedIds([lesson.id]))).toBe(true);
  });

  it("returns to a lesson's untaught phrases only after the level runs out", () => {
    const a1 = LESSONS.filter((lesson) => lesson.level === "A1");
    const started = a1[0];
    const halfOfEveryA1: string[] = a1.flatMap(
      (lesson) => buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0, 1, 2, 3, 4])
        .cards.map((card) => card.id),
    );

    // One lesson half-done: the next untouched A1 lesson wins over its own tail.
    const afterOne = lessonProgressFromCardIds(
      buildDeckFromPhrases(`lesson-${started.id}`, started.phrases, [0, 1, 2, 3, 4])
        .cards.map((card) => card.id),
    );
    expect(nextLessonFor({ level: "A1" }, afterOne)?.id).not.toBe(started.id);
    expect(nextLessonFor({ level: "A1" }, afterOne)?.level).toBe("A1");

    // Every A1 lesson half-done: now the tails come back, weeks of study later.
    const afterAll = lessonProgressFromCardIds(halfOfEveryA1);
    const next = nextLessonFor({ level: "A1" }, afterAll);
    expect(next?.level).toBe("A1");
    expect(untaughtPhrases(next!, afterAll.taught.get(next!.id)).length).toBeGreaterThan(0);
  });

  it("teaches the tail on the second visit instead of repeating the opening phrases", () => {
    const lesson = LESSONS[0];
    const first = learningPhrases(lesson);
    const taught = new Set(first.map((phrase) => phraseKey(phrase, lesson.phrases.indexOf(phrase))));
    const second = learningPhrases(lesson, { taught });

    expect(first.length).toBe(5);
    expect(second.length).toBe(lesson.phrases.length - 5);
    expect(second.some((phrase) => first.includes(phrase))).toBe(false);
    // Nothing left to teach: a re-run is a review of the lesson, not an empty screen.
    expect(learningPhrases(lesson, { taught: new Set(lesson.phrases.map((p, i) => phraseKey(p, i))) }))
      .toEqual(first);
  });

  it("selects the next lesson at the learner level before advancing", () => {
    const fresh = lessonProgressFromFinishedIds([]);
    expect(nextLessonFor({ level: "A1" }, fresh)?.id).toBe("a1-greetings");
    expect(nextLessonFor({ level: "A1" }, lessonProgressFromFinishedIds(["a1-greetings"]))?.id).toBe("a1-introductions");
    expect(hasCompleteGuidedMaterial(nextLessonFor({ level: "B1" }, fresh)!)).toBe(true);
    expect(nextLessonFor({ level: "B2" }, fresh)?.id).toBe("b2-arguments");
    expect(nextLessonFor({ level: "C1" }, fresh)?.id).toBe("c1-nuance");
    expect(nextLessonFor({ level: "C2" }, fresh)?.id).toBe("c2-precision");

    const a1Ids = LESSONS.filter((lesson) => lesson.level === "A1").map((lesson) => lesson.id);
    expect(nextLessonFor({ level: "A1" }, lessonProgressFromFinishedIds(a1Ids))?.level).toBe("A2");

    const b1Ids = LESSONS.filter((lesson) => lesson.level === "B1").map((lesson) => lesson.id);
    expect(nextLessonFor({ level: "B1" }, lessonProgressFromFinishedIds(b1Ids))?.level).toBe("B2");
  });

  it("serves translated higher-level lesson copy to A2 Portuguese learners", () => {
    const a2Ids = LESSONS.filter((lesson) => lesson.level === "A2").map((lesson) => lesson.id);
    const lesson = nextLessonFor({ level: "A2" }, lessonProgressFromFinishedIds(a2Ids));
    const lang = resolveInterfaceLang({ level: "A2", nativeLang: "pt" });

    expect(lesson?.level).toBe("B1");
    expect(lang).toBe("pt");
    expect(hasCompleteGuidedMaterial(lesson!)).toBe(true);
    expect(translate(lang, lesson?.title ?? "")).not.toBe(lesson?.title);
    expect(translate(lang, lesson?.topic ?? "")).not.toBe(lesson?.topic);
  });

  it("keeps every referenced lesson id valid in the A1-B1 default plan", () => {
    const lessonIds = new Set(LESSONS.map((lesson) => lesson.id));
    const plan = a1b1 as PlanGenerationResult;
    for (const day of plan.days) {
      for (const task of day.tasks) {
        if (task.type === "lesson") {
          expect(task.lessonId, `day ${day.dayNumber}: ${task.instruction}`).toBeTruthy();
          expect(lessonIds.has(task.lessonId ?? "")).toBe(true);
        }
      }
    }
  });

  it("points every bundled phrase clip at a shipped file", () => {
    for (const lesson of LESSONS) {
      for (const phrase of lesson.phrases) {
        expect(phrase.clip).toMatch(/^\/(?:learn|demo)\/audio\/.+\.wav$/);
        expect(
          existsSync(path.join(process.cwd(), "public", phrase.clip.replace(/^\//, ""))),
          `${lesson.id}: ${phrase.clip}`,
        ).toBe(true);
      }
    }
  });
});
