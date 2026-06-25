/**
 * POST /api/plan/adapt — revise remaining days of a learning plan.
 *
 * Takes the current plan, effort history, and new daily availability.
 * Asks the LLM to regenerate only the remaining days, keeping the same
 * phase structure. Returns { days: DailyTask[] } for days from today onward.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";
import { logger } from "@/lib/logger";
import type { Phase, PlanMeta, EffortSnapshot } from "@/features/plan/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

function adaptProviderKind(raw: unknown): ProviderKind {
  const requested = isProviderKind(raw) ? raw : getDefaultProvider();
  if (requested !== "local") return requested;
  if (isProviderAvailable("claude")) return "claude";
  if (isProviderAvailable("openai")) return "openai";
  return "ollama";
}

function buildAdaptPrompt(
  meta: PlanMeta,
  phases: Phase[],
  remainingDays: number,
  startDayNumber: number,
  newAvailabilityMinutes: number,
  effortHistory: EffortSnapshot[],
): string {
  const historyLines = effortHistory
    .slice(-4)
    .map(
      (s) =>
        `  - Week ${s.weekOf}: ${Math.round(s.adherenceRate * 100)}% adherence, ${s.actualMinutes} actual min vs ${s.plannedMinutes} planned`,
    )
    .join("\n");

  const phasesDesc = phases
    .map((p) => `  Phase ${p.number} (days ${p.startDay}–${p.endDay}): ${p.title} — ${p.focus}`)
    .join("\n");

  return `You are revising a language learning plan. The learner's recent effort history shows they need an adjustment.

Original plan:
- Goal: ${meta.goal}
- Language: ${meta.language}
- Current level: ${meta.currentLevel} → Target: ${meta.targetLevel}
- Original daily availability: ${meta.availabilityMinutes} min/day
- New daily availability: ${newAvailabilityMinutes} min/day

Plan phases:
${phasesDesc}

Recent effort history (last weeks):
${historyLines || "  No history yet"}

Generate revised daily tasks for the REMAINING ${remainingDays} days, starting at day ${startDayNumber}.
Keep the same phase structure. Adjust task count and estimatedMinutes to fit ${newAvailabilityMinutes} min/day.

Rules:
- study should appear 5-6 days per week (spaced repetition needs consistency)
- discover 2-3 times per week
- converse and correct based on phase and availability
- Keep estimatedMinutes close to ${newAvailabilityMinutes} per day

Return ONLY valid JSON:
{
  "days": [
    {
      "dayNumber": ${startDayNumber},
      "phase": 1,
      "estimatedMinutes": ${newAvailabilityMinutes},
      "tasks": [
        {
          "type": "study",
          "instruction": "Review due flashcards",
          "targetMetric": { "action": "cards_reviewed", "quantity": 10 }
        }
      ]
    }
  ]
}`;
}

const TASK_TYPES = ["discover", "study", "converse", "correct"] as const;
const METRIC_ACTIONS = ["cards_reviewed", "video_processed", "conversation_turns", "cards_created"] as const;

function validateDays(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.days)) return null;

  const days = obj.days.map((d: unknown) => {
    if (!d || typeof d !== "object") return null;
    const day = d as Record<string, unknown>;
    if (
      typeof day.dayNumber !== "number" ||
      typeof day.phase !== "number" ||
      typeof day.estimatedMinutes !== "number" ||
      !Array.isArray(day.tasks)
    ) return null;

    const tasks = day.tasks.map((t: unknown) => {
      if (!t || typeof t !== "object") return null;
      const task = t as Record<string, unknown>;
      if (!TASK_TYPES.includes(task.type as (typeof TASK_TYPES)[number])) return null;
      if (typeof task.instruction !== "string") return null;

      let targetMetric: { action: string; quantity: number } | undefined;
      if (task.targetMetric && typeof task.targetMetric === "object") {
        const m = task.targetMetric as Record<string, unknown>;
        if (
          METRIC_ACTIONS.includes(m.action as (typeof METRIC_ACTIONS)[number]) &&
          typeof m.quantity === "number"
        ) {
          targetMetric = { action: m.action as string, quantity: m.quantity };
        }
      }

      return {
        type: task.type as string,
        instruction: String(task.instruction).slice(0, 120),
        ...(targetMetric ? { targetMetric } : {}),
      };
    });
    if (tasks.some((t) => t === null)) return null;

    return {
      dayNumber: day.dayNumber as number,
      phase: day.phase as number,
      estimatedMinutes: day.estimatedMinutes as number,
      tasks: tasks as { type: string; instruction: string; targetMetric?: { action: string; quantity: number } }[],
    };
  });

  if (days.some((d) => d === null)) return null;
  return days as NonNullable<(typeof days)[number]>[];
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(first, last + 1));
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 32768 });
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const meta = obj.meta as PlanMeta | undefined;
    const phases = obj.phases as Phase[] | undefined;
    if (!meta || !phases) {
      return NextResponse.json({ error: "Plan meta and phases are required." }, { status: 400 });
    }

    const remainingDays = typeof obj.remainingDays === "number" ? Math.max(1, Math.min(180, obj.remainingDays)) : 30;
    const startDayNumber = typeof obj.startDayNumber === "number" ? obj.startDayNumber : 1;
    const newAvailabilityMinutes = typeof obj.newAvailabilityMinutes === "number"
      ? Math.max(5, Math.min(120, obj.newAvailabilityMinutes))
      : meta.availabilityMinutes;
    const effortHistory = Array.isArray(obj.effortHistory) ? (obj.effortHistory as EffortSnapshot[]) : [];
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = adaptProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        { error: `${kind} provider is not configured.` },
        { status: 400 },
      );
    }

    const provider = resolveProvider(kind, { model });
    if (!provider.converse) {
      return NextResponse.json(
        { error: "The Local provider can't revise a plan. Pick Ollama, Claude, or GPT." },
        { status: 422 },
      );
    }

    const prompt = buildAdaptPrompt(meta, phases, remainingDays, startDayNumber, newAvailabilityMinutes, effortHistory);
    const raw = await provider.converse([], { scenario: prompt, targetLang: "en" });

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch {
      logger.error({ raw }, "Plan adapt: failed to extract JSON");
      return NextResponse.json({ error: "The AI returned an unexpected response." }, { status: 500 });
    }

    const days = validateDays(parsed);
    if (!days) {
      logger.error({ parsed }, "Plan adapt: JSON did not match expected schema");
      return NextResponse.json({ error: "The AI returned a malformed plan revision." }, { status: 500 });
    }

    return NextResponse.json({ days, newAvailabilityMinutes });
  } catch (err: unknown) {
    logger.error({ err }, "Plan adapt error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't revise the plan right now." },
      { status: 500 },
    );
  }
}
