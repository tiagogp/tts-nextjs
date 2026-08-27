import type { ProviderKind } from "@/lib/cards/provider";
import type { LearningPlan, Phase, PlanGenerationResult, PlanMeta, TaskType } from "./schema";
import { PLAN_CHUNK_DAYS } from "./constants";
import { fallbackDays } from "./objectivePolicy";
import type { ChunkContext } from "./prompts";
import { buildPlan, savePlan } from "./store";

type GeneratedDay = PlanGenerationResult["days"][number];

export interface GeneratePlanOptions {
  meta: PlanMeta;
  provider: ProviderKind;
  ollamaModel?: string;
  /** Called after each block lands, so the caller can show real progress. */
  onProgress?: (completedDays: number, totalDays: number) => void;
  signal?: AbortSignal;
}

/** Two consecutive dead blocks mean the provider is down, not that one answer was malformed. */
const MAX_CONSECUTIVE_BLOCK_FAILURES = 2;
const RECENT_DAYS_CONTEXT = 3;

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? `Plan generation failed (${res.status})`);
  }
  return data;
}

/**
 * The provider decides phase boundaries, so they are repaired before use: the
 * calendar and every block prompt need day 1..planDays to resolve to a phase.
 */
export function normalizePhases(phases: Phase[], planDays: number): Phase[] {
  const sorted = [...phases].sort((left, right) => left.startDay - right.startDay);
  const repaired: Phase[] = [];
  let cursor = 1;

  sorted.forEach((phase, index) => {
    if (cursor > planDays) return;
    const isLast = index === sorted.length - 1;
    const endDay = isLast ? planDays : Math.max(cursor, Math.min(phase.endDay, planDays));
    repaired.push({ ...phase, number: repaired.length + 1, startDay: cursor, endDay });
    cursor = endDay + 1;
  });

  if (repaired.length === 0) {
    return [{ number: 1, title: "Plan", focus: "Daily practice", startDay: 1, endDay: planDays }];
  }
  repaired[repaired.length - 1].endDay = planDays;
  return repaired;
}

function phaseResolver(phases: Phase[]): (dayNumber: number) => number {
  return (dayNumber) =>
    phases.find((phase) => dayNumber >= phase.startDay && dayNumber <= phase.endDay)?.number ??
    phases[phases.length - 1].number;
}

/**
 * Blocks are stitched by position, not by the numbering the provider returned:
 * a block that restarts at day 1 or skips a day would otherwise leave holes in
 * the calendar. Short blocks are topped up with deterministic days.
 */
export function alignBlockDays(
  days: GeneratedDay[],
  startDay: number,
  endDay: number,
  fill: (missingStart: number) => GeneratedDay[],
  phaseFor: (dayNumber: number) => number,
): GeneratedDay[] {
  const wanted = endDay - startDay + 1;
  const aligned = days
    .slice(0, wanted)
    .map((day, index) => ({
      ...day,
      dayNumber: startDay + index,
      phase: phaseFor(startDay + index),
    }));

  if (aligned.length < wanted) {
    aligned.push(...fill(startDay + aligned.length));
  }
  return aligned;
}

function chunkContext(days: GeneratedDay[]): ChunkContext {
  const counts: Partial<Record<TaskType, number>> = {};
  for (const day of days) {
    for (const item of day.tasks) counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return {
    counts,
    recentDays: days.slice(-RECENT_DAYS_CONTEXT).map((day) => ({
      dayNumber: day.dayNumber,
      instructions: day.tasks.map((item) => item.instruction),
    })),
  };
}

export async function generateAndSavePlan(opts: GeneratePlanOptions): Promise<LearningPlan> {
  const { meta } = opts;
  const promptMeta = {
    goal: meta.goal,
    currentLevel: meta.currentLevel,
    targetLevel: meta.targetLevel,
    availabilityMinutes: meta.availabilityMinutes,
    planDays: meta.planDays,
    language: meta.language,
    objective: meta.objective,
    provider: opts.provider,
    ollamaModel: opts.ollamaModel || undefined,
  };

  const skeleton = await postJson<{ phases: Phase[] }>("/api/plan", promptMeta, opts.signal);
  const phases = normalizePhases(skeleton.phases, meta.planDays);
  const phaseFor = phaseResolver(phases);

  const days: GeneratedDay[] = [];
  let consecutiveFailures = 0;
  let filledDays = 0;

  const fillFrom = (start: number, end: number) =>
    fallbackDays({
      startDay: start,
      endDay: end,
      estimatedMinutes: meta.availabilityMinutes,
      phaseFor,
      objective: meta.objective ?? "conversation",
    });

  for (let startDay = 1; startDay <= meta.planDays; startDay += PLAN_CHUNK_DAYS) {
    const endDay = Math.min(startDay + PLAN_CHUNK_DAYS - 1, meta.planDays);

    let block: GeneratedDay[] | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && block === null; attempt += 1) {
      try {
        const res = await postJson<{ days: GeneratedDay[] }>(
          "/api/plan/days",
          { ...promptMeta, phases, startDay, endDay, ...chunkContext(days) },
          opts.signal,
        );
        block = res.days;
      } catch (err) {
        if (opts.signal?.aborted) throw err;
        lastError = err;
      }
    }

    if (block === null) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_BLOCK_FAILURES) {
        throw lastError instanceof Error ? lastError : new Error("Plan generation failed");
      }
      block = fillFrom(startDay, endDay);
      filledDays += block.length;
    } else {
      consecutiveFailures = 0;
    }

    const aligned = alignBlockDays(
      block,
      startDay,
      endDay,
      (missingStart) => {
        const filler = fillFrom(missingStart, endDay);
        filledDays += filler.length;
        return filler;
      },
      phaseFor,
    );
    days.push(...aligned);
    opts.onProgress?.(days.length, meta.planDays);
  }

  if (filledDays > meta.planDays / 2) {
    throw new Error("Plan generation failed");
  }

  const plan = buildPlan(meta, { phases, days });
  await savePlan(plan);
  return plan;
}
