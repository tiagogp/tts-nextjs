import { NextRequest, NextResponse } from "next/server";
import { normalizeContext } from "@/lib/cards/context";
import type { PhraseCandidate } from "@/lib/cards/schema";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject, safeString } from "@/server/http/validation";
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
  const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
  if (!obj) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const theme = safeString(obj.theme, "", MAX_THEME_CHARS);
  if (!theme) return NextResponse.json({ error: "Enter a theme first." }, { status: 400 });

  const count = parseThemePhraseCount(obj.count);
  const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
  if (!isProviderAvailable(kind)) {
    return NextResponse.json({ error: `${kind} provider is unavailable.` }, { status: 400 });
  }

  const model = safeString(obj.ollamaModel, "", 100) || undefined;
  const provider = resolveProvider(kind, { model });
  let phrases: string[] = [];

  if (provider.converse) {
    const prompt = [
      `Generate ${count} natural, useful English phrases for this theme: ${theme}.`,
      `Return exactly one phrase per line.`,
      `No numbering, no translations, no explanations.`,
      `Prefer phrases a learner can actually say in the situation.`,
    ].join(" ");
    try {
      const text = await provider.converse([], {
        scenario: prompt,
        targetLang: "en",
        sourceLang: "pt",
        level: safeString(obj.level, "B1", 8),
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
