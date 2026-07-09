"use client";

import { useMemo, useState } from "react";
import { Card as UiCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { Card } from "@/lib/cards/schema";
import { useT } from "@/i18n/I18nProvider";

export function SavedCardsBrowser({ cards }: { cards: Card[] }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
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
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search phrases")}
          className="h-9 max-w-xs text-sm"
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("Practice phrases you save will appear here.")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("No phrases match that search.")}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {filtered.map((card) => (
            <li key={card.id} className="py-2.5">
              <p className="text-sm text-ink">{card.front}</p>
              <p className="mt-1 text-sm text-ink-soft">{card.back}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {card.concept}
                {card.errorType ? ` · ${card.errorType}` : ""}
                {card.context ? ` · ${card.context}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </UiCard>
  );
}
