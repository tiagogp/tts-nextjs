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
import { isHttpError, isProviderKind, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { logger } from "@/lib/logger";
import { extractJsonObject, validatePlanResult } from "@/features/plan/contract";
import { buildPlanPrompt } from "@/features/plan/prompts";
import { METHOD_OBJECTIVES, type MethodObjective } from "@/features/settings/learningProfile";

export const runtime = "nodejs";
export const maxDuration = 120;

function planProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 4096 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const goal = safeStr(obj.goal, "", 400).trim();
    if (!goal) {
      return failureResponse(
        providerFailure("invalid_input", "Defina um objetivo primeiro para gerar o plano."),
      );
    }

    const currentLevel = safeStr(obj.currentLevel, "A1", 4);
    const targetLevel = safeStr(obj.targetLevel, "B1", 4);
    const language = safeStr(obj.language, "English", 50);
    const planDays = typeof obj.planDays === "number" ? Math.max(7, Math.min(180, obj.planDays)) : 90;
    const availabilityMinutes =
      typeof obj.availabilityMinutes === "number"
        ? Math.max(5, Math.min(120, obj.availabilityMinutes))
        : 20;
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;
    const objective = METHOD_OBJECTIVES.includes(obj.objective as MethodObjective)
      ? (obj.objective as MethodObjective)
      : "conversation";

    const kind = planProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { model });
    if (!provider.complete) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue gerar um plano. Escolha outra IA em Configurações.",
        ),
      );
    }

    const prompt = buildPlanPrompt({ goal, currentLevel, targetLevel, availabilityMinutes, planDays, language, objective });
    const raw = await provider.complete(prompt);

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      logger.error({ raw }, "Plan generation: failed to extract JSON from LLM response");
      return failureResponse(providerFailure("provider_failed"));
    }

    const plan = validatePlanResult(parsed);
    if (!plan) {
      logger.error({ parsed }, "Plan generation: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA montou um plano incompleto. Tente de novo."),
      );
    }

    return NextResponse.json({ plan });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Plan generation error");
    return failureResponse(failure);
  }
}
