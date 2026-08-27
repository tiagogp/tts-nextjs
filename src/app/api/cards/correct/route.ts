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
import { MAX_CORRECTION_JSON_BYTES, PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { MAX_CORRECTION_TEXT_CHARS } from "@/app/api/cards/_lib/constants";
import { cardProviderKind } from "@/app/api/cards/_lib/utils";
import { CORRECTION_PROMPT_VERSION } from "@/lib/evaluation/judge";

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
    if (!(await isProviderAvailable(kind))) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const sourceLang = safeStr(obj.sourceLang, "pt", 16);
    const targetLang = safeStr(obj.targetLang, "en", 16);
    const level = safeStr(obj.level, "", 8) || undefined;
    const context = normalizeContext(safeStr(obj.context, "", 100));
    // A task is deliberately separate from the stored context: it tells the tutor what
    // the learner was trying to communicate, not the situation/error label to persist.
    const task = safeStr(obj.task, "", 500) || undefined;
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

    const correction = await provider.correct(
      text,
      { sourceLang, targetLang, level, context, task },
      { signal: req.signal, timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS },
    );
    // No errors found is a success — the learner's text was already native-correct.
    // The judge stamp travels with the verdict: which model, which rubric version. A
    // metric that cannot say who judged it cannot claim to have measured anything.
    return NextResponse.json({
      events: correction.events,
      task: correction.task ?? null,
      count: correction.events.length,
      judge: { by: "model", provider: kind, model: provider.modelId, promptVersion: CORRECTION_PROMPT_VERSION },
    });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Correction error");
    return failureResponse(failure);
  }
}
