/**
 * POST /api/plan — design the phase skeleton of a learning plan.
 *
 * First of the chunked generation calls: it returns only { phases }, which the
 * client then feeds to /api/plan/days one block of days at a time. Asking for
 * the whole plan in one completion used to time out on longer plans.
 *
 * Requires a configured model-backed provider (OpenRouter, Ollama, Claude, or GPT).
 */

import { NextRequest, NextResponse } from "next/server";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { logger } from "@/lib/logger";
import { validatePhases } from "@/features/plan/contract";
import { buildPlanSkeletonPrompt } from "@/features/plan/prompts";
import { readPlanMeta, runPlanPrompt } from "@/server/plan/planPrompt";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 4096 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const meta = readPlanMeta(obj);
    if (!meta) {
      return failureResponse(
        providerFailure("invalid_input", "Defina um objetivo primeiro para gerar o plano."),
      );
    }

    const outcome = await runPlanPrompt(req, obj, buildPlanSkeletonPrompt(meta), (raw) =>
      logger.error({ raw }, "Plan skeleton: failed to extract JSON from LLM response"),
    );
    if (!outcome.ok) return outcome.response;

    const phases =
      outcome.parsed && typeof outcome.parsed === "object"
        ? validatePhases((outcome.parsed as Record<string, unknown>).phases)
        : null;
    if (!phases) {
      logger.error({ parsed: outcome.parsed }, "Plan skeleton: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA montou um plano incompleto. Tente de novo."),
      );
    }

    return NextResponse.json({ phases });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Plan skeleton error");
    return failureResponse(failure);
  }
}
