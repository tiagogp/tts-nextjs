"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { isStoreAvailable } from "@/lib/store/db";
import { getCards, getCounts, getReviews, type ReviewRecord } from "@/lib/store/repository";
import { computePerformance } from "@/lib/srs/analytics";
import { useTodayPlan } from "@/features/plan/hooks/useTodayPlan";
import { TodayCard } from "@/features/plan/components/TodayCard";
import type { TaskItem, TaskType } from "@/features/plan/schema";
import { useT } from "@/i18n/I18nProvider";
import { completedLessonIdsFromCardIds, firstLesson, nextLessonFor, type Lesson } from "@/features/learn/lessonDeck";
import { ProgressOverview } from "@/features/progress/components/ProgressOverview";
import { getLearningProfile } from "@/features/settings/learningProfile";

interface HojeHomeProps {
  onDiscover: () => void;
  onStudy: () => void;
  onSpeak: () => void;
  onCorrect: () => void;
  onTryDemo: () => void;
  onLesson: (lessonId?: string) => void;
  onOpenSettings?: () => void;
}

interface NextAction {
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  onClick: () => void;
  secondary?: { label: string; onClick: () => void };
}

/**
 * "Hoje" — the app's front door. It answers a single question for the learner:
 * what is the one next thing to do right now? Resolution order: (a) today's first
 * incomplete plan task, (b) due cards → Study, (c) caught up → next lesson, (d) a
 * brand-new user with no cards → graded lesson for their profile. One CTA, never a dashboard. The full
 * plan checklist and a light progress strip sit below for returning learners.
 */
export function HojeHome({ onDiscover, onStudy, onSpeak, onCorrect, onTryDemo, onLesson, onOpenSettings }: HojeHomeProps) {
  const { t } = useT();
  const { loading: planLoading, plan, today } = useTodayPlan();
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0 });
  const [streakDays, setStreakDays] = useState(0);
  const [nextLesson, setNextLesson] = useState<Lesson>(() => nextLessonFor(getLearningProfile(), []) ?? firstLesson());
  const [countsLoaded, setCountsLoaded] = useState(() => !isStoreAvailable());

  useEffect(() => {
    if (!isStoreAvailable()) return;
    let cancelled = false;
    const load = async () => {
      const [nextCounts, reviews, cards] = await Promise.all([getCounts(), getReviews(), getCards()]);
      if (cancelled) return;
      setCounts(nextCounts);
      setStreakDays(computePerformance(reviews as ReviewRecord[], Date.now()).streakDays);
      setNextLesson(
        nextLessonFor(
          getLearningProfile(),
          completedLessonIdsFromCardIds(cards.map((card) => card.id)),
        ) ?? firstLesson(),
      );
      setCountsLoaded(true);
    };
    void load().catch(() => {
      if (!cancelled) setCountsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabFor: Record<TaskType, () => void> = {
    discover: onDiscover,
    study: onStudy,
    converse: onSpeak,
    correct: onCorrect,
    lesson: () => onLesson(nextLesson.id),
  };

  const hasProgress = counts.cards > 0 || counts.reviews > 0;
  const loading = planLoading || !countsLoaded;

  const action = resolveNextAction({
    t,
    plan: plan != null,
    today,
    counts,
    tabFor,
    onDiscover,
    onStudy,
    onTryDemo,
    onLesson,
    nextLesson,
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
              {action.secondary && (
                <Button variant="ghost" size="lg" className="min-h-10" onClick={action.secondary.onClick}>
                  {action.secondary.label}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {!loading && hasProgress && (
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${streakDays}`} label={t("day streak")} />
          <Stat value={`${counts.due}`} label={t("to review")} />
          <Stat value={`${counts.cards}`} label={t("cards saved")} />
        </div>
      )}

      {!loading && hasProgress && <ProgressOverview compact />}

      {!loading && (plan != null || hasProgress) && (
        <TodayCard
          onDiscover={onDiscover}
          onStudy={onStudy}
          onConverse={onSpeak}
          onCorrect={onCorrect}
          onLesson={onLesson}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
}

function resolveNextAction({
  t,
  plan,
  today,
  counts,
  tabFor,
  onDiscover,
  onStudy,
  onTryDemo,
  onLesson,
  nextLesson,
}: {
  t: (en: string, vars?: Record<string, string | number>) => string;
  plan: boolean;
  today: { tasks: TaskItem[] } | null;
  counts: { cards: number; reviews: number; due: number };
  tabFor: Record<TaskType, () => void>;
  onDiscover: () => void;
  onStudy: () => void;
  onTryDemo: () => void;
  onLesson: (lessonId?: string) => void;
  nextLesson: Lesson;
}): NextAction {
  // (a) Today's first incomplete plan task.
  if (plan && today) {
    const next = today.tasks.find((task) => task.completedAt == null);
    if (next) {
      return {
        eyebrow: t("Now do this"),
        title: t(next.instruction),
        detail: t("From your learning plan for today."),
        cta: t("Start now"),
        onClick: next.type === "lesson" ? () => onLesson(next.lessonId) : tabFor[next.type] ?? onStudy,
      };
    }
    // Plan exists and all of today's tasks are done.
    return {
      eyebrow: t("Today"),
      title: t("All done for today 🎉"),
      detail: t("Great work. Come back tomorrow, or get a head start now."),
      cta: counts.due > 0 ? t("Review anyway") : t("Find new phrases"),
      onClick: counts.due > 0 ? onStudy : onDiscover,
    };
  }

  // (b) Due cards waiting to be reviewed.
  if (counts.due > 0) {
    return {
      eyebrow: t("Now do this"),
      title: t("{count} cards to review", { count: counts.due }),
      detail: t("Review these before adding more, so nothing piles up."),
      cta: t("Study now"),
      onClick: onStudy,
    };
  }

  // Has cards, nothing due — caught up.
  if (counts.cards > 0) {
    return {
      eyebrow: t("You're caught up"),
      title: t("{lesson} ({level})", { lesson: t(nextLesson.title), level: nextLesson.level }),
      detail: t("Continue the guided path, or come back when cards are due."),
      cta: t("Start lesson"),
      onClick: () => onLesson(nextLesson.id),
      secondary: { label: t("Find new phrases"), onClick: onDiscover },
    };
  }

  // (c) Brand-new user, no cards yet → start with a graded offline lesson.
  const lesson = nextLesson;
  return {
    eyebrow: t("Start here"),
    title: t("{lesson} ({level})", { lesson: t(lesson.title), level: lesson.level }),
    detail: t("Start with graded phrases, native audio, and Study cards — no setup needed."),
    cta: t("Start lesson"),
    onClick: () => onLesson(lesson.id),
    secondary: { label: t("Try an example"), onClick: onTryDemo },
  };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card className="px-3 py-3 text-center">
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.5px] text-ink-muted">{label}</p>
    </Card>
  );
}
