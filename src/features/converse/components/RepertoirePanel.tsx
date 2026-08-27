"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import { listItem, staggerContainer } from "@/lib/motion";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { buildRepertoireCards, repertoireUptake, type RepertoireItem } from "@/features/converse/repertoire";
import { emitActivity } from "@/lib/store/activityLog";

/**
 * The expressions the partner introduced this session, kept beside the conversation so an
 * advanced learner can see what they are actually collecting — the point of the practice at
 * C1-C2 is repertoire, and repertoire that scrolls away unnoticed is not collected at all.
 *
 * Each one is marked heard or said, because the distinction is the whole game at this level:
 * an expression you have only been shown is not repertoire yet.
 */
export function RepertoirePanel({
  items,
  context,
  conversationId,
}: {
  items: RepertoireItem[];
  context: string;
  conversationId: string;
}) {
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  const { cards, candidates, skipped } = buildRepertoireCards(items, { context, conversationId });
  const uptake = repertoireUptake(items);

  const save = async () => {
    if (cards.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const { added } = await saveGeneratedDeck(cards, candidates);
      setSaved(added);
      void emitActivity("cards_created", { source: "converse", count: added });
    } catch {
      setError(t("Couldn't save these to your cards."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="flex min-h-0 w-full flex-col border-t border-line bg-surface lg:w-72 lg:border-l lg:border-t-0">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Worth stealing")}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t("You've said {used} of {total} back.", { used: uptake.used, total: uptake.total })}
        </p>
      </div>

      <motion.ul
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 app-scroll-region"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {items.map((item) => (
          <motion.li
            key={item.expression.toLowerCase()}
            variants={listItem}
            className={cn(
              "rounded-lg border p-2.5",
              item.usedAt ? "border-success/40 bg-success/5" : "border-line bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">{item.expression}</p>
              {item.usedAt && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-success">
                  {t("said")}
                </span>
              )}
            </div>
            {item.gloss && <p className="mt-0.5 text-xs text-ink-muted">{item.gloss}</p>}
          </motion.li>
        ))}
      </motion.ul>

      <div className="space-y-1.5 border-t border-line px-4 py-3">
        {error && <p className="text-xs text-danger">{error}</p>}
        {saved !== null ? (
          <p className="text-xs text-success">
            {saved === 0 ? t("Already in your cards.") : t("Saved {count} to your cards.", { count: saved })}
          </p>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => void save()}
              disabled={saving || cards.length === 0}
              className="h-9 w-full"
            >
              {saving ? t("Saving…") : t("Keep {count} as cards", { count: cards.length })}
            </Button>
            {skipped.length > 0 && (
              <p className="text-[11px] text-ink-muted">
                {t("{count} without a meaning were left out.", { count: skipped.length })}
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
