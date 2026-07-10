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
const EMBED_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_EMBED_CACHE_ENTRIES = 1000;

const embeddingCache = new Map<string, { vector: number[]; expiresAt: number }>();

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

function contentHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function pruneEmbeddingCache(now = Date.now()): void {
  for (const [key, entry] of embeddingCache) {
    if (entry.expiresAt <= now || embeddingCache.size > MAX_EMBED_CACHE_ENTRIES) {
      embeddingCache.delete(key);
    }
  }
}

async function embedWithCache(
  texts: string[],
  embed: Embedder,
  cacheNamespace: string,
  options?: GenerationRunOptions,
): Promise<number[][]> {
  const now = Date.now();
  pruneEmbeddingCache(now);
  const vectors = new Array<number[]>(texts.length);
  const misses = new Map<string, { text: string; indexes: number[] }>();

  texts.forEach((text, index) => {
    const key = `${cacheNamespace}:${contentHash(text)}`;
    const cached = embeddingCache.get(key);
    if (cached && cached.expiresAt > now) {
      vectors[index] = cached.vector;
      return;
    }
    const miss = misses.get(key);
    if (miss) {
      miss.indexes.push(index);
    } else {
      misses.set(key, { text, indexes: [index] });
    }
  });

  options?.debug?.("cards-dedupe-embed-cache", {
    hits: texts.length - [...misses.values()].reduce((sum, miss) => sum + miss.indexes.length, 0),
    misses: misses.size,
    entries: embeddingCache.size,
    ttlMs: EMBED_CACHE_TTL_MS,
  });

  if (misses.size > 0) {
    const missEntries = [...misses.entries()];
    const embedded = await embed(missEntries.map(([, miss]) => miss.text), options);
    const expiresAt = Date.now() + EMBED_CACHE_TTL_MS;
    missEntries.forEach(([key, miss], missIndex) => {
      const vector = embedded[missIndex] ?? [];
      embeddingCache.set(key, { vector, expiresAt });
      for (const index of miss.indexes) vectors[index] = vector;
    });
  }

  return vectors;
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
  embedCacheNamespace = "default",
): Promise<Card[]> {
  if (cards.length < 2) {
    options?.debug?.("cards-dedupe-skipped", { cards: cards.length });
    return cards;
  }

  const fingerprints = cards.map(fingerprint);
  let vectors: number[][];
  let threshold: number;

  if (embed) {
    try {
      options?.debug?.("cards-dedupe-embed-started", {
        cards: cards.length,
        fingerprints: fingerprints.length,
      });
      vectors = await embedWithCache(fingerprints, embed, embedCacheNamespace, options);
      threshold = EMBED_THRESHOLD;
      options?.debug?.("cards-dedupe-embed-finished", {
        vectors: vectors.length,
        threshold,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      options?.debug?.("cards-dedupe-embed-failed-fallback-lexical", {
        error: error instanceof Error ? error.message : "unknown",
      });
      vectors = lexicalVectors(fingerprints);
      threshold = LEXICAL_THRESHOLD;
    }
  } else {
    options?.debug?.("cards-dedupe-lexical-started", {
      cards: cards.length,
    });
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
  options?.debug?.("cards-dedupe-result", {
    before: cards.length,
    after: kept.length,
    dropped: cards.length - kept.length,
    threshold,
  });
  return kept;
}
