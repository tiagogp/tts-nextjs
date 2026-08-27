import type { ErrorType } from "@/lib/cards/schema";

/**
 * English display labels for error-type slugs. Components render them through
 * `t()` so learners see the pt-BR term (e.g. "word-order" → "word order" →
 * "ordem das palavras"). Unknown values fall back to the raw slug.
 */
export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  collocation: "collocation",
  preposition: "preposition",
  tense: "verb tense",
  article: "article",
  "word-order": "word order",
  idiom: "idiom",
  vocabulary: "vocabulary",
  register: "register",
  "missing-information": "missing information",
  pronunciation: "pronunciation",
  other: "other",
};

export function errorTypeLabel(type: string): string {
  return ERROR_TYPE_LABELS[type as ErrorType] ?? type;
}
