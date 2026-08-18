/**
 * POST /api/plan/days — author one block of daily tasks for a plan.
 *
 * Second of the chunked generation calls. Takes the phases from /api/plan plus a
 * day range and the tail of what was already written, and returns { days } for
 * that range only. The client stitches the blocks together before saving.
 */

import { NextRequest, NextResponse } from "next/server";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { logger } from "@/lib/logger";
import { validateGeneratedDays, validatePhases } from "@/features/plan/contract";
import { buildPlanChunkPrompt, type ChunkContext } from "@/features/plan/prompts";
import { PLAN_TASK_TYPES } from "@/features/plan/constants";
import type { TaskType } from "@/features/plan/schema";
import { readPlanMeta, runPlanPrompt } from "@/server/plan/planPrompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_RECENT_DAYS = 3;

function readCounts(raw: unknown): ChunkContext["counts"] {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const counts: ChunkContext["counts"] = {};
  for (const type of PLAN_TASK_TYPES) {
    const value = source[type];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      counts[type as TaskType] = Math.min(Math.round(value), 999);
    }
  }
  return counts;
}

function readRecentDays(raw: unknown): ChunkContext["recentDays"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_RECENT_DAYS)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const day = entry as Record<string, unknown>;
      if (typeof day.dayNumber !== "number" || !Array.isArray(day.instructions)) return null;
      return {
        dayNumber: day.dayNumber,
        instructions: day.instructions
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.slice(0, 120)),
      };
    })
    .filter((entry): entry is ChunkContext["recentDays"][number] => entry !== null);
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 16384 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const meta = readPlanMeta(obj);
    const phases = validatePhases(obj.phases);
    if (!meta || !phases) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const startDay = typeof obj.startDay === "number" ? Math.max(1, Math.round(obj.startDay)) : 1;
    const endDay =
      typeof obj.endDay === "number"
        ? Math.max(startDay, Math.min(Math.round(obj.endDay), meta.planDays))
        : Math.min(startDay + 13, meta.planDays);

    const context: ChunkContext = {
      counts: readCounts(obj.counts),
      recentDays: readRecentDays(obj.recentDays),
    };

    const prompt = buildPlanChunkPrompt(meta, phases, startDay, endDay, context);
    const outcome = await runPlanPrompt(req, obj, prompt, (raw) =>
      logger.error({ raw, startDay, endDay }, "Plan days: failed to extract JSON from LLM response"),
    );
    if (!outcome.ok) return outcome.response;

    const days =
      outcome.parsed && typeof outcome.parsed === "object"
        ? validateGeneratedDays((outcome.parsed as Record<string, unknown>).days)
        : null;
    if (!days || days.length === 0) {
      logger.error({ parsed: outcome.parsed, startDay, endDay }, "Plan days: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA montou um trecho incompleto do plano. Tente de novo."),
      );
    }

    return NextResponse.json({ days });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Plan days error");
    return failureResponse(failure);
  }
}
