"use client";

import { isStoreAvailable } from "@/lib/store/db";
import { saveApkg } from "@/features/cards/downloadApkg";
import type { Card } from "@/lib/cards/schema";

export interface DeckPayload {
  cards?: Card[];
  count?: number;
  filename?: string;
  apkg?: string;
  debugId?: string;
  debugLog?: string;
}

/**
 * Shared post-processing for a generated deck: persist it locally for the Study tab (when the
 * store is available), then write the .apkg to disk. Returns the user-facing success message.
 *
 * `persist` is the store writer for this ingestion path (saveCorrectionDeck vs saveGeneratedDeck);
 * the caller closes over its other argument (events / candidates) and we only invoke it when the
 * local store is available.
 */
export async function exportAndSaveDeck(
  data: DeckPayload,
  options: {
    defaultFilename: string;
    persist: (cards: Card[]) => Promise<unknown>;
  },
): Promise<string> {
  let savedNote = "";
  if (isStoreAvailable() && data.cards) {
    try {
      await options.persist(data.cards);
      savedNote = " · saved for study";
    } catch {
      savedNote = " · couldn't save locally";
    }
  }

  if (!data.apkg) {
    throw new Error("Cards were generated, but the Anki package was missing.");
  }
  const fileNote = await saveApkg(data.filename || options.defaultFilename, data.apkg);

  const count = data.count ?? data.cards?.length ?? 0;
  const debugNote = data.debugId ? ` · debug ${data.debugId}` : "";
  return `${count} card${count === 1 ? "" : "s"} exported — ${fileNote}${savedNote}${debugNote}.`;
}
