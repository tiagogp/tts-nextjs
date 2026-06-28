import { describe, expect, it } from "vitest";
import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import { Rating, State, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";
import { deriveSkillStates, skillOfCard, SKILLS } from "./skillState";

const NOW = Date.UTC(2026, 5, 28); // 2026-06-28
const DAY = 86_400_000;

function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id,
    front: "f",
    back: "b",
    concept: "c",
    source: { kind: "phrase", id: "p" },
    createdAt: NOW,
    ...over,
  };
}

function srs(cardId: string, over: Partial<SrsRecord> = {}): SrsRecord {
  return {
    cardId,
    due: NOW,
    stability: 21,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: State.Review,
    ...over,
  };
}

function review(cardId: string, grade: Grade, over: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: `${cardId}-${over.reviewedAt ?? NOW}-${Math.random()}`,
    cardId,
    grade,
    reviewedAt: NOW,
    previousState: State.Review,
    scheduledDays: 1,
    concept: "c",
    ...over,
  };
}

function pron(cardId: string, overall: number, over: Partial<PronunciationAttempt> = {}): PronunciationAttempt {
  return {
    id: `${cardId}-pron`,
    cardId,
    createdAt: NOW,
    targetLang: "en",
    source: "study",
    targetText: "t",
    transcript: "t",
    scores: { overall, accuracy: overall, completeness: overall, fluency: overall },
    words: [],
    tips: [],
    ...over,
  };
}

describe("skillOfCard", () => {
  it("prefers an explicit tag", () => {
    expect(skillOfCard(card("a", { skill: "grammar", audioClipPath: "/x.mp3" }))).toBe("grammar");
  });

  it("classifies a spoken card as speaking", () => {
    expect(skillOfCard(card("a", { audioClipPath: "/x.mp3" }), { hasSpeechAttempt: true })).toBe(
      "speaking",
    );
  });

  it("classifies a native-audio card as listening", () => {
    expect(skillOfCard(card("a", { audioClipPath: "/x.mp3" }))).toBe("listening");
  });

  it("classifies grammatical error types as grammar", () => {
    expect(skillOfCard(card("a", { errorType: "tense" }))).toBe("grammar");
    expect(skillOfCard(card("a", { errorType: "article" }))).toBe("grammar");
  });

  it("falls back to vocabulary", () => {
    expect(skillOfCard(card("a", { errorType: "idiom" }))).toBe("vocabulary");
    expect(skillOfCard(card("a"))).toBe("vocabulary");
  });
});

describe("deriveSkillStates", () => {
  it("returns an all-zero state for an untouched skill", () => {
    const states = deriveSkillStates([], [], [], [], NOW);
    for (const skill of SKILLS) {
      expect(states[skill]).toEqual({ proficiency: 0, fatigue: 0, due: 0, reviews: 0 });
    }
  });

  it("scales proficiency by stability — solid accuracy on fragile cards stays low", () => {
    const cards = [{ card: card("v1"), srs: srs("v1", { stability: 2 }) }];
    const reviews = [review("v1", Rating.Good), review("v1", Rating.Good)];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    // accuracy 1.0 but stability 2/21 ≈ 0.095 → proficiency stays modest.
    expect(states.vocabulary.proficiency).toBeGreaterThan(0);
    expect(states.vocabulary.proficiency).toBeLessThan(0.2);
  });

  it("rewards accuracy on well-stabilized cards", () => {
    const cards = [{ card: card("v1"), srs: srs("v1", { stability: 60 }) }];
    const reviews = [review("v1", Rating.Good), review("v1", Rating.Easy)];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    expect(states.vocabulary.proficiency).toBeCloseTo(1, 5); // accuracy 1 × clamp(60/21)=1
  });

  it("raises fatigue on a recent failure run", () => {
    const cards = [{ card: card("v1"), srs: srs("v1") }];
    const reviews = [
      review("v1", Rating.Again, { reviewedAt: NOW - 100 }),
      review("v1", Rating.Again, { reviewedAt: NOW - 50 }),
      review("v1", Rating.Again, { reviewedAt: NOW }),
    ];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    expect(states.vocabulary.fatigue).toBeGreaterThan(0.4);
  });

  it("raises fatigue on slow answers", () => {
    const cards = [{ card: card("v1"), srs: srs("v1") }];
    const reviews = [
      review("v1", Rating.Good, { latencyMs: 14_000 }),
      review("v1", Rating.Good, { latencyMs: 16_000 }),
    ];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    // no lapses, but slow → fatigue from the latency term (0.35 weight, saturated).
    expect(states.vocabulary.fatigue).toBeGreaterThan(0.3);
  });

  it("counts only due cards toward `due`", () => {
    const cards = [
      { card: card("v1"), srs: srs("v1", { due: NOW - DAY }) },
      { card: card("v2"), srs: srs("v2", { due: NOW + DAY }) },
    ];
    const states = deriveSkillStates([review("v1", Rating.Good)], cards, [], [], NOW);
    expect(states.vocabulary.due).toBe(1);
  });

  it("routes audio cards to listening and grammar error types to grammar", () => {
    const cards = [
      { card: card("l1", { audioClipPath: "/clip.mp3" }), srs: srs("l1", { stability: 60 }) },
      { card: card("g1", { errorType: "tense" }), srs: srs("g1", { stability: 60 }) },
    ];
    const reviews = [review("l1", Rating.Good), review("g1", Rating.Again)];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    expect(states.listening.proficiency).toBeGreaterThan(0);
    expect(states.listening.reviews).toBe(1);
    expect(states.grammar.reviews).toBe(1);
    expect(states.vocabulary.reviews).toBe(0);
  });

  it("uses pronunciation scores for speaking proficiency", () => {
    const cards = [{ card: card("s1"), srs: srs("s1", { stability: 60 }) }];
    const attempts = [pron("s1", 90), pron("s1", 80)];
    const states = deriveSkillStates([], cards, attempts, [], NOW);
    // a spoken card becomes a speaking card; proficiency ≈ mean(0.9,0.8) × stability 1.
    expect(states.speaking.proficiency).toBeCloseTo(0.85, 2);
  });

  it("folds recent production errors into fatigue", () => {
    const cards = [{ card: card("g1", { errorType: "article" }), srs: srs("g1") }];
    const reviews = [review("g1", Rating.Good)];
    const errors: ErrorEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      original: "x",
      corrected: "y",
      errorTypes: ["article"],
      sourceLang: "pt",
      targetLang: "en",
      createdAt: NOW - i,
    }));
    const without = deriveSkillStates(reviews, cards, [], [], NOW).grammar.fatigue;
    const withErrors = deriveSkillStates(reviews, cards, [], errors, NOW).grammar.fatigue;
    expect(withErrors).toBeGreaterThan(without);
  });

  it("classifies reviews of deleted cards by their denormalized errorType", () => {
    // No current cards, but a review log survives carrying a grammar errorType.
    const reviews = [review("gone", Rating.Again, { errorType: "word-order" })];
    const states = deriveSkillStates(reviews, [], [], [], NOW);
    expect(states.grammar.reviews).toBe(1);
    expect(states.vocabulary.reviews).toBe(0);
  });

  it("counts reviews within the recent window only", () => {
    const cards = [{ card: card("v1"), srs: srs("v1") }];
    const reviews = [
      review("v1", Rating.Good, { reviewedAt: NOW }),
      review("v1", Rating.Good, { reviewedAt: NOW - 30 * DAY }),
    ];
    const states = deriveSkillStates(reviews, cards, [], [], NOW);
    expect(states.vocabulary.reviews).toBe(1);
  });
});
