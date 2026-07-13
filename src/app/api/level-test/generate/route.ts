/**
 * POST /api/level-test/generate — author a level-up test at the target CEFR band.
 *
 * Takes the current/target level pair and returns { test: LevelTest }. The LLM authors
 * the test *with its answer key* (answerIndex / acceptedAnswers), so the objective
 * sections grade locally on the client; only the writing sample comes back for grading.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { logger } from "@/lib/logger";
import { extractJsonObject } from "@/features/plan/contract";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { buildLevelTestPrompt } from "@/features/levelup/prompts";
import { validateLevelTest, type LevelTest } from "@/features/levelup/testModel";
import { nextLevelOf } from "@/features/levelup/model";
import { cardProviderKind } from "@/app/api/cards/_lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

function toEnglishLevel(raw: unknown): EnglishLevel | null {
  return ENGLISH_LEVELS.some((option) => option.value === raw) ? (raw as EnglishLevel) : null;
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 4096 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const currentLevel = toEnglishLevel(safeStr(obj.currentLevel, "", 4).toUpperCase());
    if (!currentLevel) {
      return failureResponse(providerFailure("invalid_input"));
    }
    // The server re-derives the transition — the client can't ask for an arbitrary jump.
    const targetLevel = nextLevelOf(currentLevel);
    if (!targetLevel) {
      return failureResponse(
        providerFailure("invalid_input", "Você já está no topo da escada de níveis."),
      );
    }

    const targetLang = safeStr(obj.targetLang, "en", 16);
    const nativeLang = safeStr(obj.nativeLang, "pt", 16);
    const focusGaps = Array.isArray(obj.focusGaps)
      ? obj.focusGaps
          .map((gap) => safeStr(gap, "", 60))
          .filter((gap) => gap.length > 0)
          .slice(0, 3)
      : [];
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = cardProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { model });
    if (!provider.complete) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue montar o teste de nível. Escolha outra IA em Configurações.",
        ),
      );
    }

    const prompt = buildLevelTestPrompt({ currentLevel, targetLevel, targetLang, nativeLang, focusGaps });
    const raw = await provider.complete(prompt);

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      logger.error({ raw }, "Level test generation: failed to extract JSON from LLM response");
      return failureResponse(providerFailure("provider_failed"));
    }

    const content = validateLevelTest(parsed);
    if (!content) {
      logger.error({ parsed }, "Level test generation: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA montou um teste incompleto. Tente de novo."),
      );
    }

    const test: LevelTest = { id: crypto.randomUUID(), targetLevel, ...content };
    return NextResponse.json({ test });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Level test generation error");
    return failureResponse(failure);
  }
}
