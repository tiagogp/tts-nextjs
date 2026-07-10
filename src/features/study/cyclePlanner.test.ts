import { describe, expect, it } from "vitest";
import type { Skill } from "@/lib/cards/schema";
import type { SkillState } from "@/lib/srs/skillState";
import { deriveCyclePlan, type CyclePath } from "./cyclePlanner";

function states(over: Partial<Record<Skill, Partial<SkillState>>> = {}): Record<Skill, SkillState> {
  const base: SkillState = { proficiency: 0, fatigue: 0, due: 0, reviews: 0 };
  const skills: Skill[] = ["vocabulary", "grammar", "listening", "speaking"];
  const out = {} as Record<Skill, SkillState>;
  for (const s of skills) out[s] = { ...base, ...over[s] };
  return out;
}

function recommended(plan: { options: { path: CyclePath; recommended: boolean }[] }): CyclePath {
  return plan.options.find((o) => o.recommended)!.path;
}

describe("deriveCyclePlan", () => {
  it("recommends review when cards are due and the learner isn't drained", () => {
    const plan = deriveCyclePlan(
      states({ vocabulary: { fatigue: 0.1, reviews: 6 } }),
      { due: 8, lightAvailable: true },
    );
    expect(plan.recommended).toBe("review");
    expect(recommended(plan)).toBe("review");
  });

  it("recommends light when fatigue is high and a light round is available — even with cards due", () => {
    const plan = deriveCyclePlan(
      states({ vocabulary: { fatigue: 0.8, reviews: 6 } }),
      { due: 8, lightAvailable: true },
    );
    expect(plan.recommended).toBe("light");
  });

  it("recommends challenge when caught up, fresh, and not fatigued", () => {
    const plan = deriveCyclePlan(
      states({ vocabulary: { proficiency: 0.8, fatigue: 0.1, reviews: 6 } }),
      { due: 0, lightAvailable: false },
    );
    expect(plan.recommended).toBe("challenge");
  });

  it("falls back to review when fatigued but no light round is available", () => {
    const plan = deriveCyclePlan(
      states({ vocabulary: { fatigue: 0.9, reviews: 6 } }),
      { due: 5, lightAvailable: false },
    );
    expect(plan.recommended).toBe("review");
  });

  it("falls back to challenge when fatigued, caught up, and no light round available", () => {
    const plan = deriveCyclePlan(
      states({ vocabulary: { fatigue: 0.9, reviews: 6 } }),
      { due: 0, lightAvailable: false },
    );
    expect(plan.recommended).toBe("challenge");
  });

  it("always recommends an available path, so 'just start' is safe", () => {
    const inputs = [
      { due: 0, lightAvailable: false },
      { due: 3, lightAvailable: false },
      { due: 0, lightAvailable: true },
    ];
    for (const i of inputs) {
      const plan = deriveCyclePlan(states({ vocabulary: { fatigue: 0.9, reviews: 4 } }), i);
      const rec = plan.options.find((o) => o.recommended)!;
      expect(rec.available).toBe(true);
    }
  });

  it("weights fatigue by reviews — a dormant calm skill can't dilute a fresh fatigued one", () => {
    const plan = deriveCyclePlan(
      states({
        speaking: { fatigue: 0.85, reviews: 6 },
        vocabulary: { fatigue: 0, reviews: 0 },
        grammar: { fatigue: 0, reviews: 0 },
        listening: { fatigue: 0, reviews: 0 },
      }),
      { due: 4, lightAvailable: true },
    );
    expect(plan.recommended).toBe("light");
  });

  it("returns options ordered [challenge, review, light] with exactly one recommended", () => {
    const plan = deriveCyclePlan(states({ vocabulary: { reviews: 3 } }), {
      due: 2,
      lightAvailable: true,
    });
    expect(plan.options.map((o) => o.path)).toEqual(["challenge", "review", "light"]);
    expect(plan.options.filter((o) => o.recommended)).toHaveLength(1);
  });

  it("scales the review load estimate with the due count (~1 min/card)", () => {
    const plan = deriveCyclePlan(states({ vocabulary: { reviews: 3 } }), {
      due: 8,
      lightAvailable: false,
    });
    const review = plan.options.find((o) => o.path === "review")!;
    expect(review.load).toBe("~8 min focused");
  });

  it("treats an all-zero (untouched) profile as calm — no false fatigue", () => {
    const plan = deriveCyclePlan(states(), { due: 5, lightAvailable: true });
    expect(plan.recommended).toBe("review");
  });
});
