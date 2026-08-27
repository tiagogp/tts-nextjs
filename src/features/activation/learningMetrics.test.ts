import { describe, expect, it } from "vitest";
import type { ListeningAttempt, ProductionAttempt } from "@/lib/performance/types";
import {
  activeVocabulary,
  coldListening,
  patternErrorRates,
  patternErrorReduction,
  productionLatency,
} from "./learningMetrics";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const attempt = (over: Partial<ProductionAttempt> = {}): ProductionAttempt => ({
  id: crypto.randomUUID(), source: "study", text: "", spoken: false, wordCount: 0,
  finished: true, issueCount: 0, createdAt: NOW, ...over,
});

describe("patternErrorRates", () => {
  it("ranks by error per opportunity, not by raw count", () => {
    // The audit's case: 3 errors in 4 attempts is worse than 5 in 40, and a count ranking
    // gets it exactly backwards.
    const attempts = [
      ...Array.from({ length: 40 }, (_, i) => attempt({
        targetPatternId: "used-to", errorTypesFound: i < 5 ? ["tense"] : [], createdAt: NOW - i * 1000,
      })),
      ...Array.from({ length: 4 }, (_, i) => attempt({
        targetPatternId: "ended-up", errorTypesFound: i < 3 ? ["preposition"] : [], createdAt: NOW - i * 1000,
      })),
    ];
    const ranked = patternErrorRates(attempts);
    expect(ranked[0]).toMatchObject({ patternId: "ended-up", errors: 3, opportunities: 4 });
    expect(ranked[0].rate).toBeCloseTo(0.75);
    expect(ranked[1]).toMatchObject({ patternId: "used-to", errors: 5, opportunities: 40 });
    expect(ranked[1].rate).toBeCloseTo(0.125);
  });

  it("returns null rather than a rate below the sample floor", () => {
    expect(patternErrorRates([
      attempt({ targetPatternId: "ended-up", errorTypesFound: ["tense"] }),
    ])[0].rate).toBeNull();
  });

  it("ignores attempts with no target pattern or no evaluator verdict", () => {
    expect(patternErrorRates([
      attempt({ targetPatternId: undefined, errorTypesFound: ["tense"] }),
      attempt({ targetPatternId: "ended-up", errorTypesFound: undefined }),
    ])).toHaveLength(0);
  });

  it("names the error types behind a pattern's rate", () => {
    const attempts = Array.from({ length: 4 }, () =>
      attempt({ targetPatternId: "ended-up", errorTypesFound: ["preposition"] }));
    expect(patternErrorRates(attempts)[0].types).toEqual(["preposition"]);
  });
});

describe("patternErrorReduction", () => {
  it("compares rate per opportunity across two windows", () => {
    const older = Array.from({ length: 10 }, (_, i) => attempt({
      targetPatternId: "ended-up", errorTypesFound: i < 6 ? ["tense"] : [], createdAt: NOW - 45 * DAY,
    }));
    const newer = Array.from({ length: 10 }, (_, i) => attempt({
      targetPatternId: "ended-up", errorTypesFound: i < 2 ? ["tense"] : [], createdAt: NOW - 5 * DAY,
    }));
    const [trend] = patternErrorReduction([...older, ...newer], { now: NOW });
    expect(trend.recent.rate).toBeCloseTo(0.2);
    expect(trend.previous.rate).toBeCloseTo(0.6);
    expect(trend.change).toBeCloseTo(-0.4);
  });

  it("reports null change when there is no earlier window to compare with", () => {
    const only = Array.from({ length: 5 }, () =>
      attempt({ targetPatternId: "ended-up", errorTypesFound: ["tense"], createdAt: NOW }));
    expect(patternErrorReduction(only, { now: NOW })[0].change).toBeNull();
  });
});

