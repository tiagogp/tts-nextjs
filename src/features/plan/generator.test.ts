import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningPlan, PlanGenerationResult, PlanMeta } from "./schema";

const storeMock = vi.hoisted(() => ({
  buildPlan: vi.fn(
    (meta: PlanMeta, result: PlanGenerationResult): LearningPlan => ({
      id: "built-plan",
      createdAt: 1,
      startsOn: "2026-08-13",
      meta,
      phases: result.phases,
      days: result.days.map((day) => ({
        date: `day-${day.dayNumber}`,
        phase: day.phase,
        estimatedMinutes: day.estimatedMinutes,
        tasks: day.tasks.map((task, index) => ({ id: `${day.dayNumber}-${index}`, ...task })),
      })),
    }),
  ),
  savePlan: vi.fn(async () => undefined),
}));

vi.mock("./store", () => ({
  buildPlan: storeMock.buildPlan,
  savePlan: storeMock.savePlan,
}));

import { alignBlockDays, generateAndSavePlan, normalizePhases } from "./generator";

const meta: PlanMeta = {
  goal: "Falar em reuniões sem travar",
  currentLevel: "A2",
  targetLevel: "B1",
  availabilityMinutes: 20,
  planDays: 30,
  language: "English",
  objective: "conversation",
};

const phases = [
  { number: 1, title: "P1", focus: "listening", startDay: 1, endDay: 10 },
  { number: 2, title: "P2", focus: "output", startDay: 11, endDay: 20 },
  { number: 3, title: "P3", focus: "fluency", startDay: 21, endDay: 30 },
];

function day(dayNumber: number) {
  return {
    dayNumber,
    phase: 1,
    estimatedMinutes: 20,
    tasks: [{ type: "study" as const, instruction: `Study day ${dayNumber}` }],
  };
}

interface DayRequest {
  startDay: number;
  endDay: number;
  counts?: Record<string, number>;
  recentDays?: Array<{ dayNumber: number; instructions: string[] }>;
}

/** Fake both plan endpoints; `dayHandler` decides what each block answers. */
function mockFetch(
  dayHandler: (req: DayRequest, callIndex: number) => { status?: number; days?: unknown },
) {
  const dayRequests: DayRequest[] = [];
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as DayRequest;
    if (url === "/api/plan") {
      return { ok: true, json: async () => ({ phases }) };
    }
    dayRequests.push(body);
    const result = dayHandler(body, dayRequests.length - 1);
    if (result.status) {
      return { ok: false, status: result.status, json: async () => ({ error: "boom" }) };
    }
    return { ok: true, json: async () => ({ days: result.days }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, dayRequests };
}

const rangeDays = (req: DayRequest) =>
  Array.from({ length: req.endDay - req.startDay + 1 }, (_, index) => day(req.startDay + index));

beforeEach(() => {
  storeMock.buildPlan.mockClear();
  storeMock.savePlan.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chunked plan generation", () => {
  it("asks for one block of 14 days at a time and stitches them together", async () => {
    const { dayRequests } = mockFetch((req) => ({ days: rangeDays(req) }));

    const plan = await generateAndSavePlan({ meta, provider: "openrouter" });

    expect(dayRequests.map((req) => [req.startDay, req.endDay])).toEqual([
      [1, 14],
      [15, 28],
      [29, 30],
    ]);
    expect(plan.days).toHaveLength(30);
    expect(storeMock.savePlan).toHaveBeenCalledOnce();
  });

  it("reports progress after each block", async () => {
    mockFetch((req) => ({ days: rangeDays(req) }));
    const progress: number[] = [];

    await generateAndSavePlan({
      meta,
      provider: "openrouter",
      onProgress: (completed) => progress.push(completed),
    });

    expect(progress).toEqual([14, 28, 30]);
  });

  it("carries what was already written into the next block", async () => {
    const { dayRequests } = mockFetch((req) => ({ days: rangeDays(req) }));

    await generateAndSavePlan({ meta, provider: "openrouter" });

    expect(dayRequests[0].counts).toEqual({});
    expect(dayRequests[1].counts).toEqual({ study: 14 });
    expect(dayRequests[1].recentDays?.map((entry) => entry.dayNumber)).toEqual([12, 13, 14]);
  });

  it("renumbers a block that restarts its own day count", async () => {
    mockFetch((req) =>
      req.startDay === 15
        ? { days: Array.from({ length: 14 }, (_, index) => day(index + 1)) }
        : { days: rangeDays(req) },
    );

    const plan = await generateAndSavePlan({ meta, provider: "openrouter" });

    expect(storeMock.buildPlan.mock.calls[0][1].days.map((d) => d.dayNumber)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(plan.days).toHaveLength(30);
  });

  it("tops up a block that came back short", async () => {
    mockFetch((req) => ({ days: req.startDay === 1 ? [day(1), day(2)] : rangeDays(req) }));

    const plan = await generateAndSavePlan({ meta, provider: "openrouter" });

    expect(plan.days).toHaveLength(30);
    expect(plan.days.every((d) => d.tasks.length > 0)).toBe(true);
  });

  it("retries a failed block once before filling it deterministically", async () => {
    const { fetchMock, dayRequests } = mockFetch((req, callIndex) =>
      req.startDay === 1 && callIndex < 2 ? { status: 500 } : { days: rangeDays(req) },
    );

    const plan = await generateAndSavePlan({ meta, provider: "openrouter" });

    expect(dayRequests.filter((req) => req.startDay === 1)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(5); // skeleton + 2 failed attempts + 2 later blocks
    expect(plan.days).toHaveLength(30);
  });

  it("gives up when two blocks in a row fail, instead of faking a whole plan", async () => {
    mockFetch(() => ({ status: 500 }));

    await expect(generateAndSavePlan({ meta, provider: "openrouter" })).rejects.toThrow();
    expect(storeMock.savePlan).not.toHaveBeenCalled();
  });
});

describe("normalizePhases", () => {
  it("closes gaps so every day resolves to a phase", () => {
    const repaired = normalizePhases(
      [
        { number: 1, title: "A", focus: "a", startDay: 1, endDay: 9 },
        { number: 2, title: "B", focus: "b", startDay: 20, endDay: 25 },
      ],
      30,
    );

    expect(repaired.map((phase) => [phase.startDay, phase.endDay])).toEqual([
      [1, 9],
      [10, 30],
    ]);
  });

  it("falls back to a single phase when the provider returned none", () => {
    expect(normalizePhases([], 30)).toEqual([
      { number: 1, title: "Plan", focus: "Daily practice", startDay: 1, endDay: 30 },
    ]);
  });
});

describe("alignBlockDays", () => {
  it("drops extra days the provider invented past the range", () => {
    const aligned = alignBlockDays(
      [day(1), day(2), day(3), day(4)],
      1,
      3,
      () => [],
      () => 1,
    );
    expect(aligned.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
  });
});
