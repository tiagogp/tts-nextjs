/**
 * POST /api/plan — generate a structured 90-day learning plan.
 *
 * Takes the user's PlanMeta (goal, level, availability) and asks an LLM to return
 * a JSON plan with phases + daily tasks. Returns { plan: PlanGenerationResult }.
 *
 * Requires a model-backed provider (Ollama, Claude, or GPT) — the local heuristic
 * cannot generate structured plans.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";
import { logger } from "@/lib/logger";
import type { PlanGenerationResult } from "@/features/plan/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const TASK_TYPES = ["discover", "study", "converse", "correct"] as const;
const METRIC_ACTIONS = ["cards_reviewed", "video_processed", "conversation_turns", "cards_created"] as const;

function planProviderKind(raw: unknown): ProviderKind {
  const requested = isProviderKind(raw) ? raw : getDefaultProvider();
  if (requested !== "local") return requested;
  if (isProviderAvailable("claude")) return "claude";
  if (isProviderAvailable("openai")) return "openai";
  return "ollama";
}

function buildPlanPrompt(meta: {
  goal: string;
  currentLevel: string;
  targetLevel: string;
  availabilityMinutes: number;
  planDays: number;
  language: string;
}): string {
  return `You are a language learning curriculum designer. Generate a structured ${meta.planDays}-day learning plan for a learner with these parameters:

- Current level: ${meta.currentLevel}
- Target level: ${meta.targetLevel}
- Goal: ${meta.goal}
- Language being learned: ${meta.language}
- Daily availability: ${meta.availabilityMinutes} minutes
- Plan length: ${meta.planDays} days

The app has 4 activities the learner can do each day:
- "discover": Find a YouTube video, article, or PDF, extract useful phrases, and generate flashcards from it
- "study": Review due flashcards using spaced repetition (FSRS algorithm)
- "converse": Practice conversation with an AI partner in a chosen scenario
- "correct": Write or speak something, get corrections, turn mistakes into flashcards

Design 3 phases that build on each other. Each phase should have a clear focus (e.g., "Listening and vocabulary building", "Output and error correction", "Consolidation and fluency").

For EACH of the ${meta.planDays} days, provide 1-3 tasks. Each task must have:
- type: one of "discover", "study", "converse", "correct"
- instruction: a short, concrete, actionable instruction (max 80 chars)
- targetMetric (optional): what counts as "done" (action + quantity)

Rules:
- Days 1-7: focus on discover + study only (build the first cards)
- Mix in converse and correct from week 2 onward
- study should appear 5-6 days per week (spaced repetition needs consistency)
- discover 2-3 times per week (not every day)
- Keep total estimatedMinutes close to ${meta.availabilityMinutes} per day
- study ≈ 10 min, discover ≈ 20-30 min, converse ≈ 15 min, correct ≈ 15 min

Return ONLY valid JSON matching this exact shape:
{
  "phases": [
    { "number": 1, "title": "string", "focus": "string", "startDay": 1, "endDay": 30 }
  ],
  "days": [
    {
      "dayNumber": 1,
      "phase": 1,
      "estimatedMinutes": 20,
      "tasks": [
        {
          "type": "discover",
          "instruction": "Find a short video on a topic you enjoy",
          "targetMetric": { "action": "video_processed", "quantity": 1 }
        }
      ]
    }
  ]
}`;
}

function validatePlanResult(raw: unknown): PlanGenerationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.phases) || !Array.isArray(obj.days)) return null;

  const phases = obj.phases.map((p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const phase = p as Record<string, unknown>;
    if (
      typeof phase.number !== "number" ||
      typeof phase.title !== "string" ||
      typeof phase.focus !== "string" ||
      typeof phase.startDay !== "number" ||
      typeof phase.endDay !== "number"
    ) return null;
    return {
      number: phase.number,
      title: phase.title.slice(0, 100),
      focus: phase.focus.slice(0, 200),
      startDay: phase.startDay,
      endDay: phase.endDay,
    };
  });
  if (phases.some((p) => p === null)) return null;

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

      let targetMetric: PlanGenerationResult["days"][number]["tasks"][number]["targetMetric"];
      if (task.targetMetric && typeof task.targetMetric === "object") {
        const m = task.targetMetric as Record<string, unknown>;
        if (
          METRIC_ACTIONS.includes(m.action as (typeof METRIC_ACTIONS)[number]) &&
          typeof m.quantity === "number"
        ) {
          targetMetric = { action: m.action as (typeof METRIC_ACTIONS)[number], quantity: m.quantity };
        }
      }

      return {
        type: task.type as PlanGenerationResult["days"][number]["tasks"][number]["type"],
        instruction: String(task.instruction).slice(0, 120),
        ...(targetMetric ? { targetMetric } : {}),
      };
    });
    if (tasks.some((t) => t === null)) return null;

    return {
      dayNumber: day.dayNumber,
      phase: day.phase,
      estimatedMinutes: day.estimatedMinutes,
      tasks: tasks as PlanGenerationResult["days"][number]["tasks"],
    };
  });
  if (days.some((d) => d === null)) return null;

  return {
    phases: phases as PlanGenerationResult["phases"],
    days: days as PlanGenerationResult["days"],
  };
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
    const obj = await readJsonObject(req, { maxBytes: 4096 });
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const goal = safeStr(obj.goal, "", 400).trim();
    if (!goal) {
      return NextResponse.json({ error: "A goal is required to generate a plan." }, { status: 400 });
    }

    const currentLevel = safeStr(obj.currentLevel, "B1", 4);
    const targetLevel = safeStr(obj.targetLevel, "B2", 4);
    const language = safeStr(obj.language, "English", 50);
    const planDays = typeof obj.planDays === "number" ? Math.max(7, Math.min(180, obj.planDays)) : 90;
    const availabilityMinutes =
      typeof obj.availabilityMinutes === "number"
        ? Math.max(5, Math.min(120, obj.availabilityMinutes))
        : 20;
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = planProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        { error: `${kind} provider is not configured. Set the API key or use Ollama.` },
        { status: 400 },
      );
    }

    const provider = resolveProvider(kind, { model });
    if (!provider.complete) {
      return NextResponse.json(
        { error: "The Local provider can't generate a plan. Pick Ollama, Claude, or GPT." },
        { status: 422 },
      );
    }

    const prompt = buildPlanPrompt({ goal, currentLevel, targetLevel, availabilityMinutes, planDays, language });
    const raw = await provider.complete(prompt);

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch {
      logger.error({ raw }, "Plan generation: failed to extract JSON from LLM response");
      return NextResponse.json(
        { error: "The AI returned an unexpected response. Please try again." },
        { status: 500 },
      );
    }

    const plan = validatePlanResult(parsed);
    if (!plan) {
      logger.error({ parsed }, "Plan generation: JSON did not match expected schema");
      return NextResponse.json(
        { error: "The AI returned a malformed plan. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ plan });
  } catch (err: unknown) {
    logger.error({ err }, "Plan generation error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't generate the plan right now." },
      { status: 500 },
    );
  }
}
