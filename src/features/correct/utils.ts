import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import { normalizeContext } from "@/lib/cards/context";
import { CORRECTION_ERROR_TYPES } from "./constants";
import type { CorrectionDraft } from "./types";

const ERROR_TYPE_SET = new Set<string>(CORRECTION_ERROR_TYPES);

export function newDraft(): CorrectionDraft {
  return { original: "", corrected: "", errorTypes: [], rationale: "" };
}

/** Best-effort parse of the correction tool's JSON output into ErrorEvents. */
export function parseErrorsJson(raw: string): ErrorEvent[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const now = Date.now();
  const out: ErrorEvent[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const original = typeof o.original === "string" ? o.original.trim() : "";
    const corrected = typeof o.corrected === "string" ? o.corrected.trim() : "";
    if (!original || !corrected) continue;
    const types = Array.isArray(o.errorTypes)
      ? o.errorTypes.filter((t): t is ErrorType => typeof t === "string" && ERROR_TYPE_SET.has(t))
      : [];
    out.push({
      id: crypto.randomUUID(),
      original,
      corrected,
      errorTypes: types.length > 0 ? [...new Set(types)] : ["other"],
      sourceLang: typeof o.sourceLang === "string" ? o.sourceLang : "pt",
      targetLang: typeof o.targetLang === "string" ? o.targetLang : "en",
      rationale: typeof o.rationale === "string" && o.rationale.trim() ? o.rationale.trim() : undefined,
      context: normalizeContext(typeof o.context === "string" ? o.context : undefined),
      createdAt: now,
    });
  }
  return out;
}
