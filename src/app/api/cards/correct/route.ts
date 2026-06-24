/**
 * E2 — correction ingestion. Take free text the learner wrote (or had transcribed from
 * speech via /api/transcribe), hand it to the chosen provider's `correct()`, and return
 * the ErrorEvents it found. The client reviews them, then runs the same generate pipeline
 * the Discover/Correct tabs already use.
 *
 * The local provider has no `correct()` — it can't judge open text — so a 422 tells the
 * client to pick Claude, GPT, or Ollama.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { normalizeContext } from "@/lib/cards/context";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Cap input so one paste can't blow the model's context or the request timeout. */
const MAX_TEXT = 8000;
const PUBLIC_CORRECTION_ERROR =
  "Couldn't evaluate the text right now. Try again in a moment.";

function providerErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.trim();
  if (!message) return null;
  if (
    message.includes("Ollama") ||
    message.includes("OpenAI") ||
    message.includes("Claude") ||
    message.includes("Anthropic") ||
    message.includes("API key") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connect") ||
    message.includes("ECONNREFUSED")
  ) {
    return message;
  }
  return null;
}

function correctionProviderKind(raw: unknown): ProviderKind {
  const requested = isProviderKind(raw) ? raw : getDefaultProvider();
  if (requested !== "local") return requested;
  if (isProviderAvailable("claude")) return "claude";
  if (isProviderAvailable("openai")) return "openai";
  return "ollama";
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const text = safeStr(obj.text, "", MAX_TEXT);
    if (!text) {
      return NextResponse.json({ error: "Nothing to correct." }, { status: 400 });
    }

    const kind = correctionProviderKind(obj.provider);
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

    const provider = resolveProvider(kind, { learnerLang: sourceLang, model });
    if (!provider.correct) {
      return NextResponse.json(
        {
          error:
            "The Local provider can't evaluate free text. Pick Ollama, Claude, or GPT to have the AI find your mistakes.",
        },
        { status: 422 },
      );
    }

    const events = await provider.correct(text, { sourceLang, targetLang, level, context });
    // No errors found is a success — the learner's text was already native-correct.
    return NextResponse.json({ events, count: events.length });
  } catch (err: unknown) {
    logger.error({ err }, "Correction error");
    return NextResponse.json(
      { error: providerErrorMessage(err) ?? PUBLIC_CORRECTION_ERROR },
      { status: 500 },
    );
  }
}
