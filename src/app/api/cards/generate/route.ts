/**
 * Card pipeline (B1 + E1): close the loop ingestion → card → Anki, for both paths.
 *
 * Discovery (B1): the user's accepted phrases (the "kept" transcript segments).
 * Correction (E1): the native-correction tool's output (original → corrected),
 * shaped into ErrorEvents.
 *
 * Both kinds of source run through the chosen provider's generate → ground →
 * critique → dedup pipeline (`generateDeck`), then the vetted cards go to the
 * extended .apkg engine — embedding the sliced native audio clip per card when
 * timestamps are available (discovery), or Kokoro TTS of the answer (correction).
 */

import { NextRequest, NextResponse } from "next/server";
import { contentDispositionAttachment } from "@/server/anki";
import { localJson } from "@/server/localRuntime";
import { generateDeck, isAbortError } from "@/lib/cards/provider";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import type { CardSource, ErrorEvent, PhraseCandidate } from "@/lib/cards/schema";
import { safeStr, toCandidate, toErrorEvent } from "@/lib/cards/intake";
import { getDefaultProvider } from "@/server/aiSettings";
import { isProviderKind, readJsonObject } from "@/server/http/validation";

export const runtime = "nodejs";
// Local LLM (Ollama) decks of several corrections run generate + critique sequentially and
// can exceed 5 min; keep the server ahead of the client's 420s abort.
export const maxDuration = 600;

const MAX_CANDIDATES = 200;
const MAX_ERRORS = 200;
const SERVER_GENERATION_TIMEOUT_MS = 390_000;
const PROVIDER_CALL_TIMEOUT_MS = 90_000;
const APKG_EXPORT_TIMEOUT_MS = 300_000;
const PUBLIC_CARD_EXPORT_ERROR =
  "Couldn't export the deck right now. Try again in a moment.";
const PUBLIC_CARD_GENERATION_ERROR =
  "Couldn't generate cards right now. Try again in a moment.";
const PUBLIC_CARD_TIMEOUT_ERROR =
  "Generation took too long. Try fewer phrases or another provider.";

interface ExportErrorPayload {
  error?: string;
  code?: string;
  downloading?: boolean;
  progress?: number;
}

function readExportError(body: Buffer): ExportErrorPayload {
  try {
    const parsed = JSON.parse(body.toString("utf8") || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ExportErrorPayload)
      : {};
  } catch {
    return {};
  }
}

function timeoutError(): Error {
  const error = new Error("Card generation timed out");
  error.name = "TimeoutError";
  return error;
}