describe("activeVocabulary", () => {
  it("counts a word only after two unaided uses a week apart", () => {
    const once = activeVocabulary([attempt({ text: "I cancelled the trip", createdAt: NOW - 30 * DAY })]);
    expect(once.size).toBe(0);
    expect(once.emerging).toBeGreaterThan(0);

    const twice = activeVocabulary([
      attempt({ text: "I cancelled the trip", createdAt: NOW - 30 * DAY }),
      attempt({ text: "We cancelled everything", createdAt: NOW - 10 * DAY }),
    ]);
    expect(twice.lemmas).toContain("cancel");
  });

  it("does not count the same word twice in one week", () => {
    const result = activeVocabulary([
      attempt({ text: "I cancelled the trip", createdAt: NOW - 3 * DAY }),
      attempt({ text: "I cancelled it again", createdAt: NOW - 2 * DAY }),
    ]);
    expect(result.size).toBe(0);
  });

  it("ignores scaffolded and skipped attempts", () => {
    const result = activeVocabulary([
      attempt({ text: "I cancelled the trip", createdAt: NOW - 30 * DAY, scaffoldUsed: true }),
      attempt({ text: "I cancelled the trip", createdAt: NOW - 10 * DAY, skipped: true }),
    ]);
    expect(result.samples).toBe(0);
    expect(result.size).toBe(0);
  });

  it("folds inflections of one word together", () => {
    const result = activeVocabulary([
      attempt({ text: "I am cancelling it", createdAt: NOW - 30 * DAY }),
      attempt({ text: "She cancels everything", createdAt: NOW - 10 * DAY }),
    ]);
    expect(result.lemmas).toContain("cancel");
  });
});

describe("productionLatency", () => {
  const mastered = new Set(["ended-up"]);

  it("is null before any mastered item has been timed", () => {
    expect(productionLatency([], mastered, { now: NOW }).medianMs).toBeNull();
  });

  it("only counts unaided attempts on mastered patterns", () => {
    const result = productionLatency([
      attempt({ targetPatternId: "ended-up", preparationMs: 4000, createdAt: NOW - DAY }),
      attempt({ targetPatternId: "brand-new", preparationMs: 30000, createdAt: NOW - DAY }),
      attempt({ targetPatternId: "ended-up", preparationMs: 90000, createdAt: NOW - DAY, scaffoldUsed: true }),
    ], mastered, { now: NOW });
    expect(result).toMatchObject({ medianMs: 4000, samples: 1 });
  });

  it("reports the change against the previous window", () => {
    const result = productionLatency([
      attempt({ targetPatternId: "ended-up", preparationMs: 9000, createdAt: NOW - 45 * DAY }),
      attempt({ targetPatternId: "ended-up", preparationMs: 4000, createdAt: NOW - 5 * DAY }),
    ], mastered, { now: NOW });
    expect(result.changeMs).toBe(-5000);
  });
});

describe("coldListening", () => {
  const listening = (over: Partial<ListeningAttempt> = {}): ListeningAttempt => ({
    id: crypto.randomUUID(), lessonId: "l1", sourceId: "s1", questions: [], answers: [],
    questionCount: 2, answeredCount: 2, correctCount: 2, mainIdeaCorrect: true,
    detailCorrect: 1, detailTotal: 1, playCounts: [1, 1], transcriptVisible: false,
    playbackRate: 1, speakerIds: ["v1"], speakerFamiliarity: "unfamiliar",
    startedAt: NOW, completedAt: NOW, ...over,
  });

  it("names the reason when the learner has only ever heard the built-in voice", () => {
    // This is the default state of the app, not a bug: the metric must say so rather than
    // showing 0%, which reads as "understands none of it".
    const result = coldListening([listening({ speakerFamiliarity: "familiar" })]);
    expect(result.rate).toBeNull();
    expect(result.unmeasuredReason).toBe("no_unfamiliar_audio");
  });

  it("distinguishes no attempts from no unfamiliar audio", () => {
    expect(coldListening([]).unmeasuredReason).toBe("no_attempts");
  });

  it("excludes replays, subtitles and slowed audio", () => {
    expect(coldListening([listening({ playCounts: [2, 1] })]).rate).toBeNull();
    expect(coldListening([listening({ subtitleUsed: true })]).rate).toBeNull();
    expect(coldListening([listening({ playbackRate: 0.8, playbackRates: [0.8] })]).rate).toBeNull();
  });

  it("scores a genuine cold check", () => {
    expect(coldListening([
      listening({ mainIdeaCorrect: true }),
      listening({ mainIdeaCorrect: false }),
    ])).toMatchObject({ attempts: 2, correct: 1, rate: 0.5 });
  });
});
