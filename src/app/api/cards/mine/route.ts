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

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SEGMENTS = 400;
const PUBLIC_MINE_ERROR =
  "Couldn't preselect segments right now. You can still choose them manually.";

function isProviderKind(v: unknown): v is ProviderKind {
  return v === "local" || v === "ollama" || v === "claude" || v === "openai";
}

function safeStr(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return (s || fallback).slice(0, maxLen);
}

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
    const body = (await req.json().catch(() => null)) as unknown;
    const obj = isPlainObject(body) ? body : null;
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : "local";
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        {
          error:
            kind === "local"
              ? "Local provider unavailable."
              : `${kind} provider has no API key configured.`,
        },
        { status: 400 },
      );
    }

    const segments = (Array.isArray(obj.segments) ? obj.segments : [])
      .slice(0, MAX_SEGMENTS)
      .map(toSegment)
      .filter((s): s is TranscriptSegment => s !== null);
    if (segments.length === 0) {
      return NextResponse.json({ error: "No transcript segments to curate." }, { status: 400 });
    }

    const sourceId = safeStr(obj.sourceId, "discover", 64);
    const source: ContentSource = {
      id: sourceId,
      kind: safeSourceKind(obj.sourceKind),
      title: safeStr(obj.title, "Discover source", 200),
      url: safeStr(obj.url, "", 2048) || undefined,
      lang: "en",
      createdAt: Date.now(),
    };

    const model = safeStr(obj.ollamaModel, "", 100) || undefined;
    const provider = resolveProvider(kind, { model });
    const candidates = await provider.mine(segments, {
      source,
      focus: safeStr(obj.focus, "", 500) || undefined,
      targetLevel: safeLevel(obj.targetLevel),
      targetLang: "en",
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
    console.error("Card mining error:", err);
    return NextResponse.json({ error: PUBLIC_MINE_ERROR }, { status: 500 });
  }
}
