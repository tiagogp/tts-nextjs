"use client";

/**
 * D2–D4 surface: study due cards (FSRS), track performance, and show recurring
 * weaknesses — all read from the local-first store, nothing leaves the device.
 * State and data loading live in useStudySession / studySession; this file
 * only renders.
 */

import { useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { ProgressOverview } from "@/features/progress/components/ProgressOverview";
import { ReadinessCoach } from "@/features/levelup/components/ReadinessCoach";
import { useT } from "@/i18n/I18nProvider";
import { useStudySession } from "../useStudySession";
import type { CyclePath } from "../cyclePlanner";
import { StudyCard } from "./StudyCard";
import { PerformanceStats } from "./PerformanceStats";
import { ExposureMeter } from "./ExposureMeter";
import { WeaknessList } from "./WeaknessList";
import { SavedCardsBrowser } from "./SavedCardsBrowser";
import { MethodCoach } from "./MethodCoach";
import { BandGateNote } from "./BandGateNote";
import { CyclePicker } from "./CyclePicker";

export default function StudyTab({
  onDiscover,
  onConversation,
}: {
  onDiscover?: () => void;
  onConversation?: () => void;
}) {
  const { t } = useT();
  const {
    available,
    loading,
    queue,
    current,
    flipped,
    grading,
    reviews,
    counts,
    cards,
    sessionResults,
    tomorrow,
    mode,
    cooldown,
    bandGate,
    reinforcing,
    generatingKey,
    genError,
    stats,
    retention,
    activity,
    weaknesses,
    weeklyGoal,
    showAdaptiveDepth,
    cyclePlan,
    flip,
    grade,
    startReinforcement,
    exitReinforcement,
    startLight,
    startReview,
    stopSession,
    generateReinforcement,
  } = useStudySession();

  /** P2 #5 — dispatch the chosen cycle path: challenge (produce), review, or light. */
  const startPath = useCallback(
    (path: CyclePath) => {
      if (path === "challenge") (onConversation ?? onDiscover)?.();
      else if (path === "light") void startLight();
      else void startReview();
    },
    [onConversation, onDiscover, startLight, startReview],
  );

  if (loading) {
    return <p className="text-sm text-ink-muted">{t("Loading…")}</p>;
  }

  if (!available) {
    return (
      <p className="text-sm text-ink-muted">
        {t("Local storage isn't available in this browser, so studying is disabled.")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* D5 — reinforcement drill banner */}
      {reinforcing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-danger bg-danger/10 px-4 py-2.5">
          <p className="text-xs text-ink">
            {t("Reinforcing")} <span className="font-medium">{reinforcing.label}</span> ·{" "}
            {t("{count} remaining", { count: queue.length })}
          </p>
          <button
            type="button"
            onClick={() => void exitReinforcement()}
            className="shrink-0 cursor-pointer text-xs font-medium text-danger transition-opacity hover:opacity-80"
          >
            {t("Exit")}
          </button>
        </div>
      )}

      {/* P1 #4 — light-session banner: a short, low-load round of already-stable cards. */}
      {mode === "light" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
          <p className="text-xs text-ink">
            {t("Light session")} ·{" "}
            <span className="font-medium">{t("{count} easy phrases", { count: queue.length })}</span>
          </p>
          <button
            type="button"
            onClick={stopSession}
            className="shrink-0 cursor-pointer text-xs font-medium text-accent transition-opacity hover:opacity-80"
          >
            {t("Stop")}
          </button>
        </div>
      )}

      <MethodCoach
        due={counts.due}
        cards={counts.cards}
        weeklyGoal={weeklyGoal}
        conversations={activity.conversations}
        topWeakness={weaknesses[0] ?? null}
        onDiscover={onDiscover}
        onConversation={onConversation}
      />

      {/* P2 #5 — three honest paths (challenge / review / light) with a pre-selected default. */}
      {showAdaptiveDepth && counts.cards > 0 && mode === "standard" && !reinforcing && !cooldown && (
        <CyclePicker plan={cyclePlan} onStart={startPath} />
      )}

      {/* P1 #4 — cooldown prompt: non-blocking micro-recovery after a genuine bad streak. */}
      {cooldown && (
        <UiCard className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-xs text-ink-soft">
            {t("Nice work. This is a good place to stop, or take one light session.")}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={stopSession}>
              {t("Stop here")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void startLight()}>
              {t("Light session")}
            </Button>
          </div>
        </UiCard>
      )}

      <StudyCard
        totalCards={counts.cards}
        current={current}
        queueLength={queue.length}
        flipped={flipped}
        grading={grading}
        sessionResults={sessionResults}
        tomorrow={tomorrow}
        streakDays={stats.streakDays}
        reviews={reviews}
        onFlip={flip}
        onGrade={(g, scaffold) => void grade(g, scaffold)}
        onDiscover={onDiscover ?? (() => {})}
      />

      <PerformanceStats cardsCount={counts.cards} stats={stats} retention={retention} />

      {showAdaptiveDepth && counts.cards > 0 && bandGate && <BandGateNote gate={bandGate} />}

      {showAdaptiveDepth && <ProgressOverview showCheckIn />}

      {/* Level advancement: readiness coach + evidence-gated level test. */}
      {showAdaptiveDepth && (
        <ReadinessCoach
          weaknesses={weaknesses}
          generatingKey={generatingKey}
          onPractice={(w) => void startReinforcement(w)}
          onGenerate={(w) => void generateReinforcement(w)}
        />
      )}

      {showAdaptiveDepth && <ExposureMeter activity={activity} />}

      <WeaknessList
        weaknesses={weaknesses}
        genError={genError}
        generatingKey={generatingKey}
        onPractice={(w) => void startReinforcement(w)}
        onGenerate={(w) => void generateReinforcement(w)}
      />

      <SavedCardsBrowser cards={cards} />
    </div>
  );
}
