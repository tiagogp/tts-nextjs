"use client";

import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import type { Weakness } from "@/lib/srs/analytics";
import { useT } from "@/i18n/I18nProvider";

export function MethodCoach({
  due,
  cards,
  weeklyGoal,
  conversations,
  topWeakness,
  onDiscover,
  onConversation,
}: {
  due: number;
  cards: number;
  weeklyGoal: number;
  conversations: number;
  topWeakness: Weakness | null;
  onDiscover?: () => void;
  onConversation?: () => void;
}) {
  const { t } = useT();
  const remainingConversations = onConversation ? Math.max(0, weeklyGoal - conversations) : 0;
  const next = cards === 0
    ? {
        title: t("Save your first phrases"),
        text: t("Start with the demo or one source. Keep a small set so review stays light."),
        action: t("Open Discover"),
        onClick: onDiscover,
      }
    : due > 0
      ? {
          title: t("Review before adding more"),
          text: t("{count} practice phrases due now. Review first, then add more.", { count: due }),
          action: null,
          onClick: undefined,
        }
      : topWeakness
        ? {
            title: t("Reinforce {label}", { label: topWeakness.label }),
            text: t("Use the weak spots list below to practice saved phrases or create new variants."),
            action: null,
            onClick: undefined,
          }
        : remainingConversations > 0
          ? {
              title: t("Produce language this week"),
              text: t("{count} conversations left for your weekly rhythm.", {
                count: remainingConversations,
              }),
              action: t("Start conversation"),
              onClick: onConversation,
            }
          : {
              title: t("Add the next small batch"),
              text: t("You are caught up. Add fresh input only when you want more material."),
              action: t("Open Discover"),
              onClick: onDiscover,
            };

  return (
    <UiCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today's method")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{next.title}</p>
          <p className="mt-1 text-xs text-ink-muted">{next.text}</p>
        </div>
        {next.action && next.onClick && (
          <Button variant="secondary" size="sm" onClick={next.onClick}>
            {next.action}
          </Button>
        )}
      </div>
    </UiCard>
  );
}
