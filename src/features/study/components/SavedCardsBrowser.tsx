"use client";

import { useId, useMemo, useState } from "react";
import { Card as UiCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { Card } from "@/lib/cards/schema";
import { useT } from "@/i18n/I18nProvider";

export function SavedCardsBrowser({ cards }: { cards: Card[] }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards.slice(0, 30);
    return cards
      .filter((card) =>
        [card.front, card.back, card.concept, card.errorType, card.context]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [cards, query]);

  return (
    <UiCard className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Saved practice phrases")}</p>
          <p className="text-xs text-ink-muted">{t("{count} total", { count: cards.length })}</p>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor={searchId} className="sr-only">{t("Search saved phrases")}</label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search phrases")}
            className="h-9 w-full text-sm sm:w-72"
          />
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("Practice phrases you save will appear here.")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("No phrases match that search.")}</p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto pr-1">
          {filtered.map((card) => (
            <li key={card.id} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-x-6">
              <p className="text-sm leading-relaxed text-ink">{card.front}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{card.back}</p>
              {(card.concept || card.errorType || card.context) && (
                <p className="text-xs text-ink-muted sm:col-span-2">
                  {[card.concept, card.errorType, card.context].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </UiCard>
  );
}
