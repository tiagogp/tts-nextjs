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
  completedLessonIdsFromCardIds,
  lessonCardIds,
  nextLessonFor,
} from "./lessonDeck";

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
  });

  it("builds provider-free decks with stable ids", () => {
    const lesson = LESSONS[0];
    const first = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [2, 0]);
    const second = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0, 2]);

    expect(first.candidates.map((candidate) => candidate.segmentIndex)).toEqual([0, 2]);
    expect(first.cards.map((card) => card.id)).toEqual(second.cards.map((card) => card.id));
    expect(first.cards[0]).toMatchObject({
      id: `lesson-${lesson.id}-card-0`,
      front: lesson.phrases[0].en,
      back: lesson.phrases[0].pt,
      source: { kind: "phrase", id: `lesson-${lesson.id}-0` },
      audioClipPath: lesson.phrases[0].clip,
    });
    expect(first.candidates.every((candidate) => candidate.status === "accepted")).toBe(true);
    expect(first.cards.map((card) => card.source.id)).toEqual(first.candidates.map((candidate) => candidate.id));

    const authored = buildDeckFromPhrases(
      `lesson-${lesson.id}`,
      lesson.phrases.map((phrase, index) => ({ ...phrase, id: `target-${index + 1}` })),
      [0],
    );
    expect(authored.cards[0]).toMatchObject({
      id: `lesson-${lesson.id}-card-target-1`,
      source: { kind: "phrase", id: `lesson-${lesson.id}-target-1` },
    });
  });

  it("detects completed lessons from stable card ids", () => {
    const lesson = LESSONS[0];
    expect(completedLessonIdsFromCardIds(lessonCardIds(lesson))).toEqual(new Set([lesson.id]));
    expect(completedLessonIdsFromCardIds(lessonCardIds(lesson).slice(0, 2))).toEqual(
      new Set([lesson.id]),
    );
    expect(completedLessonIdsFromCardIds([])).toEqual(new Set());
    expect(completedLessonIdsFromCardIds(["lesson-not-real-card-0"])).toEqual(new Set());
  });

  it("selects the next lesson at the learner level before advancing", () => {
    expect(nextLessonFor({ level: "A1" }, [])?.id).toBe("a1-greetings");
    expect(nextLessonFor({ level: "A1" }, ["a1-greetings"])?.id).toBe("a1-introductions");
    expect(nextLessonFor({ level: "B1" }, [])?.id).toBe("b1-opinions");
    expect(nextLessonFor({ level: "B2" }, [])?.id).toBe("b2-arguments");
    expect(nextLessonFor({ level: "C1" }, [])?.id).toBe("c1-nuance");
    expect(nextLessonFor({ level: "C2" }, [])?.id).toBe("c2-precision");

    const a1Ids = LESSONS.filter((lesson) => lesson.level === "A1").map((lesson) => lesson.id);
    expect(nextLessonFor({ level: "A1" }, a1Ids)?.level).toBe("A2");

    const b1Ids = LESSONS.filter((lesson) => lesson.level === "B1").map((lesson) => lesson.id);
    expect(nextLessonFor({ level: "B1" }, b1Ids)?.level).toBe("B2");
  });

  it("serves translated higher-level lesson copy to A2 Portuguese learners", () => {
    const a2Ids = LESSONS.filter((lesson) => lesson.level === "A2").map((lesson) => lesson.id);
    const lesson = nextLessonFor({ level: "A2" }, a2Ids);
    const lang = resolveInterfaceLang({ level: "A2", nativeLang: "pt" });

    expect(lesson?.level).toBe("B1");
    expect(lang).toBe("pt");
    expect(translate(lang, lesson?.title ?? "")).toBe("Lição 16 — Opiniões e concordância");
    expect(translate(lang, lesson?.topic ?? "")).toBe("Dar opiniões e reagir a elas");
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
