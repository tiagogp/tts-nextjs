import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningPlan, PlanMeta } from "./schema";
import type { GeneratePlanOptions } from "./generator";

const generatorMock = vi.hoisted(() => ({ generateAndSavePlan: vi.fn() }));

vi.mock("./generator", () => ({ generateAndSavePlan: generatorMock.generateAndSavePlan }));

const meta: PlanMeta = {
  goal: "Falar em reuniões sem travar",
  currentLevel: "A2",
  targetLevel: "B1",
  availabilityMinutes: 20,
  planDays: 30,
  language: "English",
  objective: "conversation",
};

const plan = { id: "plan-1", meta } as LearningPlan;

const request = { meta, provider: "openrouter" as const };

async function loadJob() {
  vi.resetModules();
  return import("./generationJob");
}

beforeEach(() => {
  generatorMock.generateAndSavePlan.mockReset();
});

describe("background plan generation job", () => {
  it("moves from running to done and keeps the plan for the toast", async () => {
    let resolve: (value: LearningPlan) => void = () => {};
    generatorMock.generateAndSavePlan.mockImplementation(
      () => new Promise<LearningPlan>((res) => (resolve = res)),
    );
    const job = await loadJob();

    job.startPlanGeneration(request);
    expect(job.getPlanJobState()).toEqual({ status: "running", planDays: 30, completedDays: 0 });

    resolve(plan);
    await vi.waitFor(() => expect(job.getPlanJobState().status).toBe("done"));
    expect(job.getPlanJobState()).toEqual({ status: "done", plan });
  });

  it("publishes each block's progress while it runs", async () => {
    let emit: (completedDays: number) => void = () => {};
    let finish: (value: LearningPlan) => void = () => {};
    generatorMock.generateAndSavePlan.mockImplementation(
      (opts: GeneratePlanOptions) =>
        new Promise<LearningPlan>((res) => {
          emit = (completedDays) => opts.onProgress?.(completedDays, 30);
          finish = res;
        }),
    );
    const job = await loadJob();
    const completed = () => {
      const state = job.getPlanJobState();
      return state.status === "running" ? state.completedDays : null;
    };

    job.startPlanGeneration(request);
    expect(completed()).toBe(0);

    emit(14);
    expect(completed()).toBe(14);
    emit(28);
    expect(completed()).toBe(28);

    finish(plan);
    await vi.waitFor(() => expect(job.getPlanJobState().status).toBe("done"));
  });

  it("ignores a second start while one is already running", async () => {
    generatorMock.generateAndSavePlan.mockImplementation(() => new Promise<LearningPlan>(() => {}));
    const job = await loadJob();

    job.startPlanGeneration(request);
    job.startPlanGeneration(request);

    expect(generatorMock.generateAndSavePlan).toHaveBeenCalledOnce();
    expect(job.isPlanGenerationRunning()).toBe(true);
  });

  it("surfaces a failure and can retry the same request", async () => {
    generatorMock.generateAndSavePlan.mockRejectedValueOnce(new Error("provider down"));
    const job = await loadJob();

    job.startPlanGeneration(request);
    await vi.waitFor(() => expect(job.getPlanJobState().status).toBe("error"));

    generatorMock.generateAndSavePlan.mockResolvedValueOnce(plan);
    job.retryPlanGeneration();
    await vi.waitFor(() => expect(job.getPlanJobState().status).toBe("done"));
  });

  it("cancelling aborts the run and clears the toast", async () => {
    let seenSignal: AbortSignal | undefined;
    generatorMock.generateAndSavePlan.mockImplementation(async (opts: GeneratePlanOptions) => {
      seenSignal = opts.signal;
      return new Promise<LearningPlan>(() => {});
    });
    const job = await loadJob();

    job.startPlanGeneration(request);
    job.cancelPlanGeneration();

    expect(seenSignal?.aborted).toBe(true);
    expect(job.getPlanJobState()).toEqual({ status: "idle" });
  });
});
