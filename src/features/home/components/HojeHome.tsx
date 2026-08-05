"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getCards,
  getConversations,
  getCounts,
  getDueCards,
  getErrorEvents,
} from "@/lib/store/repository";
import { getActivityLog, type ActivityEvent } from "@/lib/store/activityLog";
import {
  returnMomentFor,
  type ReturnMoment,
} from "@/features/home/returnMoment";
import {
  deriveMethodPlan,
  type MethodPlan,
  type MethodRoute,
} from "@/features/method/learningLoop";
import { useT } from "@/i18n/I18nProvider";
import {
  completedLessonIdsFromCardIds,
  firstLesson,
  nextLessonFor,
  type Lesson,
} from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { TodayPlanCard } from "@/features/plan/components/TodayPlanCard";
import type { TaskItem } from "@/features/plan/schema";
import {
  buildTransferActivities,
  type TransferActivity,
} from "@/features/study/transfer";

interface HojeHomeProps {
  onStudy: () => void;
  onDiscover: () => void;
  onCorrect: () => void;
  onFirstLesson: () => void;
  onLesson: (lessonId?: string) => void;
  onSpeak: () => void;
  onOpenPlanTask: (task: TaskItem) => void;
  onCreatePlan: () => void;
  onInstallDefaultPlan: () => void;
}

interface NextAction {
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  onClick: () => void;
}

