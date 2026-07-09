/**
 * Curate transcript segments before the user reviews them.
 *
 * The Discover UI sends raw transcript/article/PDF segments here after extraction.
 * The selected provider chooses the lines worth learning, using the optional focus
 * and target English level, and returns segment indexes for preselection.
 */

import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import type { ContentSource, TranscriptSegment } from "@/lib/cards/schema";
import { getDefaultProvider } from "@/server/aiSettings";
import { isHttpError, isProviderKind, readJsonObject, safeString } from "@/server/http/validation";
import { classifyProviderFailure, failureResponse, providerFailure } from "@/server/http/providerFailure";
import { MAX_CARD_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SEGMENTS = 400;

function safeSourceKind(v: unknown): ContentSource["kind"] {
  return v === "article" || v === "pdf" || v === "youtube" ? v : "youtube";
}

function safeLevel(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  return /^(a1|a2|b1|b2|c1|c2)$/.test(s) ? s.toUpperCase() : undefined;
}

function toSegment(raw: unknown): TranscriptSegment | null {
  if (!isPlainObject(raw)) return null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return null;
  const startMs = Number(raw.startMs);
  const endMs = Number(raw.endMs);
  return {
    text: text.slice(0, 1000),
    startMs: Number.isFinite(startMs) ? Math.max(0, Math.round(startMs)) : 0,
    endMs: Number.isFinite(endMs) ? Math.max(0, Math.round(endMs)) : 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CARD_JSON_BYTES });
    if (!obj) {
      return failureResponse(providerFailure("invalid_input"));
    }

    const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
    if (!isProviderAvailable(kind)) {
      return failureResponse(providerFailure("provider_not_configured"));
    }

    const segments = (Array.isArray(obj.segments) ? obj.segments : [])
      .slice(0, MAX_SEGMENTS)
      .map(toSegment)
      .filter((s): s is TranscriptSegment => s !== null);
    if (segments.length === 0) {
      return failureResponse(
        providerFailure(
          "invalid_input",
          "Nenhuma frase para selecionar. Importe um vídeo, artigo ou PDF primeiro.",
        ),
      );
    }

    const sourceId = safeString(obj.sourceId, "discover", 64);
    const sourceLang = safeString(obj.sourceLang, "pt", 16);
    const targetLang = safeString(obj.targetLang, "en", 16);
    const source: ContentSource = {
      id: sourceId,
      kind: safeSourceKind(obj.sourceKind),
      title: safeString(obj.title, "Discover source", 200),
      url: safeString(obj.url, "", 2048) || undefined,
      lang: targetLang,
      createdAt: Date.now(),
    };

    const model = safeString(obj.ollamaModel, "", 100) || undefined;
    const provider = resolveProvider(kind, { learnerLang: sourceLang, targetLang, model });
    const candidates = await provider.mine(segments, {
      source,
      focus: safeString(obj.focus, "", 500) || undefined,
      targetLevel: safeLevel(obj.targetLevel),
      targetLang,
    });

    const selectedIndexes = Array.from(
      new Set(
        candidates
          .map((c) => c.segmentIndex)
          .filter(
            (i): i is number =>
              typeof i === "number" && Number.isInteger(i) && i >= 0 && i < segments.length,
          ),
      ),
    );

    return NextResponse.json({
      candidates,
      selectedIndexes,
      count: selectedIndexes.length,
    });
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Card mining error");
    return failureResponse(failure);
  }
}
