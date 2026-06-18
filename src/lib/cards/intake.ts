/**
 * Shared intake validators: shape untrusted request bodies into the typed source
 * objects (`PhraseCandidate` / `ErrorEvent`) the generation pipeline consumes.
 *
 * Used by both the discovery/correction deck route (`/api/cards/generate`) and the
 * weakness-driven reinforcement route (`/api/cards/reinforce`), so the two stay in
 * lockstep on what counts as a usable source.
 */

import { isPlainObject } from "@/lib/isObject";
import type { ErrorEvent, ErrorType, PhraseCandidate } from "./schema";

export const ERROR_TYPES = new Set<ErrorType>([
  "collocation",
  "preposition",
  "tense",
  "article",
  "word-order",
  "idiom",
  "vocabulary",
  "register",
  "other",
]);

export function safeStr(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return (s || fallback).slice(0, maxLen);
}

export function toErrorTypes(raw: unknown): ErrorType[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter(
    (t): t is ErrorType => typeof t === "string" && ERROR_TYPES.has(t as ErrorType),
  );
  return [...new Set(valid)];
}

/**
 * Build a PhraseCandidate from untrusted input. Returns null if unusable.
 * `sourceId` is passed in so callers control provenance: the discovery route uses
 * the single request-level source; reinforcement preserves each candidate's own.
 */
export function toCandidate(raw: unknown, sourceId: string): PhraseCandidate | null {
  if (!isPlainObject(raw)) return null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return null;
  const startMs = Number(raw.startMs);
  const endMs = Number(raw.endMs);
  return {
    id: safeStr(raw.id, crypto.randomUUID(), 64),
    sourceId,
    text: text.slice(0, 1000),
    translation:
      typeof raw.translation === "string" ? raw.translation.slice(0, 1000) : undefined,
    status: "accepted",
    startMs: Number.isFinite(startMs) ? Math.max(0, Math.round(startMs)) : undefined,
    endMs: Number.isFinite(endMs) ? Math.max(0, Math.round(endMs)) : undefined,
    createdAt: Date.now(),
  };
}

/**
 * Build an ErrorEvent from the native-correction tool's output. Returns null if
 * unusable. The id is preserved when present so the generated card's `source`
 * pointer matches the ErrorEvent the client persists locally.
 */
export function toErrorEvent(raw: unknown): ErrorEvent | null {
  if (!isPlainObject(raw)) return null;
  const original = typeof raw.original === "string" ? raw.original.trim() : "";
  const corrected = typeof raw.corrected === "string" ? raw.corrected.trim() : "";
  if (!original || !corrected) return null;
  const errorTypes = toErrorTypes(raw.errorTypes);
  return {
    id: safeStr(raw.id, crypto.randomUUID(), 64),
    original: original.slice(0, 1000),
    corrected: corrected.slice(0, 1000),
    errorTypes: errorTypes.length > 0 ? errorTypes : ["other"],
    sourceLang: safeStr(raw.sourceLang, "pt", 16),
    targetLang: safeStr(raw.targetLang, "en", 16),
    rationale:
      typeof raw.rationale === "string" && raw.rationale.trim()
        ? raw.rationale.trim().slice(0, 2000)
        : undefined,
    createdAt: Date.now(),
  };
}
