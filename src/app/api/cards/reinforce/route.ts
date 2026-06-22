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
  bestAvailableProviderAsync,
  isProviderAvailable,
  resolveProvider,
} from "@/lib/cards/registry";
import { safeStr, toCandidate, toErrorEvent } from "@/lib/cards/intake";
import type { CardSource, ErrorEvent, PhraseCandidate } from "@/lib/cards/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SOURCES = 50;
const PUBLIC_REINFORCE_ERROR =
  "Couldn't generate reinforcement cards right now. Try again in a moment.";

function isProviderKind(v: unknown): v is ProviderKind {
  return v === "local" || v === "ollama" || v === "claude" || v === "openai";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const obj = isPlainObject(body) ? body : null;
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Pick the explicit choice if usable, else the best key-backed provider available.
    const requested = isProviderKind(obj.provider) ? obj.provider : null;
    const kind: ProviderKind =
      requested && isProviderAvailable(requested)
        ? requested
        : await bestAvailableProviderAsync();

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
      return NextResponse.json(
        { error: "No usable sources to reinforce from." },
        { status: 400 },
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
      return NextResponse.json(
        {
          error:
            failures > 0
              ? "Generation failed — likely a provider/network error. Try again."
              : "The quality gate dropped every variant. Nothing new to add right now.",
        },
        { status: failures > 0 ? 502 : 422 },
      );
    }

    return NextResponse.json({ cards, count: cards.length, failed: failures });
  } catch (err: unknown) {
    console.error("Reinforcement generation error:", err);
    return NextResponse.json(
      { error: PUBLIC_REINFORCE_ERROR },
      { status: 500 },
    );
  }
}
