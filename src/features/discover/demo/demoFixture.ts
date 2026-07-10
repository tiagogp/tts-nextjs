import type { Card, PhraseCandidate } from "@/lib/cards/schema";
import type { DiscoverResult } from "@/features/discover/types";
import { buildDeckFromPhrases } from "@/features/learn/lessonDeck";
import demoPhrases from "./demoPhrases.json";

/**
 * Bundled "Try demo" content so a brand-new user can run the whole
 * capture → study loop in ~2 minutes with no source, no model download, and no
 * AI provider. Phrases and translations are curated from the local Anki decks in
 * `assets/` (phrasal verbs + idioms, EN→PT); the audio clips under
 * `public/demo/audio/` are pre-generated with Kokoro by
 * `scripts/build-demo-fixture.mjs`. The shipped app never parses the decks or
 * synthesizes audio for the demo.
 */

export interface DemoPhrase {
  en: string;
  pt: string;
  concept: string;
  note: string;
  clip: string;
}

export const DEMO_PHRASES = demoPhrases as DemoPhrase[];

export const DEMO_SOURCE_ID = "demo-phrases";

/** A ready-made transcript so the demo lands straight in the review step. */
export const demoResult: DiscoverResult = {
  sourceId: DEMO_SOURCE_ID,
  title: "Exemplo — frases do dia a dia",
  hasAudio: true,
  segments: DEMO_PHRASES.map((phrase) => ({
    text: phrase.en,
    // Each phrase has its own bundled clip, so timestamps are unused; playback
    // reads `clipUrl` instead of seeking within one long file.
    startMs: 0,
    endMs: 0,
    clipUrl: phrase.clip,
  })),
};

/**
 * Build the deck for the phrases the user kept — the zero-AI counterpart to the
 * provider call in `generateDiscoverDeck`. Mirrors the candidate/card shapes the
 * real path produces so `saveGeneratedDeck` and the Study tab treat it the same.
 */
export function demoDeckFor(keptIndexes: Iterable<number>): {
  candidates: PhraseCandidate[];
  cards: Card[];
} {
  return buildDeckFromPhrases(DEMO_SOURCE_ID, DEMO_PHRASES, keptIndexes);
}

/** Stable card ids for the full demo deck — used to clear the sample from the store. */
export const DEMO_CARD_IDS = DEMO_PHRASES.map((_, i) => `${DEMO_SOURCE_ID}-card-${i}`);
