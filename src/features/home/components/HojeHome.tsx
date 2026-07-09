"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { isStoreAvailable } from "@/lib/store/db";
import { getCards, getCounts, getErrorEvents, getReviews, type ReviewRecord } from "@/lib/store/repository";
import { getActivityLog } from "@/lib/store/activityLog";
import { computePerformance } from "@/lib/srs/analytics";
import { useT } from "@/i18n/I18nProvider";
import { completedLessonIdsFromCardIds, firstLesson, nextLessonFor, type Lesson } from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";

interface HojeHomeProps {
  onStudy: () => void;
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

interface ReturnMoment {
  due: number;
  mistakeCards: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localDayIndex(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return Math.round(d.getTime() / DAY_MS);
}

function returnMomentFor(input: {
  due: number;
  activity: { ts: number }[];
  errors: { createdAt: number }[];
  now?: number;
}): ReturnMoment | null {
  if (input.due <= 0 || input.activity.length === 0) return null;
  const now = input.now ?? Date.now();
  const today = localDayIndex(now);
  const firstDay = Math.min(...input.activity.map((event) => localDayIndex(event.ts)));
  if (today - firstDay !== 1) return null;
  const yesterday = today - 1;
  const mistakeCards = input.errors.filter((event) => localDayIndex(event.createdAt) === yesterday).length;
  return { due: input.due, mistakeCards };
}

/**
 * "Hoje" — the app's front door. It answers a single question for the learner:
 * what is the one next thing to do right now? Resolution order: (a) today's first
 * due phrases → Study, mistakes → Correct, practice → next phrase, or a
 * brand-new user with no saved phrases → bundled first lesson. One CTA, never a dashboard.
 */
export function HojeHome({ onStudy, onCorrect, onFirstLesson, onLesson }: HojeHomeProps) {
  const { t } = useT();
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0, errors: 0 });
  const [streakDays, setStreakDays] = useState(0);
  const [nextLesson, setNextLesson] = useState<Lesson>(() => nextLessonFor(getLearningProfile(), []) ?? firstLesson());
  const [returnMoment, setReturnMoment] = useState<ReturnMoment | null>(null);
  const [countsLoaded, setCountsLoaded] = useState(() => !isStoreAvailable());

  useEffect(() => {
    if (!isStoreAvailable()) return;
    let cancelled = false;
    const load = async () => {
      const [nextCounts, reviews, cards, errors, activity] = await Promise.all([
        getCounts(),
        getReviews(),
        getCards(),
        getErrorEvents(),
        getActivityLog(),
      ]);
      if (cancelled) return;
      setCounts({ ...nextCounts, errors: errors.length });
      setStreakDays(computePerformance(reviews as ReviewRecord[], Date.now()).streakDays);
      setReturnMoment(returnMomentFor({ due: nextCounts.due, activity, errors }));
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

  const hasProgress = counts.cards > 0 || counts.reviews > 0;
  const loading = !countsLoaded;

  const action = resolveNextAction({
    t,
    counts,
    onStudy,
    onFirstLesson,
    onCorrect,
    onLesson,
    nextLesson,
    returnMoment,
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
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${streakDays}`} label={t("day streak")} />
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
  onFirstLesson,
  onCorrect,
  onLesson,
  nextLesson,
  returnMoment,
}: {
  t: (en: string, vars?: Record<string, string | number>) => string;
  counts: { cards: number; reviews: number; due: number; errors: number };
  onStudy: () => void;
  onFirstLesson: () => void;
  onCorrect: () => void;
  onLesson: (lessonId?: string) => void;
  nextLesson: Lesson;
  returnMoment: ReturnMoment | null;
}): NextAction {
  if (returnMoment && counts.due > 0) {
    const title =
      returnMoment.mistakeCards === 1
        ? t("{count} cards for today — 1 came from your mistake yesterday", { count: counts.due })
        : t("{count} cards for today — {mistakes} came from your mistakes yesterday", {
            count: counts.due,
            mistakes: returnMoment.mistakeCards,
          });
    return {
      eyebrow: t("Today"),
      title,
      detail: t("Review while yesterday is still fresh."),
      cta: t("Start today's review"),
      onClick: onStudy,
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
    title: t("Turn real English into tomorrow's practice"),
    detail: t(
      "Paste a YouTube video. In 2 minutes, the best phrases become review cards with the original audio — and your own mistakes become tomorrow's practice.",
    ),
    cta: t("Start first lesson"),
    onClick: onFirstLesson,
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
