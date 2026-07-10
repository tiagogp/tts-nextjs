"use client";

/**
 * Phase 0 #2 — honest end-of-session screen. It deliberately splits two numbers that
 * gamified apps blur together:
 *   • "Now" — how you performed in this session (accuracy). Feels good, but recognition.
 *   • "Tomorrow" — how many of those cards FSRS predicts are actually *stable* in 24h.
 * The second number is the honest one, and it's usually smaller. Streak is framed as
 * consistency (rhythm), never loss-aversion.
 */

import { Card } from "@/components/ui/Card";
import { Rating, recallProbabilityAt, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import { useT } from "@/i18n/I18nProvider";

export interface SessionResult {
  cardId: string;
  grade: Grade;
  /** SRS state *after* grading — what we predict tomorrow's recall from. */
  srs: SrsRecord;
}

/** What's waiting by the local end of tomorrow — the calm reason to come back. */
export interface TomorrowPreview {
  due: number;
  /** How many of those cards were derived from the learner's own errors. */
  mistakeCards: number;
  /** True when at least one mistake card's source error was made today. */
  fromToday: boolean;
}

/**
 * One sentence closing the loop toward tomorrow. Honesty rules mirror the Hoje
 * return moment: the mistake claim only appears when a due card's provenance backs
 * it, and an empty tomorrow says so — no invented urgency.
 */
export function tomorrowLine(
  preview: TomorrowPreview,
  t: (en: string, vars?: Record<string, string | number>) => string,
): string {
  if (preview.due === 0) {
    return t("Nothing due tomorrow yet — the next review arrives right on time.");
  }
  if (preview.fromToday && preview.mistakeCards > 0) {
    if (preview.due === 1) {
      return t("Tomorrow: the phrase from today's mistake is waiting for you.");
    }
    return preview.mistakeCards === 1
      ? t("Tomorrow: {count} phrases are waiting — 1 came from today's mistake.", {
          count: preview.due,
        })
      : t("Tomorrow: {count} phrases are waiting — {mistakes} came from today's mistakes.", {
          count: preview.due,
          mistakes: preview.mistakeCards,
        });
  }
  return preview.due === 1
    ? t("Tomorrow: 1 phrase is waiting for you.")
    : t("Tomorrow: {count} phrases are waiting for you.", { count: preview.due });
}

/** A card counts as "stable for tomorrow" when predicted +24h recall clears this bar. */
const STABLE_THRESHOLD = 0.9;
const STABLE_HOURS = 24;

export function summarize(results: SessionResult[]): { reviewed: number; passed: number; stable: number } {
  const reviewed = results.length;
  const passed = results.filter((r) => r.grade >= Rating.Good).length;
  const stable = results.filter(
    (r) => recallProbabilityAt(r.srs, STABLE_HOURS) >= STABLE_THRESHOLD,
  ).length;
  return { reviewed, passed, stable };
}

export function SessionSummary({
  results,
  streakDays,
  tomorrow,
}: {
  results: SessionResult[];
  streakDays: number;
  tomorrow?: TomorrowPreview | null;
}) {
  const { t } = useT();
  const { reviewed, passed, stable } = summarize(results);
  const accuracy = reviewed ? Math.round((passed / reviewed) * 100) : 0;

  return (
    <Card className="space-y-5 p-6 text-center sm:p-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{t("Review complete")}</p>
        <p className="text-xs text-ink-muted">
          {t("{count} phrases reviewed today.", { count: reviewed })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">{accuracy}%</p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.8px] text-ink-muted">{t("Now")}</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t("went well this round")}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">{stable}</p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.8px] text-ink-muted">{t("Tomorrow")}</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t("ready for tomorrow")}</p>
        </div>
      </div>

      {streakDays > 1 && (
        <p className="text-xs text-ink-soft">
          {tomorrow
            ? t("{count} days in a row.", { count: streakDays })
            : t("{count} days in a row. Tomorrow you review the next phrases.", { count: streakDays })}
        </p>
      )}

      {tomorrow && <p className="text-xs text-ink-soft">{tomorrowLine(tomorrow, t)}</p>}
    </Card>
  );
}
