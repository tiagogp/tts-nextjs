/**
 * POST /api/listening/probe — write a cold-listening check for a stretch of imported audio.
 *
 * The learner just imported a video or a podcast. The audio is authentic and the voice is
 * one they have never heard, which is exactly what the unfamiliar-speech metric needs and
 * exactly what the bundled synthetic clips can never be. What the device cannot do is
 * author the questions, so the provider does — from the transcript window the client picked
 * deterministically, never from a window the model chose for itself.
 *
 * The response carries the judge stamp: these questions came from a model, and a rate built
 * on them is only comparable to another built on the same one.
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
import { cardProviderKind } from "@/app/api/cards/_lib/utils";
import { PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";
import { buildProbePrompt, parseProbeQuestions } from "@/features/listening/importedProbe";
import { PROBE_PROMPT_VERSION } from "@/features/listening/probeContract";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Enough for a 25s window of speech, with room for punctuation and speaker labels. */
const MAX_TRANSCRIPT_CHARS = 4_000;

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: 16_384 });
    if (!obj) return failureResponse(providerFailure("invalid_input"));

    const text = safeStr(obj.text, "", MAX_TRANSCRIPT_CHARS);
    if (!text) return failureResponse(providerFailure("invalid_input"));

    const targetLang = safeStr(obj.targetLang, "en", 16);
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;
    const startMs = Number(obj.startMs) || 0;
    const endMs = Number(obj.endMs) || 0;

    const kind = cardProviderKind(obj.provider);
    if (!(await isProviderAvailable(kind))) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { targetLang, model });
    if (!provider.complete) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue montar a prova de escuta. Escolha outra IA em Configurações.",
        ),
      );
    }

    const prompt = buildProbePrompt(
      { text, startMs, endMs, segmentIndexes: [] },
      { targetLang },
    );
    const raw = await provider.complete(prompt, {
      signal: req.signal,
      timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS,
    });

    const questions = parseProbeQuestions(raw);
    if (!questions) {
      // No repair pass on purpose: a check with two plausible answers measures nothing, and
      // an absent probe is honest where a broken one is not.
      logger.error({ raw }, "Listening probe: model output failed validation");
      return failureResponse(
        providerFailure("provider_failed", "A IA não montou uma prova utilizável. Tente de novo."),
      );
    }

    return NextResponse.json({
      questions,
      judge: {
        by: "model",
        provider: kind,
        model: provider.modelId,
        promptVersion: PROBE_PROMPT_VERSION,
      },
    });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Listening probe error");
    return failureResponse(failure);
  }
}
