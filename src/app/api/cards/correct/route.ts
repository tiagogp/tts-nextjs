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
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import {
  MAX_CORRECTION_TEXT_CHARS,
  PUBLIC_CORRECTION_ERROR,
} from "@/app/api/cards/_lib/constants";
import {
  cardProviderKind,
  providerErrorMessage,
} from "@/app/api/cards/_lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const text = safeStr(obj.text, "", MAX_CORRECTION_TEXT_CHARS);
    if (!text) {
      return NextResponse.json({ error: "Nothing to correct." }, { status: 400 });
    }

    const kind = cardProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        { error: `${kind} provider is not configured. Set the key in .env.local or pick Ollama.` },
        { status: 400 },
      );
    }

    const sourceLang = safeStr(obj.sourceLang, "pt", 16);
    const targetLang = safeStr(obj.targetLang, "en", 16);
    const level = safeStr(obj.level, "", 8) || undefined;
    const context = normalizeContext(safeStr(obj.context, "", 100));
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const provider = resolveProvider(kind, { learnerLang: sourceLang, targetLang, model });
    if (!provider.correct) {
      return NextResponse.json(
        {
          error:
            "This provider can't evaluate free text. Pick OpenRouter, Ollama, Claude, or GPT to have the AI find your mistakes.",
        },
        { status: 422 },
      );
    }

    const events = await provider.correct(text, { sourceLang, targetLang, level, context });
    // No errors found is a success — the learner's text was already native-correct.
    return NextResponse.json({ events, count: events.length });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "Correction error");
    return NextResponse.json(
      { error: providerErrorMessage(err) ?? PUBLIC_CORRECTION_ERROR },
      { status: 500 },
    );
  }
}
