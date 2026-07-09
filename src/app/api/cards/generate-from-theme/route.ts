import { NextRequest, NextResponse } from "next/server";
import { normalizeContext } from "@/lib/cards/context";
import type { PhraseCandidate } from "@/lib/cards/schema";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isHttpError, isProviderKind, readJsonObject, safeString } from "@/server/http/validation";
import { failureResponse, providerFailure } from "@/server/http/providerFailure";
import { languageLabel } from "@/features/settings/languages";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { MAX_THEME_CHARS } from "@/app/api/cards/_lib/constants";
import {
  fallbackThemePhrases,
  linesFromText,
  parseThemePhraseCount,
  uniquePhrases,
} from "@/app/api/cards/_lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let obj: Awaited<ReturnType<typeof readJsonObject>>;
  try {
    obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
  if (!obj) return failureResponse(providerFailure("invalid_input"));

  const theme = safeString(obj.theme, "", MAX_THEME_CHARS);
  if (!theme) {
    return failureResponse(providerFailure("invalid_input", "Digite um tema primeiro."));
  }

  const count = parseThemePhraseCount(obj.count);
  const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
  if (!isProviderAvailable(kind)) {
    return failureResponse(providerFailure("provider_not_configured"));
  }

  const sourceLang = safeString(obj.sourceLang, "pt", 16);
  const targetLang = safeString(obj.targetLang, "en", 16);
  const targetLabel = languageLabel(targetLang);
  const model = safeString(obj.ollamaModel, "", 100) || undefined;
  const provider = resolveProvider(kind, { learnerLang: sourceLang, targetLang, model });
  let phrases: string[] = [];

  if (provider.converse) {
    const prompt = [
      `Generate ${count} natural, useful ${targetLabel} phrases for this theme: ${theme}.`,
      `Return exactly one phrase per line.`,
      `No numbering, no translations, no explanations.`,
      `Prefer phrases a learner can actually say in the situation.`,
    ].join(" ");
    try {
      const text = await provider.converse([], {
        scenario: prompt,
        targetLang,
        sourceLang,
        level: safeString(obj.level, "A1", 8),
      }, { signal: req.signal, timeoutMs: 60_000 });
      phrases = linesFromText(text);
    } catch (error) {
      logger.error({ err: error }, "Theme phrase generation failed; falling back locally");
    }
  }

  phrases = uniquePhrases(phrases.length > 0 ? phrases : fallbackThemePhrases(theme, count), count);
  const sourceId = `theme-${crypto.randomUUID()}`;
  const now = Date.now();
  const context = normalizeContext(theme);
  const candidates: PhraseCandidate[] = phrases.map((text, index) => ({
    id: `${sourceId}-${index}`,
    sourceId,
    text,
    note: context ? `Theme: ${context}` : `Theme: ${theme}`,
    status: "suggested",
    segmentIndex: index,
    createdAt: now,
  }));

  return NextResponse.json({
    sourceId,
    title: `Theme - ${theme}`,
    candidates,
    count: candidates.length,
  });
}
