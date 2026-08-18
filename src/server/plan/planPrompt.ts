import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import type { JsonObject } from "@/lib/isObject";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind } from "@/server/http/validation";
import { failureResponse, providerFailure } from "@/server/http/providerFailure";
import { extractJsonObject } from "@/features/plan/contract";
import type { PlanPromptMeta } from "@/features/plan/prompts";
import { METHOD_OBJECTIVES, type MethodObjective } from "@/features/settings/learningProfile";
import { PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";

/**
 * Shared plumbing for the two prompts that build a plan: the phase skeleton and
 * each block of days. Both read the same learner meta and run one completion,
 * so keeping it here stops the routes from drifting apart.
 */

export function readPlanMeta(obj: JsonObject): PlanPromptMeta | null {
  const goal = safeStr(obj.goal, "", 400).trim();
  if (!goal) return null;

  return {
    goal,
    currentLevel: safeStr(obj.currentLevel, "A1", 4),
    targetLevel: safeStr(obj.targetLevel, "B1", 4),
    language: safeStr(obj.language, "English", 50),
    planDays: typeof obj.planDays === "number" ? Math.max(7, Math.min(180, obj.planDays)) : 90,
    availabilityMinutes:
      typeof obj.availabilityMinutes === "number"
        ? Math.max(5, Math.min(120, obj.availabilityMinutes))
        : 20,
    objective: METHOD_OBJECTIVES.includes(obj.objective as MethodObjective)
      ? (obj.objective as MethodObjective)
      : "conversation",
  };
}

function planProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
}

export type PlanPromptOutcome =
  | { ok: true; parsed: unknown }
  | { ok: false; response: NextResponse };

/** Run one plan prompt and return its parsed JSON, or the failure response to send. */
export async function runPlanPrompt(
  req: NextRequest,
  obj: JsonObject,
  prompt: string,
  logFailure: (raw: string) => void,
): Promise<PlanPromptOutcome> {
  const kind = planProviderKind(obj.provider);
  if (!(await isProviderAvailable(kind))) {
    return { ok: false, response: failureResponse(providerFailure("provider_not_configured")) };
  }

  const model = safeStr(obj.ollamaModel, "", 100) || undefined;
  const provider = resolveProvider(kind, { model });
  if (!provider.complete) {
    return {
      ok: false,
      response: failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue gerar um plano. Escolha outra IA em Configurações.",
        ),
      ),
    };
  }

  const raw = await provider.complete(prompt, {
    signal: req.signal,
    timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS,
  });

  try {
    return { ok: true, parsed: extractJsonObject(raw) };
  } catch {
    logFailure(raw);
    return { ok: false, response: failureResponse(providerFailure("provider_failed")) };
  }
}
