"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { evaluateCorrectionText } from "@/features/correct/api";
import {
  FEEDBACK_CATEGORY_LABEL,
  FEEDBACK_PRIORITY_LABEL,
  focusFeedback,
  prioritizeFeedback,
} from "@/features/correct/feedbackContract";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile } from "@/features/settings/learningProfile";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import { emitActivity } from "@/lib/store/activityLog";
import { isStoreAvailable } from "@/lib/store/db";
import { targetTextOfCard } from "@/lib/cards/orientation";
import {
  getCards,
  getConversations,
  getErrorEvents,
  getListeningAttempts,
  getMethodProgression,
  getProductionAttempts,
  getProgressAssessments,
  getPronunciationAttempts,
  getReviews,
  getRetryOutcomes,
  saveErrorEvents,
  saveProgressAssessment,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { Card as PracticeCard, ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import {
  LISTENING_STAGE_CRITERIA,
  LISTENING_STAGE_LABEL,
  PROGRESSION_REASON_MESSAGE,
  READING_WRITING_STAGE_LABEL,
  SPEAKING_STAGE_CRITERIA,
  SPEAKING_STAGE_LABEL,
  deriveProgressionState,
  type MethodProgressionState,
  type ProgressionLadder,
  type ProgressionReasonKind,
} from "@/features/method/progression";
import {
  computeProgressSnapshot,
  type ProgressSnapshot,
  type StoredProgressAssessment,
} from "../model";

interface ProgressData {
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  pronunciationAttempts: PronunciationAttempt[];
  listeningAttempts: ListeningAttempt[];
  productionAttempts: ProductionAttempt[];
  retryOutcomes: RetryOutcome[];
  progression?: MethodProgressionState;
  assessments: StoredProgressAssessment[];
  cards: PracticeCard[];
}

const EMPTY_DATA: ProgressData = {
  reviews: [],
  errorEvents: [],
  conversations: [],
  pronunciationAttempts: [],
  listeningAttempts: [],
  productionAttempts: [],
  retryOutcomes: [],
  progression: undefined,
  assessments: [],
  cards: [],
};

export function ProgressOverview({
  compact = false,
  showCheckIn = false,
}: {
  compact?: boolean;
  showCheckIn?: boolean;
}) {
  const [data, setData] = useState<ProgressData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!isStoreAvailable()) return;
    const [reviews, errorEvents, conversations, pronunciationAttempts, listeningAttempts, productionAttempts, retryOutcomes, assessments, previousProgression, cards] = await Promise.all([
      getReviews(),
      getErrorEvents(),
      getConversations(),
      getPronunciationAttempts(),
      getListeningAttempts(),
      getProductionAttempts(),
      getRetryOutcomes(),
      getProgressAssessments(),
      getMethodProgression(),
      getCards(),
    ]);
    const progression = deriveProgressionState({
      listeningAttempts,
      productionAttempts,
      retryOutcomes,
      previous: previousProgression,
    });
    setData({ reviews, errorEvents, conversations, pronunciationAttempts, listeningAttempts, productionAttempts, retryOutcomes, progression, assessments, cards });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storeAvailable = isStoreAvailable();
    const run = async () => {
      if (!storeAvailable) {
        if (!cancelled) {
          setAvailable(false);
          setLoading(false);
        }
        return;
      }
      await load();
      if (!cancelled) setLoading(false);
    };
    void run();
    if (!storeAvailable) {
      return () => {
        cancelled = true;
      };
    }
    const refresh = () => void load();
    window.addEventListener("phraseloop:activity", refresh);
    window.addEventListener("phraseloop:progress-updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("phraseloop:activity", refresh);
      window.removeEventListener("phraseloop:progress-updated", refresh);
    };
  }, [load]);

  const snapshot = useMemo(
    () =>
      computeProgressSnapshot({
        profileLevel: getLearningProfile().level ?? DEFAULT_LEARNING_PROFILE.level,
        ...data,
      }),
    [data],
  );

  if (!available) return null;
  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner className="h-4 w-4" />
          <ProgressLoadingLabel />
        </div>
      </Card>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <ProgressSnapshotCard
        snapshot={snapshot}
        progression={data.progression}
        latest={data.assessments[0]}
        cards={data.cards}
        compact={compact}
      />
      {!compact && data.errorEvents.length > 0 && <FeedbackPriorityCard events={data.errorEvents} />}
      {showCheckIn && (
        <ProgressCheckInCard
          data={data}
          snapshot={snapshot}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

function ProgressLoadingLabel() {
  const { t } = useT();
  return <>{t("Loading progress…")}</>;
}

function FeedbackPriorityCard({ events }: { events: ErrorEvent[] }) {
  const { t } = useT();
  const issues = focusFeedback(prioritizeFeedback(events), 3);
  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Shared feedback focus")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("The same priority contract drives lessons, corrections, conversations, and progress.")}</p>
      </div>
      <ul className="space-y-2">
        {issues.map((issue) => (
          <li key={issue.event.id} className="rounded border border-line bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-[0.4px] text-ink-muted">
              <span className="rounded border border-accent/30 px-1.5 py-0.5 text-accent">{t(FEEDBACK_PRIORITY_LABEL[issue.priority])}</span>
              <span>{t(FEEDBACK_CATEGORY_LABEL[issue.category])}</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted line-through">{issue.event.original}</p>
            <p className="text-sm font-medium text-ink">{issue.event.corrected}</p>
            <p className="mt-1 text-xs text-ink-muted">{t(issue.suggestedRetrySupport)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProgressSnapshotCard({
  snapshot,
  progression,
  latest,
  cards,
  compact,
}: {
  snapshot: ProgressSnapshot;
  progression?: MethodProgressionState;
  latest?: StoredProgressAssessment;
  cards: PracticeCard[];
  compact: boolean;
}) {
  const { t } = useT();
  const achieved = snapshot.milestones.filter((milestone) => milestone.achieved).length;
  const signals = snapshot.confidenceIndicators;
  const nextMilestone = snapshot.milestones.find((milestone) => !milestone.achieved);
  const topSkills = [...snapshot.skills].sort((a, b) => b.score - a.score).slice(0, compact ? 3 : 6);

  return (
    <Card className={cn("p-5", compact && "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Progress signal")}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-semibold tracking-[-0.01em] text-ink">{snapshot.estimatedBand}</p>
            <span className="text-xs uppercase tracking-[0.7px] text-ink-muted">
              {t("{level} confidence", { level: t(snapshot.confidence) })}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{t(snapshot.nextFocus)}</p>
          {progression && (progression.listeningSamples > 0 || progression.speakingSamples > 0) && (
            <div className="mt-1 space-y-1 text-xs text-ink-muted">
              <p>
                {t("Support level · listening {listening} · speaking {speaking} · reading/writing {readingWriting}", {
                  listening: t(LISTENING_STAGE_LABEL[progression.listeningStage]),
                  speaking: t(SPEAKING_STAGE_LABEL[progression.speakingStage]),
                  readingWriting: t(READING_WRITING_STAGE_LABEL[progression.readingWritingStage ?? "guided_reading"]),
                })}
              </p>
              <LadderReason
                ladder="listening"
                kind={progression.listeningReasonKind}
                evidence={LISTENING_STAGE_CRITERIA[progression.listeningStage].evidence}
                fallback={progression.listeningReason}
              />
              <LadderReason
                ladder="speaking"
                kind={progression.speakingReasonKind}
                evidence={SPEAKING_STAGE_CRITERIA[progression.speakingStage].evidence}
                fallback={progression.speakingReason}
              />
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-ink">{snapshot.averageScore}</p>
          <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">{t("learning evidence")}</p>
        </div>
      </div>

      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {topSkills.map((skill) => (
          <SkillBar
            key={skill.key}
            label={skill.label}
            score={skill.score}
            detail={skill.detail}
            detailVars={skill.detailVars}
          />
        ))}
      </div>

      {!compact && (
        <>
          <UnaidedProductionCard snapshot={snapshot} />
          <LearningEvidenceCard snapshot={snapshot} />
        </>
      )}

      {!compact && (
        <HeldPhrasesCard snapshot={snapshot} cards={cards} />
      )}

      {!compact && (
        <div className="mt-4 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("{achieved}/{total} milestones", { achieved, total: snapshot.milestones.length })}
              </p>
              <p className="text-xs text-ink-muted">
                {nextMilestone
                  ? `${t(nextMilestone.label)}: ${t(nextMilestone.detail)}`
                  : t("All current milestones are complete.")}
              </p>
            </div>
            {latest && (
              <p className="text-xs tabular-nums text-ink-muted">
                {t("Last check-in {date}", { date: formatDate(latest.createdAt) })}
              </p>
            )}
          </div>
        </div>
      )}
      {!compact && (
        <div className="mt-3 grid gap-2 text-xs text-ink-muted sm:grid-cols-3">
          <Indicator label={t("Spoken attempts")} value={signals.spokenAttempts} />
          <Indicator
            label={t("Recording length")}
            value={t("{seconds}s", { seconds: signals.averageRecordingSeconds })}
            note={
              signals.recordingGrowthPercent !== 0
                ? `(${signals.recordingGrowthPercent > 0 ? "+" : ""}${signals.recordingGrowthPercent}%)`
                : undefined
            }
          />
          <Indicator label={t("Retry resolution")} value={t("{percent}%", { percent: signals.resolvedRetryRate })} />
          <Indicator
            label={t("Reading/writing")}
            value={signals.readingWritingAttempts}
            note={t("attempts · {count} transfers", { count: signals.transferAttempts })}
          />
          <Indicator
            label={t("Listening")}
            value={t("{percent}%", { percent: signals.listeningAccuracy ?? 0 })}
            note={t("accuracy · {count} checks", { count: signals.listeningAttempts ?? 0 })}
          />
          <Indicator
            label={t("Fluency")}
            value={signals.averageWordsPerMinute || "—"}
            note={t("words/min · {count} samples", { count: signals.fluencySamples ?? 0 })}
          />
          <Indicator
            label={t("Support")}
            value={signals.scaffoldedAttempts ?? 0}
            note={t("scaffolded · {count} skipped", { count: signals.skippedAttempts ?? 0 })}
          />
          <Indicator
            label={t("Independence")}
            value={signals.independentAttempts ?? 0}
            note={t("attempts · {percent}% supported", { percent: signals.scaffoldRate ?? 0 })}
          />
          <Indicator
            label={t("Transfer")}
            value={t("{percent}%", { percent: signals.transferSuccessRate ?? 0 })}
            note={t("clear · {count} old errors avoided", { count: signals.avoidedErrorCount ?? 0 })}
          />
          <Indicator
            label={t("Preparation")}
            value={
              signals.averagePreparationSeconds
                ? t("{seconds}s", { seconds: signals.averagePreparationSeconds })
                : "—"
            }
            note={t("average · {count} samples", { count: signals.preparationSamples ?? 0 })}
          />
        </div>
      )}
    </Card>
  );
}

/** One measured signal in the confidence grid: translated label, raw number, optional tail. */
function Indicator({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <p className="rounded border border-line bg-surface px-3 py-2">
      {label}: <span className="font-medium text-ink">{value}</span>
      {note ? ` ${note}` : null}
    </p>
  );
}

function UnaidedProductionCard({ snapshot }: { snapshot: ProgressSnapshot }) {
  const { t } = useT();
  const stats = snapshot.unaidedProduction;
  // Provenance across the three proof windows, so the panel can name the judge instead of
  // presenting every percentage as though one instrument produced them all.
  const proofWindows = snapshot.proofRetention
    ? [snapshot.proofRetention[7], snapshot.proofRetention[30], snapshot.proofRetention[60]]
    : [];
  const proofJudged = proofWindows.reduce(
    (total, window) => ({
      local: total.local + window.judges.local,
      model: total.model + window.judges.model,
    }),
    { local: 0, model: 0 },
  );
  const proofMixed = new Set(proofWindows.flatMap((window) => window.judges.instruments)).size > 1;
  const measured = stats.rate !== null;
  const rate = measured ? Math.round((stats.rate ?? 0) * 100) : null;
  const status = !measured
    ? t("not enough data")
    : (stats.rate ?? 0) >= 0.8
      ? t("on track")
      : t("needs work");
  const statusClass = !measured
    ? "border-line text-ink-muted"
    : (stats.rate ?? 0) >= 0.8
      ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
      : "border-amber-500/40 text-amber-700 dark:text-amber-300";
  return (
    <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("D30 observed production")}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {measured
              ? t("{correct}/{attempts} answers produced correctly before reveal around day 30.", {
                  correct: stats.correct,
                  attempts: stats.attempts,
                  days: stats.minRestDays,
                })
              : t("Not enough evidence yet: PhraseLoop needs an unaided answer recorded around day 30.", {
                  days: stats.minRestDays,
                })}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-2xl font-semibold tabular-nums text-ink">{rate === null ? "—" : `${rate}%`}</p>
          <p className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] uppercase tracking-[0.5px]", statusClass)}>
            {status}
          </p>
          <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">
            {stats.cards === 1 ? t("1 card") : t("{count} cards", { count: stats.cards })}
          </p>
        </div>
      </div>
      {snapshot.proofRetention && (
        <div className="mt-3 border-t border-accent/15 pt-3">
          <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">{t("Retention checks")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([snapshot.proofRetention[7], snapshot.proofRetention[30], snapshot.proofRetention[60]]).map((window) => (
              <div key={window.targetDays} className="rounded border border-line bg-card px-2 py-2 text-center">
                <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">D{window.targetDays}</p>
                <p className="text-sm font-semibold tabular-nums text-ink">
                  {window.rate === null ? "—" : `${Math.round(window.rate * 100)}%`}
                </p>
                <p className="text-[10px] text-ink-muted">{t("{count} checked", { count: window.attempts })}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            {t("These come from a separate check that picks cards at random, easy or hard, and never changes your schedule.")}
          </p>
          {/* Provenance, not a footnote: a percentage is only comparable to another one
              produced by the same judge. When it is not, the panel says so instead of
              drawing a trend across two different instruments. */}
          {proofJudged.model > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              {t("{count} of these were scored by an AI model rather than the on-device check.", { count: proofJudged.model })}
            </p>
          )}
          {proofMixed && (
            <p className="mt-1 text-[11px] leading-relaxed text-warning">
              {t("These windows were not all scored the same way, so compare them with care.")}
            </p>
          )}
        </div>
      )}
      {snapshot.delayedProduction && (
        <div className="mt-3 border-t border-accent/15 pt-3">
          <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">{t("From your reviews")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([snapshot.delayedProduction.d7, snapshot.delayedProduction.d30, snapshot.delayedProduction.d60]).map((window) => (
              <div key={window.targetDays} className="rounded border border-line bg-card px-2 py-2 text-center">
                <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">D{window.targetDays}</p>
                <p className="text-sm font-semibold tabular-nums text-ink">
                  {window.rate === null ? "—" : `${Math.round(window.rate * 100)}%`}
                </p>
                <p className="text-[10px] text-ink-muted">{t("{count} observed", { count: window.attempts })}</p>
              </div>
            ))}
          </div>
          {/* Said plainly rather than buried: the scheduler picks these gaps, and it picks
              them for cards the learner is already getting right. */}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            {t("Read these as optimistic: your schedule only spaces cards this far apart once you are already getting them right.")}
          </p>
        </div>
      )}
    </div>
  );
}

/** The two breadth measures, both null-safe: an unmeasured number shows a dash, never a zero. */
function LearningEvidenceCard({ snapshot }: { snapshot: ProgressSnapshot }) {
  const { t } = useT();
  const vocabulary = snapshot.activeVocabulary;
  const latency = snapshot.productionLatency;
  const weakest = snapshot.patternWeaknesses?.find((weakness) => weakness.rate !== null);
  const cold = snapshot.coldListening;
  if (!vocabulary && !latency && !weakest && !cold) return null;

  return (
    <div className="mt-4 rounded-lg border border-line bg-card px-3 py-2.5">
      <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">{t("Evidence of learning")}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {vocabulary && (
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {vocabulary.samples === 0 ? "—" : vocabulary.size}
            </p>
            <p className="text-[11px] leading-snug text-ink-muted">
              {t("words you have produced unaided, twice, a week apart")}
            </p>
          </div>
        )}
        {latency && (
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {latency.medianMs === null ? "—" : `${(latency.medianMs / 1000).toFixed(1)}s`}
            </p>
            <p className="text-[11px] leading-snug text-ink-muted">
              {t("typical pause before answering language you already know")}
            </p>
          </div>
        )}
        {weakest && (
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {`${Math.round((weakest.rate ?? 0) * 100)}%`}
            </p>
            <p className="text-[11px] leading-snug text-ink-muted">
              {t("of your attempts at “{pattern}” still contain an error", { pattern: weakest.patternId })}
            </p>
          </div>
        )}
      </div>
      {cold && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[11px] leading-snug text-ink-muted">
            {cold.rate === null && cold.unmeasuredReason === "no_unfamiliar_audio"
              // The honest version of a number the app cannot produce: every built-in clip
              // is the same synthetic voice, so this says what is missing rather than
              // printing a 0% that reads as failure.
              ? t("Understanding an unfamiliar voice: not measured yet. Every built-in clip uses the same synthetic voice, so import real audio to test this.")
              : cold.rate === null
                ? t("Understanding an unfamiliar voice: not measured yet.")
                : t("You caught the main idea in {correct} of {attempts} clips from a voice you had never heard.", {
                    correct: cold.correct,
                    attempts: cold.attempts,
                  })}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * One ladder's coaching line, composed at render so it can be translated.
 *
 * `fallback` carries snapshots stored before the reason kind was recorded; those keep
 * showing the English sentence they were written with rather than disappearing.
 */
function LadderReason({
  ladder,
  kind,
  evidence,
  fallback,
}: {
  ladder: ProgressionLadder;
  kind?: ProgressionReasonKind;
  evidence: string;
  fallback?: string;
}) {
  const { t } = useT();
  if (!kind) return fallback ? <p>{fallback}</p> : null;
  return <p>{t(PROGRESSION_REASON_MESSAGE[ladder][kind], { evidence: t(evidence) })}</p>;
}

function HeldPhrasesCard({
  snapshot,
  cards,
}: {
  snapshot: ProgressSnapshot;
  cards: PracticeCard[];
}) {
  const { t } = useT();
  const byId = new Map(cards.map((card) => [card.id, card]));
  const heldIds = snapshot.unaidedProduction.heldCardIds ?? [];
  const held = heldIds
    .map((id) => byId.get(id))
    .filter((card): card is PracticeCard => card !== undefined)
    .slice(0, 6);

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("You can say this now")}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("Production phrases recalled without help after at least {days} days away.", {
              days: snapshot.unaidedProduction.minRestDays,
            })}
          </p>
        </div>
        <span className="text-xs tabular-nums text-ink-muted">
          {t("{count} held", { count: heldIds.length })}
        </span>
      </div>

      {held.length > 0 ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {held.map((card) => (
            <li key={card.id} className="rounded border border-line bg-card px-3 py-2 text-sm text-ink">
              {targetTextOfCard(card)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">
          {t("Your first phrase appears here after a later unaided review confirms it held.")}
        </p>
      )}
    </div>
  );
}

function ProgressCheckInCard({
  data,
  snapshot,
  onSaved,
}: {
  data: ProgressData;
  snapshot: ProgressSnapshot;
  onSaved: () => void;
}) {
  const { t } = useT();
  const { provider, selectedModel, hasEvaluator, activeProvider } = useProviderSelection({ fallbackToEvaluator: true });
  const [writing, setWriting] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEvaluateWriting = hasEvaluator && writing.trim().length >= 40;
  const dueText = snapshot.checkpointDue
    ? t("Checkpoint due now")
    : t("Next checkpoint {date}", { date: formatDate(snapshot.nextCheckpointAt) });

  const saveCheckIn = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const trimmed = writing.trim();
    try {
      let events: ErrorEvent[] = [];
      if (canEvaluateWriting) {
        events = await evaluateCorrectionText({
          provider,
          selectedModel,
          text: trimmed,
          context: "progress-checkin",
        });
        if (events.length > 0) await saveErrorEvents(events);
      }

      const nextData: ProgressData = {
        ...data,
        errorEvents: [...data.errorEvents, ...events],
      };
      const nextSnapshot = computeProgressSnapshot({
        profileLevel: getLearningProfile().level,
        ...nextData,
        now: Date.now(),
      });
      const id = crypto.randomUUID();
      const assessment: StoredProgressAssessment = {
        id,
        kind: "checkin",
        ...nextSnapshot,
        notes: canEvaluateWriting
          ? "Writing sample evaluated during progress check-in."
          : "Checkpoint saved from local learning signals.",
        writingSample: trimmed || undefined,
        errorsFound: events.length,
      };
      await saveProgressAssessment(assessment);
      await emitActivity("progress_checkin", {
        assessmentId: id,
        levelEstimate: assessment.estimatedBand,
        errorsFound: events.length,
      });
      window.dispatchEvent(new CustomEvent("phraseloop:progress-updated"));
      setWriting("");
      setMessage(
        canEvaluateWriting
          ? events.length === 1
            ? t("Checkpoint saved with 1 correction.")
            : t("Checkpoint saved with {count} corrections.", { count: events.length })
          : t("Checkpoint saved from your current learning signals."),
      );
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Couldn't save this checkpoint."));
    } finally {
      setSaving(false);
    }
  }, [canEvaluateWriting, data, onSaved, provider, selectedModel, t, writing]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{dueText}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t("Progress check-in")}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("Write a short answer, or save a checkpoint from your current local signals.")}
          </p>
        </div>
        <span className={cn("rounded border px-2 py-1 text-xs", snapshot.checkpointDue ? "border-accent text-accent" : "border-line text-ink-muted")}>
          {t("14-day rhythm")}
        </span>
      </div>

      <textarea
        value={writing}
        onChange={(event) => setWriting(event.target.value)}
        rows={4}
        className="mt-4 w-full resize-y rounded-md border border-line bg-input px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent"
        placeholder={t("Answer in English: what got easier since your last session, and what still feels hard?")}
      />

      {!hasEvaluator && (
        <p className="mt-2 text-xs text-ink-muted">
          {t("Connect an AI to evaluate the writing sample. Saving still records the measurable progress signals.")}
        </p>
      )}
      {hasEvaluator && writing.trim().length > 0 && writing.trim().length < 40 && (
        <p className="mt-2 text-xs text-ink-muted">
          {t("Add a little more text for AI evaluation, or save the checkpoint without writing analysis.")}
        </p>
      )}
      {hasEvaluator && (
        <p className="mt-2 text-xs text-ink-muted">
          {t("AI: {provider}", { provider: activeProvider?.label ?? provider })}
        </p>
      )}

      {error && <Notice tone="error" className="mt-3 text-xs">{error}</Notice>}
      {message && <Notice tone="success" className="mt-3 text-xs">{message}</Notice>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="primary" size="sm" onClick={() => void saveCheckIn()} disabled={saving}>
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {canEvaluateWriting ? t("Evaluate and save") : t("Save checkpoint")}
        </Button>
      </div>
    </Card>
  );
}

function SkillBar({
  label,
  score,
  detail,
  detailVars,
}: {
  label: string;
  score: number;
  detail: string;
  detailVars?: Record<string, string | number>;
}) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink">{t(label)}</p>
        <span className="text-xs tabular-nums text-ink-muted">{score}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full", score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-accent" : "bg-amber-500")} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-muted">{t(detail, detailVars)}</p>
    </div>
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
}
