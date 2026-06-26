/**
 * POST /api/plan — generate a structured 90-day learning plan.
 *
 * Takes the user's PlanMeta (goal, level, availability) and asks an LLM to return
 * a JSON plan with phases + daily tasks. Returns { plan: PlanGenerationResult }.
 *
 * Requires a configured model-backed provider (OpenRouter, Ollama, Claude, or GPT).
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";
import { logger } from "@/lib/logger";
import { extractJsonObject, validatePlanResult } from "@/features/plan/contract";
import { buildPlanPrompt } from "@/features/plan/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

function planProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
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
        { error: "This provider can't generate a plan. Pick OpenRouter, Ollama, Claude, or GPT." },
        { status: 422 },
      );
    }

    const prompt = buildPlanPrompt({ goal, currentLevel, targetLevel, availabilityMinutes, planDays, language });
    const raw = await provider.complete(prompt);

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
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
