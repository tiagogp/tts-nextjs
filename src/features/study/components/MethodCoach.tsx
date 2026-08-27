"use client";

/**
 * The Review tab's coach renders the same `deriveMethodPlan` action shown on Hoje.
 * It must never run its own decision tree: two surfaces disagreeing about "what
 * next" is worse than either recommendation alone.
 */

import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import type { MethodPlan, MethodRoute } from "@/features/method/learningLoop";
import { useT } from "@/i18n/I18nProvider";

export function MethodCoach({
  plan,
  onDiscover,
  onConversation,
  onLesson,
  onCorrect,
}: {
  plan: MethodPlan | null;
  onDiscover?: () => void;
  onConversation?: () => void;
  onLesson?: () => void;
  onCorrect?: () => void;
}) {
  const { t } = useT();
  if (!plan) return null;

  const { action } = plan;
  // "review" gets no button: the learner is already looking at the queue.
  const handlers: Record<MethodRoute, (() => void) | undefined> = {
    review: undefined,
    discover: onDiscover,
    speak: onConversation,
    lesson: onLesson,
    correct: onCorrect,
  };
  const onClick = handlers[action.route];

  return (
    <UiCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Next step")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t(action.title)}</p>
          <p className="mt-1 text-xs text-ink-muted">{t(action.detail)}</p>
        </div>
        {onClick && (
          <Button variant="secondary" size="sm" onClick={onClick}>
            {t(action.cta)}
          </Button>
        )}
      </div>
    </UiCard>
  );
}
