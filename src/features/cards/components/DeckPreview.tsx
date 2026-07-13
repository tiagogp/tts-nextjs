"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";
import { errorTypeLabel } from "@/lib/cards/errorTypeLabels";
import {
  exportAndSaveDeck,
  exportCardsCsv,
  exportCardsText,
  type DeckPayload,
} from "@/features/cards/exportDeck";
import type { Card } from "@/lib/cards/schema";

interface DeckPreviewProps {
  title?: string;
  data: DeckPayload;
  defaultFilename: string;
  persist: (cards: Card[]) => Promise<unknown>;
  onStudyNow?: () => void;
  onDismiss?: () => void;
  onExported?: () => void;
}

function basename(filename: string, extension: string): string {
  return filename.replace(/\.[^.]+$/, "") || `phraseloop-cards${extension}`;
}

export function DeckPreview({
  title,
  data,
  defaultFilename,
  persist,
  onStudyNow,
  onDismiss,
  onExported,
}: DeckPreviewProps) {
  const { t } = useT();
  const [busy, setBusy] = useState<"apkg" | "anki" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cards = data.cards ?? [];
  const filename = data.filename || defaultFilename;

  // Local-first: saving to your own study set is the primary action; Anki export is secondary.
  const saveAndStudy = async () => {
    setBusy("save");
    setNote(null);
    try {
      await persist(cards);
      onExported?.();
      if (onStudyNow) {
        onStudyNow();
      } else {
        setNote(
          cards.length === 1
            ? t("Saved 1 practice phrase to study.")
            : t("Saved {count} practice phrases to study.", { count: cards.length }),
        );
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : t("Could not save the study list."));
    } finally {
      setBusy(null);
    }
  };

  const exportDeck = async (preferAnkiConnect: boolean) => {
    setBusy(preferAnkiConnect ? "anki" : "apkg");
    setNote(null);
    try {
      const message = await exportAndSaveDeck(data, {
        defaultFilename,
        persist,
        preferAnkiConnect,
      });
      setNote(message);
      onExported?.();
    } catch (error) {
      setNote(error instanceof Error ? error.message : t("Could not export to Anki."));
    } finally {
      setBusy(null);
    }
  };

  if (cards.length === 0) return null;

  return (
    <UiCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{title ?? t("Study list preview")}</p>
          <p className="text-xs text-ink-muted">
            {cards.length === 1
              ? t("1 practice phrase ready to study")
              : t("{count} practice phrases ready to study", { count: cards.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.apkg && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void exportDeck(true)}
              >
                {busy === "anki" ? t("Sending…") : t("Export to Anki")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void exportDeck(false)}
              >
                {busy === "apkg" ? t("Exporting…") : t("Export for Anki")}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNote(exportCardsCsv(cards, `${basename(filename, ".csv")}.csv`))}
          >
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNote(exportCardsText(cards, `${basename(filename, ".txt")}.txt`))}
          >
            {t("Text")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void saveAndStudy()}
          >
            {busy === "save" ? t("Saving…") : onStudyNow ? t("Save & review now") : t("Save to study")}
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t("Dismiss")}
            </Button>
          )}
        </div>
      </div>

      {note && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5 text-xs text-ink-soft">
          <span>{note}</span>
          {onStudyNow && (
            <button type="button" onClick={onStudyNow} className="font-medium text-accent underline hover:no-underline">
              {t("Review now →")}
            </button>
          )}
        </div>
      )}

      <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">
        {cards.map((card) => (
          <li key={card.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.7px] text-ink-muted">{t("Front")}</p>
              <p className="text-sm leading-relaxed text-ink">{card.front}</p>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.7px] text-ink-muted">{t("Back side")}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{card.back}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {card.concept}
                {card.errorType ? ` · ${t(errorTypeLabel(card.errorType))}` : ""}
                {card.context ? ` · ${card.context}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </UiCard>
  );
}
