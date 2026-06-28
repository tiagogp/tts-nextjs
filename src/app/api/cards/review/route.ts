/**
 * Advanced production review. Unlike /api/cards/correct, this returns both real mistakes
 * and optional naturalness refinements for text that may already be correct.
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
      return NextResponse.json({ error: "Nothing to review." }, { status: 400 });
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
    if (!provider.review) {
      return NextResponse.json(
        {
          error:
            "This provider can't review advanced naturalness. Pick OpenRouter, Ollama, Claude, or GPT.",
        },
        { status: 422 },
      );
    }

    const review = await provider.review(text, { sourceLang, targetLang, level, context });
    return NextResponse.json({
      ...review,
      count: review.errors.length + review.refinements.length,
    });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "Advanced review error");
    return NextResponse.json(
      { error: providerErrorMessage(err) ?? PUBLIC_CORRECTION_ERROR },
      { status: 500 },
    );
  }
}
