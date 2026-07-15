"use client";

/**
 * Readiness coach — the "tutor" panel for level advancement. Shows how far the
 * learner is from the next CEFR level (evidence bar + per-criterion checklist),
 * the gaps standing in the way (each with the learner's own example attached —
 * never a bare label), and unlocks the level test once every criterion is met.
 * Drills reuse the same reinforcement handlers as the weakness list.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getCards,
  getCardsWithSrs,
  getConversations,
  getErrorEvents,
  getLevelTestAttempts,
  getListeningAttempts,
  getProgressAssessments,
  getProductionAttempts,
  getPronunciationAttempts,
  getReviews,
  getRetryOutcomes,
} from "@/lib/store/repository";
import { computeProgressSnapshot } from "@/features/progress/model";
import type { Weakness } from "@/lib/srs/analytics";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { computeLevelReadiness, type LevelReadiness, type ReadinessCriterionId } from "../model";
import { retakeAvailableAt } from "../testModel";
import { LevelTestFlow } from "./LevelTestFlow";

interface ReadinessCoachProps {
  weaknesses: Weakness[];
  generatingKey: string | null;
  onPractice: (weakness: Weakness) => void;
  onGenerate: (weakness: Weakness) => void;
}

const CRITERION_LABEL: Record<ReadinessCriterionId, string> = {
  volume: "Recent practice",
  recall: "Recall under control",
  stability: "Stable phrases",
  production: "Production quality",
  overall: "Overall signal",
  checkin: "Recent check-in",
};

export function ReadinessCoach({ weaknesses, generatingKey, onPractice, onGenerate }: ReadinessCoachProps) {
  const { t } = useT();
  const [readiness, setReadiness] = useState<LevelReadiness | null>(null);
  /** Days left on the retake cooldown at last refresh; 0 = test available. */
  const [cooldownDays, setCooldownDays] = useState(0);
  const [testOpen, setTestOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isStoreAvailable()) return;
    const profile = getLearningProfile();
    const [reviews, errorEvents, conversations, pronunciationAttempts, listeningAttempts, productionAttempts, retryOutcomes, assessments, cards, cardsWithSrs, attempts] =
      await Promise.all([
        getReviews(),
        getErrorEvents(),
        getConversations(),
        getPronunciationAttempts(),
        getListeningAttempts(),
        getProductionAttempts(),
        getRetryOutcomes(),
        getProgressAssessments(),
        getCards(),
        getCardsWithSrs(),
        getLevelTestAttempts(),
      ]);
    const snapshot = computeProgressSnapshot({
      profileLevel: profile.level,
      reviews,
      errorEvents,
      conversations,
      pronunciationAttempts,
      listeningAttempts,
      productionAttempts,
      retryOutcomes,
      assessments,
    });
    const lastCheckinAt = assessments.find((assessment) => assessment.kind === "checkin")?.createdAt;
    setReadiness(
      computeLevelReadiness({
        profileLevel: profile.level,
        snapshot,
        weaknesses,
        errorEvents,
        cards,
        cardsWithSrs,
        reviews,
        lastCheckinAt,
      }),
    );
    const now = Date.now();
    const retakeAt = retakeAvailableAt(attempts, profile.level, now);
    setCooldownDays(retakeAt > now ? Math.max(1, Math.ceil((retakeAt - now) / 86_400_000)) : 0);
  }, [weaknesses]);

  useEffect(() => {
    const handle = () => void refresh().catch(() => undefined);
    handle();
    window.addEventListener("phraseloop:activity", handle);
    window.addEventListener("phraseloop:profile-updated", handle);
    window.addEventListener("phraseloop:progress-updated", handle);
    return () => {
      window.removeEventListener("phraseloop:activity", handle);
      window.removeEventListener("phraseloop:profile-updated", handle);
      window.removeEventListener("phraseloop:progress-updated", handle);
    };
  }, [refresh]);

  if (!readiness) return null;

  // Top of the ladder — a quiet terminal state, not a dead button.
  if (!readiness.targetLevel) {
    return (
      <UiCard className="p-5">
        <p className="text-sm font-semibold tracking-[-0.01em] text-ink">
          {t("Level coach")} · {readiness.currentLevel}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {t("You're at the top of the level ladder. Keep refining naturalness and register.")}
        </p>
      </UiCard>
    );
  }

  const cooldownActive = cooldownDays > 0;
  const missing = readiness.criteria.filter((criterion) => !criterion.achieved);

  if (testOpen) {
    return (
      <LevelTestFlow
        currentLevel={readiness.currentLevel}
        targetLevel={readiness.targetLevel}
        focusGaps={readiness.gaps.map((gap) => gap.weakness.label).slice(0, 3)}
        onClose={() => {
          setTestOpen(false);
          void refresh().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <UiCard className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold tracking-[-0.01em] text-ink">
          {t("Level coach")} · {readiness.currentLevel} → {readiness.targetLevel}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t("Evidence from your real practice decides when the level test unlocks.")}
        </p>
      </div>

      {/* Evidence bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-soft">{t("Evidence toward {level}", { level: readiness.targetLevel })}</span>
          <span className="font-medium text-ink">{readiness.score}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${readiness.score}%` }}
          />
        </div>
      </div>

      {/* Criteria checklist with real numbers next to each line */}
      <ul className="space-y-1.5">
        {readiness.criteria.map((criterion) => (
          <li key={criterion.id} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={
                criterion.achieved
                  ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] text-accent"
                  : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-line text-[10px] text-ink-muted"
              }
            >
              {criterion.achieved ? "✓" : "·"}
            </span>
            <span className={criterion.achieved ? "text-ink-soft" : "text-ink"}>
              {t(CRITERION_LABEL[criterion.id])}
            </span>
            <span className="ml-auto tabular-nums text-ink-muted">
              {criterion.id === "checkin"
                ? criterion.achieved
                  ? t("done")
                  : t("pending")
                : `${criterion.current}/${criterion.target}`}
            </span>
          </li>
        ))}
      </ul>

      {/* Gaps — always with the learner's own evidence attached */}
      {readiness.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">{t("What's in the way")}</p>
          {readiness.gaps.map((gap) => {
            const key = `${gap.weakness.kind}:${gap.weakness.label}`;
            return (
              <div key={key} className="rounded border border-line bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-ink">{gap.weakness.label}</p>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onPractice(gap.weakness)}>
                      {t("Drill")}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={generatingKey !== null}
                      onClick={() => onGenerate(gap.weakness)}
                    >
                      {generatingKey === key ? t("Creating…") : t("New phrases")}
                    </Button>
                  </div>
                </div>
                {gap.example.kind === "error" ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className="line-through">{gap.example.original}</span>{" "}
                    <span className="text-ink-soft">→ {gap.example.corrected}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-muted">
                    {gap.example.front} <span className="text-ink-soft">→ {gap.example.back}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* The gate: unlocked test, cooldown, or the top missing criterion as the reason */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          disabled={!readiness.eligible || cooldownActive}
          onClick={() => setTestOpen(true)}
        >
          {t("Take the level test")}
        </Button>
        {cooldownActive ? (
          <p className="text-xs text-ink-muted">
            {t("Available again in {count} day(s).", { count: cooldownDays })}
          </p>
        ) : (
          !readiness.eligible &&
          missing[0] && (
            <p className="text-xs text-ink-muted">
              {t("Next step: {criterion}.", { criterion: t(CRITERION_LABEL[missing[0].id]) })}
            </p>
          )
        )}
      </div>
    </UiCard>
  );
}
