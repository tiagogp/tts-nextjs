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
}: {
  results: SessionResult[];
  streakDays: number;
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
          {t("{count} days in a row. Tomorrow you review the next phrases.", { count: streakDays })}
        </p>
      )}
    </Card>
  );
}
