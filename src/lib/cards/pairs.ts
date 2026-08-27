import type { Card, CardSource } from "@/lib/cards/schema";
import {
  isLikelyPortugueseText,
  meaningTextOfCard,
  targetTextOfCard,
} from "@/lib/cards/orientation";

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function sourceMap(sources: CardSource[]): Map<string, CardSource> {
  return new Map(
    sources.map((source) => [
      source.kind === "phrase" ? source.candidate.id : source.event.id,
      source,
    ]),
  );
}

function productiveCue(card: Card, source?: CardSource): string {
  if (source?.kind === "error") {
    return `Corrija esta frase em inglês sem ver o modelo: “${source.event.original}”`;
  }
  if (source?.kind === "phrase" && source.candidate.translation?.trim()) {
    return source.candidate.translation.trim();
  }
  const meaning = meaningTextOfCard(card).trim();
  if (isLikelyPortugueseText(meaning)) return meaning;
  const target = targetTextOfCard(card).trim();
  const tokens = target.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const visible = Math.max(1, Math.floor(tokens.length / 2));
    const cloze = [...tokens.slice(0, visible), ...tokens.slice(visible).map(() => "____")].join(" ");
    return `Complete em inglês de memória, sem ouvir o áudio: ${cloze}`;
  }
  return `Recupere esta expressão em inglês pela inicial: ${target.slice(0, 1)}____`;
}

/**
 * Turn provider cards into explicit receptive/productive pairs. Explicitly directed cards
 * (including guided-lesson cards) are preserved: their author already chose the retrieval
 * contract. Undefined legacy/provider cards are treated as recognition cards and receive a
 * production sibling whose prompt never exposes the English answer.
 */
export function buildProductiveCardPairs(cards: Card[], sources: CardSource[] = []): Card[] {
  const bySource = sourceMap(sources);
  const output: Card[] = [];
  const ids = new Set(cards.map((card) => card.id));

  for (const card of cards) {
    const target = targetTextOfCard(card).trim();
    const patternId = card.patternId || slug(card.concept || target) || card.source.id;
    const contexts = card.context ? [card.context] : undefined;

    if (card.direction) {
      output.push({ ...card, patternId, contexts: card.contexts ?? contexts });
      continue;
    }

    const recognition: Card = {
      ...card,
      direction: "recognition",
      patternId,
      contexts: card.contexts ?? contexts,
    };
    output.push(recognition);

    const baseId = `${card.id}--production`;
    let productionId = baseId;
    let suffix = 2;
    while (ids.has(productionId)) productionId = `${baseId}-${suffix++}`;
    ids.add(productionId);
    output.push({
      ...recognition,
      id: productionId,
      front: productiveCue(recognition, bySource.get(card.source.id)),
      back: target,
      direction: "production",
      skill: "speaking",
      audioClipPath: card.audioClipPath,
    });
  }

  return output;
}
