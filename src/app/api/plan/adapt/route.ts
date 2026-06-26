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
        { error: "This provider can't revise a plan. Pick OpenRouter, Ollama, Claude, or GPT." },
        { status: 422 },
      );
    }

    const prompt = buildAdaptPrompt(meta, phases, remainingDays, startDayNumber, newAvailabilityMinutes, effortHistory);
    const raw = await provider.converse([], { scenario: prompt, targetLang: "en" });

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      logger.error({ raw }, "Plan adapt: failed to extract JSON");
      return NextResponse.json({ error: "The AI returned an unexpected response." }, { status: 500 });
    }

    const days = parsed && typeof parsed === "object"
      ? validateGeneratedDays((parsed as Record<string, unknown>).days)
      : null;
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
