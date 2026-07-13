/**
 * POST /api/level-test/grade — grade the free-writing section of a level-up test
 * against the target CEFR band. Returns { grade: WritingGradeSummary, events: ErrorEvent[] }.
 *
 * The objective sections grade locally on the client; this route only judges the writing
 * sample. The mistakes it finds come back as real ErrorEvents so a failed attempt feeds
 * the weakness → reinforcement loop instead of dead-ending in a score.
 */

import { NextRequest, NextResponse } from "next/server";
import type { ErrorEvent } from "@/lib/cards/schema";
import { safeStr, toErrorEvent } from "@/lib/cards/intake";
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
import { buildWritingGradePrompt } from "@/features/levelup/prompts";
import { validateWritingGrade } from "@/features/levelup/testModel";
import { cardProviderKind } from "@/app/api/cards/_lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_WRITING_CHARS = 3000;

function toEnglishLevel(raw: unknown): EnglishLevel | null {
  return ENGLISH_LEVELS.some((option) => option.value === raw) ? (raw as EnglishLevel) : null;
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 16_384 });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const targetLevel = toEnglishLevel(safeStr(obj.targetLevel, "", 4).toUpperCase());
    const writingPrompt = safeStr(obj.writingPrompt, "", 500);
    const text = safeStr(obj.text, "", MAX_WRITING_CHARS);
    if (!targetLevel || !writingPrompt || !text) {
      return failureResponse(
        providerFailure("invalid_input", "Escreva sua resposta primeiro para eu avaliar."),
      );
    }

    const targetLang = safeStr(obj.targetLang, "en", 16);
    const nativeLang = safeStr(obj.nativeLang, "pt", 16);
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = cardProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { learnerLang: nativeLang, targetLang, model });
    if (!provider.complete) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue avaliar o teste de nível. Escolha outra IA em Configurações.",
        ),
      );
    }

    const prompt = buildWritingGradePrompt({ targetLevel, targetLang, nativeLang, writingPrompt, text });
    const raw = await provider.complete(prompt);

    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      logger.error({ raw }, "Level test grading: failed to extract JSON from LLM response");
      return failureResponse(providerFailure("provider_failed"));
    }

    const grade = validateWritingGrade(parsed);
    if (!grade) {
      logger.error({ parsed }, "Level test grading: JSON did not match expected schema");
      return failureResponse(
        providerFailure("provider_failed", "A IA devolveu uma avaliação incompleta. Tente de novo."),
      );
    }

    const rawErrors = (parsed as Record<string, unknown>).errors;
    const events: ErrorEvent[] = (Array.isArray(rawErrors) ? rawErrors : [])
      .map((error) =>
        toErrorEvent(
          error && typeof error === "object"
            ? { ...error, sourceLang: nativeLang, targetLang }
            : error,
        ),
      )
      .filter((event): event is ErrorEvent => event !== null);

    return NextResponse.json({ grade, events });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Level test grading error");
    return failureResponse(failure);
  }
}
