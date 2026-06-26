/**
 * Phase 1 — conversation turn. Take the scenario + prior turns and return the assistant's
 * next line in the target language, role-played at the learner's level. TTS is intentionally
 * NOT done here: the client renders the text immediately and requests /api/tts separately so
 * reading isn't blocked on audio synthesis.
 *
 * Every provider is model-backed and implements `converse()`; an unconfigured provider (no
 * API key) is caught earlier with a 400 telling the client to connect or switch providers.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ConversationTurn, ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Bound history so one long session can't blow the model's context or the request timeout. */
const MAX_TURNS = 60;
const MAX_TURN_CHARS = 2000;
const MAX_SCENARIO_CHARS = 300;
const PUBLIC_CONVERSATION_ERROR =
  "Couldn't continue the conversation right now. Try again in a moment.";

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

function conversationProviderKind(raw: unknown): ProviderKind {
  return isProviderKind(raw) ? raw : getDefaultProvider();
}

function parseTurns(raw: unknown): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ConversationTurn[] = [];
  // Keep only the most recent turns — the tail is what matters for the next reply.
  for (const item of raw.slice(-MAX_TURNS)) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_TURN_CHARS) : "";
    if (!role || !text) continue;
    out.push({ role, text });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const scenario = safeStr(obj.scenario, "", MAX_SCENARIO_CHARS);
    if (!scenario) {
      return NextResponse.json({ error: "Pick a scenario first." }, { status: 400 });
    }

    const targetLang = safeStr(obj.targetLang, "en", 16);
    const sourceLang = safeStr(obj.sourceLang, "pt", 16);
    const level = safeStr(obj.level, "", 8) || undefined;
    const history = parseTurns(obj.history);
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = conversationProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        { error: `${kind} provider is not configured. Set the key in .env.local or pick Ollama.` },
        { status: 400 },
      );
    }

    const provider = resolveProvider(kind, { learnerLang: sourceLang, model });
    if (!provider.converse) {
      return NextResponse.json(
        {
          error:
            "This provider can't hold a conversation. Pick OpenRouter, Ollama, Claude, or GPT to practice speaking.",
        },
        { status: 422 },
      );
    }

    const reply = await provider.converse(history, { scenario, targetLang, sourceLang, level });
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    logger.error({ err }, "Conversation error");
    return NextResponse.json(
      { error: providerErrorMessage(err) ?? PUBLIC_CONVERSATION_ERROR },
      { status: 500 },
    );
  }
}
