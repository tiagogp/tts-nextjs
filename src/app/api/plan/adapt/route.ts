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
import { isHttpError, isProviderKind, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { logger } from "@/lib/logger";
import type { Phase, PlanMeta, EffortSnapshot } from "@/features/plan/schema";
import { extractJsonObject, validateGeneratedDays } from "@/features/plan/contract";
import { buildAdaptPrompt } from "@/features/plan/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

function adaptProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 32768 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const meta = obj.meta as PlanMeta | undefined;
    const phases = obj.phases as Phase[] | undefined;
    if (!meta || !phases) {
      return failureResponse(providerFailure("invalid_input"));
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
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { model });
    if (!provider.converse) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue revisar um plano. Escolha outra IA em Configurações.",
        ),
      );
    }

    const prompt = buildAdaptPrompt(meta, phases, remainingDays, startDayNumber, newAvailabilityMinutes, effortHistory);
    const raw = await provider.converse([], { scenario: prompt, targetLang: "en" });

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      logger.error({ raw }, "Plan adapt: failed to extract JSON");
      return failureResponse(providerFailure("provider_failed"));
    }

    const days = parsed && typeof parsed === "object"
      ? validateGeneratedDays((parsed as Record<string, unknown>).days)
      : null;
    if (!days) {
      logger.error({ parsed }, "Plan adapt: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA montou uma revisão incompleta. Tente de novo."),
      );
    }

    return NextResponse.json({ days, newAvailabilityMinutes });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Plan adapt error");
    return failureResponse(failure);
  }
}
