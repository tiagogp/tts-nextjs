/**
 * Advanced production review. Unlike /api/cards/correct, this returns both real mistakes
 * and optional naturalness refinements for text that may already be correct.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { normalizeContext } from "@/lib/cards/context";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { MAX_CORRECTION_TEXT_CHARS } from "@/app/api/cards/_lib/constants";
import { cardProviderKind } from "@/app/api/cards/_lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const text = safeStr(obj.text, "", MAX_CORRECTION_TEXT_CHARS);
    if (!text) {
      return failureResponse(
        providerFailure("invalid_input", "Escreva um texto primeiro para eu revisar."),
      );
    }

    const kind = cardProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const sourceLang = safeStr(obj.sourceLang, "pt", 16);
    const targetLang = safeStr(obj.targetLang, "en", 16);
    const level = safeStr(obj.level, "", 8) || undefined;
    const context = normalizeContext(safeStr(obj.context, "", 100));
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const provider = resolveProvider(kind, { learnerLang: sourceLang, targetLang, model });
    if (!provider.review) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue revisar naturalidade. Escolha outra IA em Configurações.",
        ),
      );
    }

    const review = await provider.review(text, { sourceLang, targetLang, level, context });
    return NextResponse.json({
      ...review,
      count: review.errors.length + review.refinements.length,
    });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Advanced review error");
    return failureResponse(failure);
  }
}
