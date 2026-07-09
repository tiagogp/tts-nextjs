/**
 * D5 (a) — weakness-driven directed generation. The tutor loop, closed.
 *
 * Given the existing sources (PhraseCandidates / ErrorEvents) behind a weak concept
 * or error-type, generate fresh variant cards that drill the same concept from a new
 * angle. Grounded by construction: every card still points back to a real source the
 * learner already has, so this needs no new material and stays anti-hallucination-safe.
 *
 * Unlike `/api/cards/generate`, this builds no .apkg — reinforcement cards are studied
 * in-app (the Study tab / FSRS queue), so we just return the vetted `Card[]` for the
 * client to persist to IndexedDB. Lighter and faster: no Python round-trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { generateDeck } from "@/lib/cards/provider";
import type { ProviderKind } from "@/lib/cards/provider";
import {
  isProviderAvailable,
  resolveProvider,
} from "@/lib/cards/registry";
import { getDefaultProvider } from "@/server/aiSettings";
import { safeStr, toCandidate, toErrorEvent } from "@/lib/cards/intake";
import type { CardSource, ErrorEvent, PhraseCandidate } from "@/lib/cards/schema";
import { isHttpError, isProviderKind, readJsonObject } from "@/server/http/validation";
import {
  classifyProviderFailure,
  failureResponse,
  providerFailure,
} from "@/server/http/providerFailure";
import { MAX_CARD_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SOURCES = 50;

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CARD_JSON_BYTES });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    // Respect the explicit/global choice. Never send content to a different provider.
    const requested = isProviderKind(obj.provider) ? obj.provider : null;
    const kind: ProviderKind = requested ?? getDefaultProvider();
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const rawCandidates = Array.isArray(obj.candidates) ? obj.candidates : [];
    const rawErrors = Array.isArray(obj.errors) ? obj.errors : [];

    // Reinforcement preserves each candidate's own sourceId (sources span many origins),
    // unlike the discovery route which stamps one request-level source.
    const candidates = rawCandidates
      .slice(0, MAX_SOURCES)
      .map((c) =>
        toCandidate(c, isPlainObject(c) ? safeStr(c.sourceId, "", 64) : ""),
      )
      .filter((c): c is PhraseCandidate => c !== null);
    const errors = rawErrors
      .slice(0, MAX_SOURCES)
      .map(toErrorEvent)
      .filter((e): e is ErrorEvent => e !== null);

    if (candidates.length === 0 && errors.length === 0) {
      return failureResponse(
        providerFailure(
          "invalid_input",
          "Nenhuma frase ou correção salva para reforçar ainda. Estude alguns cards primeiro.",
        ),
      );
    }

    const model = safeStr(obj.ollamaModel, "", 100) || undefined;
    const provider = resolveProvider(kind, { model });
    const sources: CardSource[] = [
      ...candidates.map((candidate): CardSource => ({ kind: "phrase", candidate })),
      ...errors.map((event): CardSource => ({ kind: "error", event })),
    ];
    const { cards, failures } = await generateDeck(provider, sources);

    if (cards.length === 0) {
      return failureResponse(
        failures > 0
          ? providerFailure(
              "provider_failed",
              "A IA não conseguiu gerar cards de reforço desta vez — pode ser instabilidade na conexão. Tente de novo em instantes.",
            )
          : providerFailure(
              "empty_result",
              "Nenhuma variação nova desta vez. Continue estudando e tente de novo mais tarde.",
            ),
      );
    }

    return NextResponse.json({ cards, count: cards.length, failed: failures });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Reinforcement generation error");
    return failureResponse(failure);
  }
}
