import { describe, expect, it } from "vitest";
import type { PlanGenerationResult } from "./schema";
import { applyObjectiveDistribution, countTaskAreas } from "./objectivePolicy";

const base: PlanGenerationResult = {
  phases: [],
  days: Array.from({ length: 14 }, (_, index) => ({
    dayNumber: index + 1,
    phase: 1,
    estimatedMinutes: 20,
    tasks: [{ type: "study", instruction: "Study" }],
  })),
};

describe("objective-aware plan composition", () => {
  it("keeps speaking on day one", () => {
    const shaped = applyObjectiveDistribution(base, "academic");
    expect(shaped.days[0].tasks.map((item) => item.type)).toContain("converse");
  });

  it("produces different mixes for different objectives", () => {
    const conversation = countTaskAreas(applyObjectiveDistribution(base, "conversation"));
    const academic = countTaskAreas(applyObjectiveDistribution(base, "academic"));
    expect(conversation.speaking).toBeGreaterThan(academic.speaking);
    expect(academic.readingWriting).toBeGreaterThan(conversation.readingWriting);
  });

  it("adds dedicated reading and writing tasks for academic learners", () => {
    const shaped = applyObjectiveDistribution(base, "academic");
    const readWrite = shaped.days.flatMap((day) => day.tasks.filter((item) => item.type === "readWrite"));
    expect(readWrite.some((item) => item.targetMetric?.action === "reading_comprehension")).toBe(true);
    expect(readWrite.some((item) => item.targetMetric?.action === "writing_production")).toBe(true);
  });
});
