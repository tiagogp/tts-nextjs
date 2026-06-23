/**
 * A5 — Semantic dedup. Near-duplicate cards waste review time; this kills them.
 *
 * When the provider exposes an embedder (OpenAI does), we dedup on embedding
 * cosine similarity — true semantic dedup that catches paraphrases. With no
 * embedder (Claude has no embeddings API; the local provider is offline), we
 * fall back to a lexical cosine over token frequencies, which still catches the
 * obvious "same card, reworded slightly" cases. Either way the first card in a
 * cluster is kept and the rest are dropped.
 */

import type { Card } from "./schema";
import type { GenerationRunOptions } from "./provider";

/** Optional embedder a provider can supply for true semantic dedup. */
export type Embedder = (texts: string[], options?: GenerationRunOptions) => Promise<number[][]>;

const EMBED_THRESHOLD = 0.9; // cosine on real embeddings — paraphrases land high
const LEXICAL_THRESHOLD = 0.8; // cosine on token counts — needs surface overlap

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** What we compare: the concept + the prompt, since two cards can share a back. */
function fingerprint(card: Card): string {
  return `${card.concept}\n${card.front}`;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Lexical fallback: term-frequency vectors over the shared vocabulary. */
function lexicalVectors(texts: string[]): number[][] {
  const vocab = new Map<string, number>();
  const counts = texts.map((t) => {
    const c = new Map<string, number>();
    for (const tok of tokenize(t)) {
      if (!vocab.has(tok)) vocab.set(tok, vocab.size);
      c.set(tok, (c.get(tok) ?? 0) + 1);
    }
    return c;
  });
  return counts.map((c) => {
    const v = new Array(vocab.size).fill(0);
    for (const [tok, n] of c) v[vocab.get(tok)!] = n;
    return v;
  });
}

/**
 * Drop near-duplicate cards, keeping the first of each cluster.
 * Pass the provider's `embed` to get semantic dedup; omit it for lexical.
 */
export async function dedupeCards(
  cards: Card[],
  embed?: Embedder,
  options?: GenerationRunOptions,
): Promise<Card[]> {
  if (cards.length < 2) return cards;

  const fingerprints = cards.map(fingerprint);
  let vectors: number[][];
  let threshold: number;

  if (embed) {
    try {
      vectors = await embed(fingerprints, options);
      threshold = EMBED_THRESHOLD;
    } catch (error) {
      if (isAbortError(error)) throw error;
      vectors = lexicalVectors(fingerprints);
      threshold = LEXICAL_THRESHOLD;
    }
  } else {
    vectors = lexicalVectors(fingerprints);
    threshold = LEXICAL_THRESHOLD;
  }

  const kept: Card[] = [];
  const keptVectors: number[][] = [];
  for (let i = 0; i < cards.length; i++) {
    const isDup = keptVectors.some((kv) => cosine(kv, vectors[i]) >= threshold);
    if (!isDup) {
      kept.push(cards[i]);
      keptVectors.push(vectors[i]);
    }
  }
  return kept;
}