function combinedSignal(signal: AbortSignal, timeoutMs: number): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(signal.reason);
  const timer = setTimeout(() => controller.abort(timeoutError()), timeoutMs);
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener("abort", abortFromRequest, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abortFromRequest);
    },
  };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req);
    if (!obj) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const kind: ProviderKind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
    if (!isProviderAvailable(kind)) {
      return NextResponse.json(
        {
          error:
            kind === "local"
              ? "Local provider unavailable."
              : `${kind} provider has no API key configured. Set the key in .env.local or pick Local.`,
        },
        { status: 400 },
      );
    }

    const sourceId = safeStr(obj.sourceId, "", 64);
    const deck = safeStr(obj.deck, "English - Discover", 200);
    const enKokoroVoice = safeStr(obj.enKokoroVoice, "af_heart", 64);
    // When the client persists cards locally (D1), it needs the card data back, so we
    // return JSON (cards + base64 .apkg) instead of the raw binary download.
    const wantCards = obj.persist === true;

    const rawCandidates = Array.isArray(obj.candidates) ? obj.candidates : [];
    const rawErrors = Array.isArray(obj.errors) ? obj.errors : [];
    if (rawCandidates.length === 0 && rawErrors.length === 0) {
      return NextResponse.json(
        { error: "No accepted phrases or corrections to generate from." },
        { status: 400 },
      );
    }
    const candidates = rawCandidates
      .slice(0, MAX_CANDIDATES)
      .map((c) => toCandidate(c, sourceId))
      .filter((c): c is PhraseCandidate => c !== null);
    // E1 — the correction path: native-correction output → ErrorEvent sources.
    const errors = rawErrors
      .slice(0, MAX_ERRORS)
      .map(toErrorEvent)
      .filter((e): e is ErrorEvent => e !== null);
    if (candidates.length === 0 && errors.length === 0) {
      return NextResponse.json(
        { error: "No usable phrases or corrections in the request." },
        { status: 400 },
      );
    }

    const scope = combinedSignal(req.signal, SERVER_GENERATION_TIMEOUT_MS);
    try {
      // Generate → ground → critique → dedup. Provider-agnostic, path-agnostic.
      const model = safeStr(obj.ollamaModel, "", 100) || undefined;
      const provider = resolveProvider(kind, { model });
      const sources: CardSource[] = [
        ...candidates.map((candidate): CardSource => ({ kind: "phrase", candidate })),
        ...errors.map((event): CardSource => ({ kind: "error", event })),
      ];
      const { cards, failures } = await generateDeck(provider, sources, {
        signal: scope.signal,
        timeoutMs: PROVIDER_CALL_TIMEOUT_MS,
      });

      if (cards.length === 0) {
        return NextResponse.json(
          {
            error:
              failures > 0
                ? `Generation failed for all ${failures} source(s) — likely a provider/network error. Try again, or pick the Local provider.`
                : "The quality gate dropped every source. Try keeping longer, more complete phrases, or fuller corrections.",
          },
          { status: failures > 0 ? 502 : 422 },
        );
      }

      // Attach native-clip coordinates so the export can slice the real audio (B3).
      const candidateById = new Map(candidates.map((c) => [c.id, c]));
      const clipByPhraseId = new Map(
        candidates.map((c) => [
          c.id,
          c.startMs != null && c.endMs != null
            ? { sourceId: c.sourceId, startMs: c.startMs, endMs: c.endMs }
            : null,
        ]),
      );
      const exportCards = cards.map((card) => ({
        front: card.front,
        back: card.back,
        concept: card.concept,
        errorType: card.errorType,
        source: card.source,
        audioText:
          card.source.kind === "phrase"
            ? (candidateById.get(card.source.id)?.text ?? card.back)
            : card.back,
        clip:
          card.source.kind === "phrase"
            ? clipByPhraseId.get(card.source.id) ?? undefined
            : undefined,
      }));

      const exported = await localJson("/cards/apkg", {
        cards: exportCards, deck, voice: enKokoroVoice,
      }, { timeoutMs: APKG_EXPORT_TIMEOUT_MS, signal: scope.signal });
      if (exported.status < 200 || exported.status >= 300) {
        const payload = readExportError(exported.body);
        console.error("Card export runtime failed:", exported.status, payload);
        return NextResponse.json(
          {
            error: payload.error ?? PUBLIC_CARD_EXPORT_ERROR,
            code: payload.code,
            downloading: payload.downloading,
            progress: payload.progress,
          },
          { status: exported.status },
        );
      }

      const apkg = exported.body;
      const filenameUtf8 = `${deck.trim() || "anki-deck"}.apkg`;

      if (wantCards) {
        return NextResponse.json({
          cards,
          count: cards.length,
          // Surface partial success so the client can warn "N sources failed" instead of
          // silently shipping a smaller deck than the user asked for.
          failed: failures,
          filename: filenameUtf8,
          apkg: apkg.toString("base64"),
        });
      }

      return new NextResponse(new Uint8Array(apkg), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": contentDispositionAttachment(filenameUtf8),
          "Content-Length": apkg.byteLength.toString(),
          "X-Card-Count": String(cards.length),
          "X-Card-Failures": String(failures),
        },
      });
    } finally {
      scope.dispose();
    }
  } catch (err: unknown) {
    if (isAbortError(err) || isTimeoutError(err)) {
      return NextResponse.json({ error: PUBLIC_CARD_TIMEOUT_ERROR }, { status: 504 });
    }
    console.error("Card generation error:", err);
    return NextResponse.json(
      { error: PUBLIC_CARD_GENERATION_ERROR },
      { status: 500 },
    );
  }
}
