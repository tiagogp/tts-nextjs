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

function csvCell(value: string | undefined): string {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function browserDownload(filename: string, text: string, type: string): string {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "check your downloads";
}

export function exportCardsCsv(cards: Card[], filename = "phraseloop-cards.csv"): string {
  const header = ["front", "back", "concept", "errorType", "context", "sourceKind", "sourceId"];
  const rows = cards.map((card) => [
    card.front,
    card.back,
    card.concept,
    card.errorType ?? "",
    card.context ?? "",
    card.source.kind,
    card.source.id,
  ]);
  return browserDownload(
    filename,
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}

export function exportCardsText(cards: Card[], filename = "phraseloop-cards.txt"): string {
  const text = cards
    .map((card, index) => [
      `${index + 1}. ${card.concept}`,
      `Front: ${card.front}`,
      `Back: ${card.back}`,
      card.errorType ? `Error: ${card.errorType}` : "",
      card.context ? `Context: ${card.context}` : "",
    ].filter(Boolean).join("\n"))
    .join("\n\n");
  return browserDownload(filename, `${text}\n`, "text/plain;charset=utf-8");
}

async function ankiConnect<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  const payload = (await response.json()) as { result: T; error: string | null };
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

export async function importCardsToAnkiConnect(
  cards: Card[],
  deckName = "PhraseLoop",
): Promise<string> {
  await ankiConnect("createDeck", { deck: deckName });
  const notes = cards.map((card) => ({
    deckName,
    modelName: "Basic",
    fields: {
      Front: card.front,
      Back: [
        card.back,
        card.concept ? `<br><small>${card.concept}</small>` : "",
        card.errorType ? `<br><small>${card.errorType}</small>` : "",
        card.context ? `<br><small>${card.context}</small>` : "",
      ].join(""),
    },
    tags: ["phraseloop", card.source.kind, card.errorType ?? "", card.context ?? ""].filter(Boolean),
    options: { allowDuplicate: false },
  }));
  const ids = await ankiConnect<(number | null)[]>("addNotes", { notes });
  const added = ids.filter((id) => id !== null).length;
  return `${added} card${added === 1 ? "" : "s"} sent to Anki`;
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
    preferAnkiConnect?: boolean;
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

  let fileNote: string;
  if (options.preferAnkiConnect && data.cards?.length) {
    try {
      fileNote = await importCardsToAnkiConnect(data.cards, "PhraseLoop");
    } catch {
      fileNote = await saveApkg(data.filename || options.defaultFilename, data.apkg);
      fileNote = `AnkiConnect unavailable; ${fileNote}`;
    }
  } else {
    fileNote = await saveApkg(data.filename || options.defaultFilename, data.apkg);
  }

  const count = data.count ?? data.cards?.length ?? 0;
  const debugNote = data.debugId ? ` · debug ${data.debugId}` : "";
  return `${count} card${count === 1 ? "" : "s"} exported — ${fileNote}${savedNote}${debugNote}.`;
}
