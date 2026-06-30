"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { isStoreAvailable } from "@/lib/store/db";
import { getCards, getCounts, getErrorEvents, getReviews, type ReviewRecord } from "@/lib/store/repository";
import { computePerformance } from "@/lib/srs/analytics";
import { useT } from "@/i18n/I18nProvider";
import { completedLessonIdsFromCardIds, firstLesson, nextLessonFor, type Lesson } from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";

interface HojeHomeProps {
  onStudy: () => void;
  onCorrect: () => void;
  onTryDemo: () => void;
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
 * brand-new user with no saved phrases → bundled demo. One CTA, never a dashboard.
 */
export function HojeHome({ onStudy, onCorrect, onTryDemo, onLesson }: HojeHomeProps) {
  const { t } = useT();
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0, errors: 0 });
  const [streakDays, setStreakDays] = useState(0);
  const [nextLesson, setNextLesson] = useState<Lesson>(() => nextLessonFor(getLearningProfile(), []) ?? firstLesson());
  const [countsLoaded, setCountsLoaded] = useState(() => !isStoreAvailable());

  useEffect(() => {
    if (!isStoreAvailable()) return;
    let cancelled = false;
    const load = async () => {
      const [nextCounts, reviews, cards, errors] = await Promise.all([getCounts(), getReviews(), getCards(), getErrorEvents()]);
      if (cancelled) return;
      setCounts({ ...nextCounts, errors: errors.length });
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

  const hasProgress = counts.cards > 0 || counts.reviews > 0;
  const loading = !countsLoaded;

  const action = resolveNextAction({
    t,
    counts,
    onStudy,
    onTryDemo,
    onCorrect,
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
  onTryDemo,
  onCorrect,
  onLesson,
  nextLesson,
}: {
  t: (en: string, vars?: Record<string, string | number>) => string;
  counts: { cards: number; reviews: number; due: number; errors: number };
  onStudy: () => void;
  onTryDemo: () => void;
  onCorrect: () => void;
  onLesson: (lessonId?: string) => void;
  nextLesson: Lesson;
}): NextAction {
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

  // Brand-new user, no saved phrases yet → start with the bundled demo.
  return {
    eyebrow: t("Start here"),
    title: t("Learn your first phrases in 2 minutes"),
    detail: t("Hear real phrases, save the useful ones, then review them — no setup needed."),
    cta: t("Start a demo lesson"),
    onClick: onTryDemo,
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