interface WeeklyTransferSuggestion {
  prompt: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isProductionAttemptEvent(
  event: ActivityEvent,
): event is ActivityEvent<"production_attempt"> {
  return event.type === "production_attempt";
}

/**
 * "Hoje" — the app's front door. It answers a single question for the learner:
 * what is the one next thing to do right now? Resolution order: (a) today's first
 * due phrases → Study, mistakes → Correct, practice → next phrase, or a
 * brand-new user with no saved phrases → bundled first lesson. One CTA, never a dashboard.
 */
export function HojeHome({
  onStudy,
  onDiscover,
  onCorrect,
  onFirstLesson,
  onLesson,
  onSpeak,
  onOpenPlanTask,
  onCreatePlan,
  onInstallDefaultPlan,
}: HojeHomeProps) {
  const { t } = useT();
  const [counts, setCounts] = useState({
    cards: 0,
    reviews: 0,
    due: 0,
    errors: 0,
  });
  const [nextLesson, setNextLesson] = useState<Lesson>(
    () => nextLessonFor(getLearningProfile(), []) ?? firstLesson(),
  );
  const [returnMoment, setReturnMoment] = useState<ReturnMoment | null>(null);
  const [methodPlan, setMethodPlan] = useState<MethodPlan | null>(null);
  const [weeklyTransfer, setWeeklyTransfer] =
    useState<WeeklyTransferSuggestion | null>(null);
  // Start "loading" on both server and client so the first render matches during
  // hydration. isStoreAvailable() is false during SSR and true in the browser, so
  // seeding this from it directly rendered the loaded state on the server and the
  // spinner on the client — a hydration mismatch on the first screen. load()'s
  // finally flips it once the read settles (even if the store is unavailable).
  const [countsLoaded, setCountsLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [
        nextCounts,
        cards,
        errors,
        conversations,
        activity,
        dueCards,
      ] = await Promise.all([
        getCounts(),
        getCards(),
        getErrorEvents(),
        getConversations(),
        getActivityLog(),
        getDueCards(),
      ]);
      setCounts({ ...nextCounts, errors: errors.length });
      setReturnMoment(
        returnMomentFor({
          dueCards: dueCards.map((item) => item.card),
          activity,
          errors,
        }),
      );
      setMethodPlan(
        deriveMethodPlan({
          profile: getLearningProfile(),
          activity,
          snapshot: {
            cards: nextCounts.cards,
            due: nextCounts.due,
            errorEvents: errors,
          },
        }),
      );
      setNextLesson(
        nextLessonFor(
          getLearningProfile(),
          completedLessonIdsFromCardIds(cards.map((card) => card.id)),
        ) ?? firstLesson(),
      );
      setWeeklyTransfer(
        weeklyTransferSuggestion(
          buildTransferActivities(cards, errors, conversations, 1)[0],
          activity,
        ),
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
    onSpeak,
    nextLesson,
    returnMoment,
    methodPlan,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("Your day")}
        title={t("Today")}
        description={t(
          "Start with the next useful action. Your plan and saved work stay within reach.",
        )}
        aside={
          !loading && hasProgress ? (
            <div className="grid grid-cols-2 gap-2" aria-live="polite">
              <Stat value={`${counts.due}`} label={t("to review")} />
              <Stat value={`${counts.cards}`} label={t("Saved")} />
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <Card className="surface-grid-glow space-y-4 p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4" />
              {t("Loading your day…")}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-[0.7px] text-accent">
                  {action.eyebrow}
                </p>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                  {action.title}
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
                  {action.detail}
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="min-h-11 sm:w-auto"
                onClick={action.onClick}
              >
                {action.cta}
              </Button>
            </>
          )}
        </Card>

        {!loading && (
          <TodayPlanCard
            onOpenTask={onOpenPlanTask}
            onCreatePlan={onCreatePlan}
            onInstallDefault={onInstallDefaultPlan}
            nextRoute={methodPlan?.action.route}
          />
        )}
        {!loading && weeklyTransfer && (
          <WeeklyTransferCard suggestion={weeklyTransfer} onStart={onStudy} />
        )}
      </div>
    </div>
  );
}

function weeklyTransferSuggestion(
  activity: TransferActivity | undefined,
  events: Awaited<ReturnType<typeof getActivityLog>>,
): WeeklyTransferSuggestion | null {
  if (!activity) return null;
  const cutoff = Date.now() - WEEK_MS;
  const hasRecentTransfer = events.some((event) => {
    if (event.ts < cutoff || !isProductionAttemptEvent(event)) return false;
    return Boolean(event.payload.transferKind);
  });
  if (hasRecentTransfer) return null;
  return { prompt: activity.prompt };
}

function WeeklyTransferCard({
  suggestion,
  onStart,
}: {
  suggestion: WeeklyTransferSuggestion;
  onStart: () => void;
}) {
  const { t } = useT();
  return (
    <Card className="border-accent/25 bg-accent/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.7px] text-accent">
            {t("Weekly transfer")}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {t("Use one saved phrase somewhere new")}
          </p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
            {t(suggestion.prompt)}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onStart}>
          {t("Practice transfer")}
        </Button>
      </div>
    </Card>
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
  onSpeak,
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
  onSpeak: () => void;
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
        ? t("{count} phrases for today — 1 came from your mistake yesterday", {
            count: due,
          })
        : t(
            "{count} phrases for today — {mistakes} came from your mistakes yesterday",
            {
              count: due,
              mistakes: mistakeCards,
            },
          )
      : mistakeCards === 1
        ? t("{count} phrases for today — 1 came from your mistake", {
            count: due,
          })
        : t("{count} phrases for today — {mistakes} came from your mistakes", {
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
        onSpeak,
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
      detail: t(
        "Turn recent corrections into phrases you can review tomorrow.",
      ),
      cta: t("Save to study"),
      onClick: onCorrect,
    };
  }

  // Has phrases, nothing due — practice one phrase without adding load.
  if (counts.cards > 0) {
    return {
      eyebrow: t("You're caught up"),
      title: t("{lesson} ({level})", {
        lesson: t(nextLesson.title),
        level: nextLesson.level,
      }),
      detail: t(
        "Tomorrow you review these phrases. Today you can practice one more.",
      ),
      cta: t("Practice a phrase"),
      onClick: () => onLesson(nextLesson.id),
    };
  }

  // Brand-new user, no saved phrases yet → start with the bundled first lesson.
  return {
    eyebrow: t("Start here"),
    title: t("Start with one short lesson"),
    detail: t(
      "Listen, save one useful phrase, and use it in a sentence of your own.",
    ),
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
    onSpeak: () => void;
    nextLesson: Lesson;
  },
): () => void {
  if (route === "review") return handlers.onStudy;
  if (route === "correct") return handlers.onCorrect;
  if (route === "discover") return handlers.onDiscover;
  if (route === "speak") return handlers.onSpeak;
  if (route === "lesson") return handlers.onFirstLesson;
  return () => handlers.onLesson(handlers.nextLesson.id);
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card variant="flat" className="min-w-20 px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.5px] text-ink-muted">
        {label}
      </p>
    </Card>
  );
}
