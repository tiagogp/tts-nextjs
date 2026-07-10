import type { Card, CardSource } from "@/lib/cards/schema";

const ENGLISH_MARKERS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "can",
  "do",
  "does",
  "for",
  "from",
  "get",
  "have",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "not",
  "of",
  "on",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

const PORTUGUESE_MARKERS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "me",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "que",
  "se",
  "sem",
  "sua",
  "te",
  "um",
  "uma",
  "voce",
]);

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return normalized(value).split(/\s+/).filter(Boolean);
}

function containsPortugueseAccent(value: string): boolean {
  return /[áàâãçéêíóôõúü]/i.test(value);
}

function scoreEnglish(value: string): number {
  const tokens = words(value);
  let score = 0;
  for (const token of tokens) {
    if (ENGLISH_MARKERS.has(token)) score += 1;
  }
  if (/\b(i'm|i've|i'd|don't|doesn't|can't|won't|you're|we're|it's|that's)\b/i.test(value)) score += 2;
  if (/\b(th|wh|ing)\w*\b/i.test(value)) score += 1;
  return score;
}

function scorePortuguese(value: string): number {
  const tokens = words(value);
  let score = containsPortugueseAccent(value) ? 2 : 0;
  for (const token of tokens) {
    if (PORTUGUESE_MARKERS.has(token)) score += 1;
  }
  if (/\b(nao|esta|estao|tenho|quero|preciso|obrigado|obrigada)\b/i.test(normalized(value))) score += 2;
  return score;
}

function isLikelyEnglish(value: string): boolean {
  const en = scoreEnglish(value);
  const pt = scorePortuguese(value);
  return en >= 2 && en > pt;
}

function isLikelyPortuguese(value: string): boolean {
  const en = scoreEnglish(value);
  const pt = scorePortuguese(value);
  return pt >= 2 && pt > en;
}

function sourceTargetText(source: CardSource | undefined): string {
  if (!source) return "";
  return source.kind === "phrase" ? source.candidate.text : source.event.corrected;
}

function sourceByCardId(sources: CardSource[]): Map<string, CardSource> {
  const byId = new Map<string, CardSource>();
  for (const source of sources) {
    byId.set(source.kind === "phrase" ? source.candidate.id : source.event.id, source);
  }
  return byId;
}

function sameOrContainedInTarget(value: string, target: string): boolean {
  const a = normalized(value);
  const b = normalized(target);
  return Boolean(a && b && (a === b || b.includes(a)));
}

function shouldSwapForEnglishFront(card: Card, source: CardSource | undefined): boolean {
  if (!card.front || !card.back) return false;
  const target = sourceTargetText(source);
  if (
    target &&
    sameOrContainedInTarget(card.back, target) &&
    !sameOrContainedInTarget(card.front, target)
  ) {
    return true;
  }
  return isLikelyPortuguese(card.front) && isLikelyEnglish(card.back);
}

export function orientCardsForTargetFront(
  cards: Card[],
  sources: CardSource[],
  targetLang: string,
): Card[] {
  if (targetLang !== "en") return cards;
  const sourcesById = sourceByCardId(sources);
  return cards.map((card) => {
    if (!shouldSwapForEnglishFront(card, sourcesById.get(card.source.id))) return card;
    return {
      ...card,
      front: card.back,
      back: card.front,
    };
  });
}
