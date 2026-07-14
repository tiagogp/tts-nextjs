"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getCards,
  getConversations,
  getCounts,
  getDueCards,
  getErrorEvents,
  getPronunciationAttempts,
  getReviews,
} from "@/lib/store/repository";
import { getActivityLog } from "@/lib/store/activityLog";
import { returnMomentFor, type ReturnMoment } from "@/features/home/returnMoment";
import { deriveMethodPlan, type MethodPlan, type MethodRoute } from "@/features/method/learningLoop";
import { useT } from "@/i18n/I18nProvider";
import { completedLessonIdsFromCardIds, firstLesson, nextLessonFor, type Lesson } from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";

interface HojeHomeProps {
  onStudy: () => void;
  onDiscover: () => void;
  onCorrect: () => void;
  onFirstLesson: () => void;
  onLesson: (lessonId?: string) => void;
}

interface NextAction {
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  onClick: () => void;
}

/**
 * "Hoje" — the app's front door. It answers a single question for the learner:
 * what is the one next thing to do right now? Resolution order: (a) today's first
 * due phrases → Study, mistakes → Correct, practice → next phrase, or a
 * brand-new user with no saved phrases → bundled first lesson. One CTA, never a dashboard.
 */
export function HojeHome({ onStudy, onDiscover, onCorrect, onFirstLesson, onLesson }: HojeHomeProps) {
  const { t } = useT();
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0, errors: 0 });
  const [nextLesson, setNextLesson] = useState<Lesson>(() => nextLessonFor(getLearningProfile(), []) ?? firstLesson());
  const [returnMoment, setReturnMoment] = useState<ReturnMoment | null>(null);
  const [methodPlan, setMethodPlan] = useState<MethodPlan | null>(null);
  // Start "loading" on both server and client so the first render matches during
  // hydration. isStoreAvailable() is false during SSR and true in the browser, so
  // seeding this from it directly rendered the loaded state on the server and the
  // spinner on the client — a hydration mismatch on the first screen. load()'s
  // finally flips it once the read settles (even if the store is unavailable).
  const [countsLoaded, setCountsLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextCounts, reviews, cards, errors, activity, dueCards, conversations, pronunciationAttempts] = await Promise.all([
        getCounts(),
        getReviews(),
        getCards(),
        getErrorEvents(),
        getActivityLog(),
        getDueCards(),
        getConversations(),
        getPronunciationAttempts(),
      ]);
      setCounts({ ...nextCounts, errors: errors.length });
      setReturnMoment(
        returnMomentFor({ dueCards: dueCards.map((item) => item.card), activity, errors }),
      );
      setMethodPlan(
        deriveMethodPlan({
          profile: getLearningProfile(),
          activity,
          snapshot: {
            cards: nextCounts.cards,
            due: nextCounts.due,
            reviews,
            errorEvents: errors,
            conversations,
            pronunciationAttempts,
          },
        }),
      );
      setNextLesson(
        nextLessonFor(
          getLearningProfile(),
          completedLessonIdsFromCardIds(cards.map((card) => card.id)),
        ) ?? firstLesson(),
      );
    } finally {
      setCountsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  // Keep the next-action card fresh if a method_stage (or any activity) event
  // fires while the learner is sitting on Hoje — e.g. a Discover tab kept
  // open in another pane — rather than only refreshing on remount.
  useEffect(() => {
    if (!isStoreAvailable()) return;
    const handle = () => {
      void load().catch(() => undefined);
    };
    window.addEventListener("phraseloop:activity", handle);
    window.addEventListener("phraseloop:lesson-saved", handle);
    return () => {
      window.removeEventListener("phraseloop:activity", handle);
      window.removeEventListener("phraseloop:lesson-saved", handle);
    };
  }, [load]);

  const hasProgress = counts.cards > 0 || counts.reviews > 0;
  const loading = !countsLoaded;

  const action = resolveNextAction({
    t,
    counts,
    onStudy,
    onDiscover,
    onFirstLesson,
    onCorrect,
    onLesson,
    nextLesson,
    returnMoment,
    methodPlan,
  });

  return (
    <div className="space-y-5">
      <Card className="surface-grid-glow space-y-4 p-5">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-ink-muted">
            <Spinner className="h-4 w-4" />
            {t("Loading your day…")}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.7px] text-accent">{action.eyebrow}</p>
              <p className="text-lg font-semibold tracking-[-0.01em] text-ink">{action.title}</p>
              <p className="text-sm text-ink-soft">{action.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" className="min-h-10" onClick={action.onClick}>
                {action.cta}
              </Button>
            </div>
          </>
        )}
      </Card>

      {!loading && hasProgress && (
        <div className="grid grid-cols-2 gap-3">
          <Stat value={`${counts.due}`} label={t("to review")} />
          <Stat value={`${counts.cards}`} label={t("practice phrases")} />
        </div>
      )}
    </div>
  );
}

