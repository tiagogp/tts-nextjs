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
import { isHttpError, isProviderKind, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Bound history so one long session can't blow the model's context or the request timeout. */
const MAX_TURNS = 60;
const MAX_TURN_CHARS = 2000;
const MAX_SCENARIO_CHARS = 300;

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
      return failureResponse(providerFailure("invalid_input"));
    }

    const scenario = safeStr(obj.scenario, "", MAX_SCENARIO_CHARS);
    if (!scenario) {
      return failureResponse(
        providerFailure("invalid_input", "Escolha uma situação primeiro para praticar."),
      );
    }

    const targetLang = safeStr(obj.targetLang, "en", 16);
    const sourceLang = safeStr(obj.sourceLang, "pt", 16);
    const level = safeStr(obj.level, "", 8) || undefined;
    const challenge = obj.challenge === true;
    const conversationStage = safeStr(obj.conversationStage, "", 40) || undefined;
    const maxTurns = typeof obj.maxTurns === "number" ? Math.max(2, Math.min(20, Math.round(obj.maxTurns))) : undefined;
    const followUpDepth = obj.followUpDepth === "single" || obj.followUpDepth === "layered" || obj.followUpDepth === "counterpoint"
      ? obj.followUpDepth
      : undefined;
    const promptStyle = safeStr(obj.promptStyle, "", 240) || undefined;
    const speakerFamiliarity = obj.speakerFamiliarity === "familiar" || obj.speakerFamiliarity === "mixed" || obj.speakerFamiliarity === "unfamiliar"
      ? obj.speakerFamiliarity
      : undefined;
    const history = parseTurns(obj.history);
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;

    const kind = conversationProviderKind(obj.provider);
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const provider = resolveProvider(kind, { learnerLang: sourceLang, targetLang, model });
    if (!provider.converse) {
      return failureResponse(
        providerFailure(
          "provider_not_configured",
          "Esta IA não consegue conversar. Escolha outra IA em Configurações para praticar.",
        ),
      );
    }

    const reply = await provider.converse(history, {
      scenario,
      targetLang,
      sourceLang,
      level,
      challenge,
      conversationStage,
      maxTurns,
      followUpDepth,
      promptStyle,
      speakerFamiliarity,
    });
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Conversation error");
    return failureResponse(failure);
  }
}
