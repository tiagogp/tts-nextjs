"use client";

/**
 * D2–D4 surface: study due cards (FSRS), track performance, and show recurring
 * weaknesses — all read from the local-first store, nothing leaves the device.
 * State and data loading live in useStudySession / studySession; this file
 * only renders.
 *
 * The tab has exactly one job — the review queue. Progress is weaknesses-first
 * with detailed stats behind a disclosure, and the coach renders the same
 * `deriveMethodPlan` action as Hoje so the app never gives two recommendations.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { TransferPracticeCard } from "./TransferPracticeCard";
import { ReviewWorkspaceNav, type ReviewView } from "./ReviewWorkspaceNav";

export default function StudyTab({
  onDiscover,
  onConversation,
  onLesson,
  onCorrect,
}: {
  onDiscover?: () => void;
  onConversation?: () => void;
  onLesson?: () => void;
  onCorrect?: () => void;
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
    showAdaptiveDepth,
    cyclePlan,
    methodPlan,
    flip,
    grade,
    startReinforcement,
    exitReinforcement,
    startLight,
    startReview,
    stopSession,
    generateReinforcement,
  } = useStudySession();
  const [activeView, setActiveView] = useState<ReviewView>("review");
  const [showDetailedStats, setShowDetailedStats] = useState(false);

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
      <PageHeader
        eyebrow={t("Your review workspace")}
        title={t("Review")}
        description={t("Start with due phrases. Progress and your library are here when you need them.")}
        aside={(
          <div className="flex gap-4 rounded-lg border border-line bg-card px-4 py-2.5" aria-live="polite">
            <HeaderStat value={counts.due} label={t("Due now")} tone={counts.due > 0 ? "accent" : "default"} />
            <div className="w-px bg-line" aria-hidden />
            <HeaderStat value={counts.cards} label={t("Saved")} />
          </div>
        )}
      />

      <ReviewWorkspaceNav value={activeView} due={counts.due} onChange={setActiveView} />

      <section
        id="review-view-panel-review"
        role="tabpanel"
        aria-labelledby="review-view-tab-review"
        tabIndex={0}
        hidden={activeView !== "review"}
        className="space-y-5"
      >
        <SectionIntro
          eyebrow={t("Review queue")}
          title={counts.due > 0
            ? t("{count} phrases need your attention", { count: counts.due })
            : t("Your review queue is clear")}
          description={counts.due > 0
            ? t("Recall each phrase before revealing the answer. Support is available when you need it.")
            : t("You can stop here, choose a light session, or add a small batch of new phrases.")}
        />

        {reinforcing && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-danger bg-danger/10 px-4 py-2.5" role="status">
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

        {mode === "light" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5" role="status">
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

        {cooldown && (
          <UiCard className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-xs text-ink-soft">
              {sessionResults.length > 0
                ? t("Nice work — {count} phrases reviewed so far. This is a good place to stop, or take one light session.", { count: sessionResults.length })
                : t("Nice work. This is a good place to stop, or take one light session.")}
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

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.8fr)]">
          <StudyCard
            totalCards={counts.cards}
            current={current}
            queueLength={queue.length}
            flipped={flipped}
            grading={grading}
            sessionResults={sessionResults}
            tomorrow={tomorrow}
            reviews={reviews}
            onFlip={flip}
            onGrade={(g, scaffold) => void grade(g, scaffold)}
            onDiscover={onDiscover ?? (() => {})}
          />
          <aside aria-label={t("Review recommendation")}>
            <MethodCoach
              plan={methodPlan}
              onDiscover={onDiscover}
              onConversation={onConversation}
              onLesson={onLesson}
              onCorrect={onCorrect}
            />
          </aside>
        </div>

        {showAdaptiveDepth && counts.cards > 0 && mode === "standard" && !reinforcing && !cooldown && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.7px] text-ink-muted">
              {t("Other ways to practice")}
            </p>
            <CyclePicker plan={cyclePlan} onStart={startPath} />
            <TransferPracticeCard />
          </div>
        )}
      </section>

      <section
        id="review-view-panel-progress"
        role="tabpanel"
        aria-labelledby="review-view-tab-progress"
        tabIndex={0}
        hidden={activeView !== "progress"}
        className="space-y-5"
      >
        <SectionIntro
          eyebrow={t("Progress")}
          title={t("See what needs attention next")}
          description={t("Start with your weak spots. Detailed numbers are one tap away.")}
        />

        <WeaknessList
          weaknesses={weaknesses}
          genError={genError}
          generatingKey={generatingKey}
          onPractice={(w) => {
            setActiveView("review");
            void startReinforcement(w);
          }}
          onGenerate={(w) => {
            void generateReinforcement(w).then((started) => {
              if (started) setActiveView("review");
            });
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">
            {t("{cards} phrases saved · {due} due now", { cards: counts.cards, due: counts.due })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowDetailedStats((value) => !value)} aria-expanded={showDetailedStats}>
            {showDetailedStats ? t("Hide detailed stats") : t("Show detailed stats")}
          </Button>
        </div>

        {showDetailedStats && (
          <div className="space-y-5">
            <div className="grid items-start gap-5 md:grid-cols-2">
              <PerformanceStats cardsCount={counts.cards} stats={stats} retention={retention} />
              {showAdaptiveDepth && <ExposureMeter activity={activity} />}
            </div>

            {showAdaptiveDepth && <ProgressOverview showCheckIn />}

            {showAdaptiveDepth && (
              <ReadinessCoach
                weaknesses={weaknesses}
                generatingKey={generatingKey}
                onPractice={(w) => {
                  setActiveView("review");
                  void startReinforcement(w);
                }}
                onGenerate={(w) => {
                  void generateReinforcement(w).then((started) => {
                    if (started) setActiveView("review");
                  });
                }}
              />
            )}

            {showAdaptiveDepth && counts.cards > 0 && bandGate && <BandGateNote gate={bandGate} />}
          </div>
        )}
      </section>

      <section
        id="review-view-panel-library"
        role="tabpanel"
        aria-labelledby="review-view-tab-library"
        tabIndex={0}
        hidden={activeView !== "library"}
        className="space-y-5"
      >
        <SectionIntro
          eyebrow={t("Phrase library")}
          title={t("Find a saved practice phrase")}
          description={t("Search the phrases, corrections, and contexts you have collected without interrupting your review queue.")}
        />
        <SavedCardsBrowser cards={cards} />
      </section>
    </div>
  );
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="border-b border-line pb-4">
      <p className="text-xs font-medium uppercase tracking-[0.75px] text-accent">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-ink">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}

function HeaderStat({ value, label, tone = "default" }: { value: number; label: string; tone?: "default" | "accent" }) {
  return (
    <div className="min-w-14 text-center">
      <p className={tone === "accent" ? "text-lg font-semibold tabular-nums text-accent" : "text-lg font-semibold tabular-nums text-ink"}>
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-[0.65px] text-ink-muted">{label}</p>
    </div>
  );
}