function resolveNextAction({
  t,
  counts,
  onStudy,
  onDiscover,
  onFirstLesson,
  onCorrect,
  onLesson,
  nextLesson,
  returnMoment,
  methodPlan,
}: {
  t: (en: string, vars?: Record<string, string | number>) => string;
  counts: { cards: number; reviews: number; due: number; errors: number };
  onStudy: () => void;
  onDiscover: () => void;
  onFirstLesson: () => void;
  onCorrect: () => void;
  onLesson: (lessonId?: string) => void;
  nextLesson: Lesson;
  returnMoment: ReturnMoment | null;
  methodPlan: MethodPlan | null;
}): NextAction {
  // Return-day moment with a true mistake claim: every counted mistake is a due
  // card whose provenance points at a real error. Zero mistake cards falls through
  // to the plain due branch — the claim is never made without the card behind it.
  if (returnMoment && returnMoment.mistakeCards > 0) {
    const { due, mistakeCards, fromYesterday } = returnMoment;
    const title = fromYesterday
      ? mistakeCards === 1
        ? t("{count} cards for today — 1 came from your mistake yesterday", { count: due })
        : t("{count} cards for today — {mistakes} came from your mistakes yesterday", {
            count: due,
            mistakes: mistakeCards,
          })
      : mistakeCards === 1
        ? t("{count} cards for today — 1 came from your mistake", { count: due })
        : t("{count} cards for today — {mistakes} came from your mistakes", {
            count: due,
            mistakes: mistakeCards,
          });
    return {
      eyebrow: t("Today"),
      title,
      detail: fromYesterday
        ? t("Review while yesterday is still fresh.")
        : t("Reviewing your own mistakes is what makes them stick."),
      cta: t("Start today's review"),
      onClick: onStudy,
    };
  }

  if (methodPlan) {
    return {
      eyebrow: t("Today"),
      title: t(methodPlan.action.title),
      detail: t(methodPlan.action.detail),
      cta: t(methodPlan.action.cta),
      onClick: routeHandler(methodPlan.action.route, {
        onStudy,
        onDiscover,
        onFirstLesson,
        onCorrect,
        onLesson,
        nextLesson,
      }),
    };
  }

  // Due phrases waiting to be reviewed.
  if (counts.due > 0) {
    return {
      eyebrow: t("Now do this"),
      title: t("{count} practice phrases due", { count: counts.due }),
      detail: t("Review these before adding more, so nothing piles up."),
      cta: t("Review now"),
      onClick: onStudy,
    };
  }

  // Mistakes already found — turn them into study material.
  if (counts.errors > 0) {
    return {
      eyebrow: t("Correct mistakes"),
      title: t("Save your mistakes for study"),
      detail: t("Turn recent corrections into phrases you can review tomorrow."),
      cta: t("Save to study"),
      onClick: onCorrect,
    };
  }

  // Has phrases, nothing due — practice one phrase without adding load.
  if (counts.cards > 0) {
    return {
      eyebrow: t("You're caught up"),
      title: t("{lesson} ({level})", { lesson: t(nextLesson.title), level: nextLesson.level }),
      detail: t("Tomorrow you review these phrases. Today you can practice one more."),
      cta: t("Practice a phrase"),
      onClick: () => onLesson(nextLesson.id),
    };
  }

  // Brand-new user, no saved phrases yet → start with the bundled first lesson.
  return {
    eyebrow: t("Start here"),
    title: t("Start with one short lesson"),
    detail: t("Listen, save one useful phrase, and use it in a sentence of your own."),
    cta: t("Start first lesson"),
    onClick: onFirstLesson,
  };
}

function routeHandler(
  route: MethodRoute,
  handlers: {
    onStudy: () => void;
    onDiscover: () => void;
    onFirstLesson: () => void;
    onCorrect: () => void;
    onLesson: (lessonId?: string) => void;
    nextLesson: Lesson;
  },
): () => void {
  if (route === "review") return handlers.onStudy;
  if (route === "correct") return handlers.onCorrect;
  if (route === "discover") return handlers.onDiscover;
  if (route === "lesson") return handlers.onFirstLesson;
  return () => handlers.onLesson(handlers.nextLesson.id);
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card className="px-3 py-3 text-center">
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.5px] text-ink-muted">{label}</p>
    </Card>
  );
}
