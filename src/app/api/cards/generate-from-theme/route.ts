import { NextRequest, NextResponse } from "next/server";
import { normalizeContext } from "@/lib/cards/context";
import type { PhraseCandidate } from "@/lib/cards/schema";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject, safeString } from "@/server/http/validation";
import { MAX_CORRECTION_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_THEME_CHARS = 200;
const MAX_PHRASES = 20;
const DEFAULT_COUNT = 10;

function parseCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(MAX_PHRASES, Math.max(3, Math.round(n))) : DEFAULT_COUNT;
}

function localPhrases(theme: string, count: number): string[] {
  const clean = theme.trim() || "everyday conversation";
  const generic = [
    `Could you help me with ${clean}?`,
    `I'm trying to figure out ${clean}.`,
    `What would you recommend for ${clean}?`,
    `I need a little more time to decide.`,
    `Could you say that another way?`,
    `That works for me, thank you.`,
    `I'm not sure I understood the last part.`,
    `Can we go over the details again?`,
    `I'd like to make sure I got this right.`,
    `Is there anything else I should know?`,
    `That sounds good, but I have one question.`,
    `Could we start with the most important point?`,
  ];
  return generic.slice(0, count);
}

function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 180);
}

function unique(values: string[], count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= count) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
  if (!obj) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const theme = safeString(obj.theme, "", MAX_THEME_CHARS);
  if (!theme) return NextResponse.json({ error: "Enter a theme first." }, { status: 400 });

  const count = parseCount(obj.count);
  const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
  if (!isProviderAvailable(kind)) {
    return NextResponse.json({ error: `${kind} provider is unavailable.` }, { status: 400 });
  }

  const model = safeString(obj.ollamaModel, "", 100) || undefined;
  const provider = resolveProvider(kind, { model });
  let phrases: string[] = [];

  if (provider.converse && kind !== "local") {
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

  phrases = unique(phrases.length > 0 ? phrases : localPhrases(theme, count), count);
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
