import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningProfile } from "@/features/settings/learningProfile";
import type { LearningPlan, PlanMeta } from "./schema";

const storeMock = vi.hoisted(() => {
  const state = { activePlan: null as LearningPlan | null };
  return {
    state,
    buildPlan: vi.fn((meta: PlanMeta): LearningPlan => ({
      id: "built-plan",
      createdAt: 1,
      startsOn: "2026-06-28",
      meta,
      phases: [],
      days: [],
    })),
    getActivePlan: vi.fn(async () => state.activePlan),
    savePlan: vi.fn(async () => undefined),
  };
});

vi.mock("./store", () => ({
  buildPlan: storeMock.buildPlan,
  getActivePlan: storeMock.getActivePlan,
  savePlan: storeMock.savePlan,
}));

import { defaultPlanIdForLevel, ensureDefaultPlan } from "./defaultPlans";

const profile: LearningProfile = {
  level: "A1",
  nativeLang: "pt",
  targetLang: "en",
  track: "beginner",
  focus: "",
  goal: 3,
  createdAt: 1,
  onboardingCompleted: true,
  unlockedTabTier: 0,
  c1Domain: "",
};

describe("default plans", () => {
  beforeEach(() => {
    storeMock.state.activePlan = null;
    storeMock.buildPlan.mockClear();
    storeMock.getActivePlan.mockClear();
    storeMock.savePlan.mockClear();
  });

  it("selects the foundational plan for A1, A2, and B1", () => {
    expect(defaultPlanIdForLevel("A1")).toBe("a1-b1");
    expect(defaultPlanIdForLevel("A2")).toBe("a1-b1");
    expect(defaultPlanIdForLevel("B1")).toBe("a1-b1");
  });

  it("selects the advanced plan for B2, C1, and C2", () => {
    expect(defaultPlanIdForLevel("B2")).toBe("b2-c1");
    expect(defaultPlanIdForLevel("C1")).toBe("b2-c1");
    expect(defaultPlanIdForLevel("C2")).toBe("b2-c1");
  });

  it("creates a default plan only when no active plan exists", async () => {
    const plan = await ensureDefaultPlan(profile);

    expect(plan?.id).toBe("built-plan");
    expect(storeMock.getActivePlan).toHaveBeenCalledTimes(1);
    expect(storeMock.buildPlan).toHaveBeenCalledTimes(1);
    expect(storeMock.savePlan).toHaveBeenCalledTimes(1);
  });

  it("returns the active plan without creating another one", async () => {
    storeMock.state.activePlan = {
      id: "active-plan",
      createdAt: 1,
      startsOn: "2026-06-28",
      meta: {
        goal: "Reach B1",
        currentLevel: "A1",
        targetLevel: "B1",
        availabilityMinutes: 30,
        planDays: 90,
        language: "English",
      },
      phases: [],
      days: [],
    };

    const plan = await ensureDefaultPlan(profile);

    expect(plan?.id).toBe("active-plan");
    expect(storeMock.getActivePlan).toHaveBeenCalledTimes(1);
    expect(storeMock.buildPlan).not.toHaveBeenCalled();
    expect(storeMock.savePlan).not.toHaveBeenCalled();
  });
});
