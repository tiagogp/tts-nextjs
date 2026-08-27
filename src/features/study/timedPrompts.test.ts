import { describe, expect, it } from "vitest";
import { PREPARATION_SECONDS, RESPONSE_SECONDS, TIMED_PROMPTS, dailySeed, selectTimedPrompts } from "./timedPrompts";

describe("timed prompts", () => {
  it("never offers a question above the learner's level", () => {
    const chosen = selectTimedPrompts({ level: "A2", count: 20 });
    expect(chosen.every((prompt) => ["A1", "A2"].includes(prompt.level))).toBe(true);
  });

  it("prefers questions the learner has not answered", () => {
    const answered = TIMED_PROMPTS.filter((p) => p.level === "A2").slice(0, 5).map((p) => p.id);
    const [chosen] = selectTimedPrompts({ level: "A2", answered });
    expect(answered).not.toContain(chosen.id);
  });

  it("falls back to a repeat rather than returning nothing", () => {
    const all = TIMED_PROMPTS.map((prompt) => prompt.id);
    expect(selectTimedPrompts({ level: "B1", answered: all })).toHaveLength(1);
  });

  it("does not ask two questions on the same topic in one session", () => {
    const chosen = selectTimedPrompts({ level: "B1", count: 5 });
    expect(new Set(chosen.map((p) => p.topic)).size).toBe(chosen.length);
  });

  it("changes the question from day to day but not within a day", () => {
    const day = 86_400_000;
    const monday = Date.UTC(2026, 7, 24, 9);
    expect(dailySeed(monday)).toBe(dailySeed(monday + 3 * 3600_000));
    expect(dailySeed(monday)).not.toBe(dailySeed(monday + day));
  });

  it("gives seconds to think, not minutes", () => {
    expect(PREPARATION_SECONDS).toBeLessThanOrEqual(10);
    expect(RESPONSE_SECONDS).toBeLessThanOrEqual(45);
  });

  it("has a usable bank at both target levels", () => {
    expect(TIMED_PROMPTS.filter((p) => p.level === "A2").length).toBeGreaterThanOrEqual(8);
    expect(TIMED_PROMPTS.filter((p) => p.level === "B1").length).toBeGreaterThanOrEqual(8);
  });
});
