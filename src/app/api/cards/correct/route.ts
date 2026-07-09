/**
 * E2 — correction ingestion. Take free text the learner wrote (or had transcribed from
 * speech via /api/transcribe), hand it to the chosen provider's `correct()`, and return
 * the ErrorEvents it found. The client reviews them, then runs the same generate pipeline
 * the Discover/Correct tabs already use.
 *
 * Every provider is model-backed and implements `correct()`; an unconfigured provider (no
 * API key) is caught earlier with a 400 telling the client to connect or switch providers.
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
        providerFailure("invalid_input", "Escreva ou fale uma frase primeiro para eu corrigir."),
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
    if (!provider.correct) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue corrigir texto livre. Escolha outra IA em Configurações.",
        ),
      );
    }

    const events = await provider.correct(text, { sourceLang, targetLang, level, context });
    // No errors found is a success — the learner's text was already native-correct.
    return NextResponse.json({ events, count: events.length });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Correction error");
    return failureResponse(failure);
  }
}
