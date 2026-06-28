"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { evaluateCorrectionText } from "@/features/correct/api";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile } from "@/features/settings/learningProfile";
import { cn } from "@/lib/cn";
import { emitActivity } from "@/lib/store/activityLog";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getConversations,
  getErrorEvents,
  getProgressAssessments,
  getPronunciationAttempts,
  getReviews,
  saveErrorEvents,
  saveProgressAssessment,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
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
  assessments: StoredProgressAssessment[];
}

const EMPTY_DATA: ProgressData = {
  reviews: [],
  errorEvents: [],
  conversations: [],
  pronunciationAttempts: [],
  assessments: [],
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
    const [reviews, errorEvents, conversations, pronunciationAttempts, assessments] = await Promise.all([
      getReviews(),
      getErrorEvents(),
      getConversations(),
      getPronunciationAttempts(),
      getProgressAssessments(),
    ]);
    setData({ reviews, errorEvents, conversations, pronunciationAttempts, assessments });
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
          Loading progress...
        </div>
      </Card>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <ProgressSnapshotCard snapshot={snapshot} latest={data.assessments[0]} compact={compact} />
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

function ProgressSnapshotCard({
  snapshot,
  latest,
  compact,
}: {
  snapshot: ProgressSnapshot;
  latest?: StoredProgressAssessment;
  compact: boolean;
}) {
  const achieved = snapshot.milestones.filter((milestone) => milestone.achieved).length;
  const nextMilestone = snapshot.milestones.find((milestone) => !milestone.achieved);
  const topSkills = [...snapshot.skills].sort((a, b) => b.score - a.score).slice(0, compact ? 3 : 6);

  return (
    <Card className={cn("p-5", compact && "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">Progress signal</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-semibold tracking-[-0.01em] text-ink">{snapshot.estimatedBand}</p>
            <span className="text-xs uppercase tracking-[0.7px] text-ink-muted">{snapshot.confidence} confidence</span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{snapshot.nextFocus}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-ink">{snapshot.averageScore}</p>
          <p className="text-xs uppercase tracking-[0.7px] text-ink-muted">overall</p>
        </div>
      </div>

      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {topSkills.map((skill) => (
          <SkillBar key={skill.key} label={skill.label} score={skill.score} detail={skill.detail} />
        ))}
      </div>

      {!compact && (
        <div className="mt-4 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                {achieved}/{snapshot.milestones.length} milestones
              </p>
              <p className="text-xs text-ink-muted">
                {nextMilestone ? `${nextMilestone.label}: ${nextMilestone.detail}` : "All current milestones are complete."}
              </p>
            </div>
            {latest && (
              <p className="text-xs tabular-nums text-ink-muted">
                Last check-in {formatDate(latest.createdAt)}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
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
  const { provider, selectedModel, hasEvaluator, activeProvider } = useProviderSelection({ fallbackToEvaluator: true });
  const [writing, setWriting] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEvaluateWriting = hasEvaluator && writing.trim().length >= 40;
  const dueText = snapshot.checkpointDue
    ? "Checkpoint due now"
    : `Next checkpoint ${formatDate(snapshot.nextCheckpointAt)}`;

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
          ? `Checkpoint saved with ${events.length} correction${events.length === 1 ? "" : "s"}.`
          : "Checkpoint saved from your current learning signals.",
      );
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save this checkpoint.");
    } finally {
      setSaving(false);
    }
  }, [canEvaluateWriting, data, onSaved, provider, selectedModel, writing]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{dueText}</p>
          <p className="mt-1 text-sm font-semibold text-ink">Progress check-in</p>
          <p className="mt-1 text-xs text-ink-muted">
            Write a short answer, or save a checkpoint from your current local signals.
          </p>
        </div>
        <span className={cn("rounded border px-2 py-1 text-xs", snapshot.checkpointDue ? "border-accent text-accent" : "border-line text-ink-muted")}>
          14-day rhythm
        </span>
      </div>

      <textarea
        value={writing}
        onChange={(event) => setWriting(event.target.value)}
        rows={4}
        className="mt-4 w-full resize-y rounded-md border border-line bg-input px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent"
        placeholder="Answer in English: what got easier since your last session, and what still feels hard?"
      />

      {!hasEvaluator && (
        <p className="mt-2 text-xs text-ink-muted">
          Connect an AI provider to evaluate the writing sample. Saving still records the measurable progress signals.
        </p>
      )}
      {hasEvaluator && writing.trim().length > 0 && writing.trim().length < 40 && (
        <p className="mt-2 text-xs text-ink-muted">
          Add a little more text for AI evaluation, or save the checkpoint without writing analysis.
        </p>
      )}
      {hasEvaluator && (
        <p className="mt-2 text-xs text-ink-muted">
          Provider: {activeProvider?.label ?? provider}
        </p>
      )}

      {error && <Notice tone="error" className="mt-3 text-xs">{error}</Notice>}
      {message && <Notice tone="success" className="mt-3 text-xs">{message}</Notice>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="primary" size="sm" onClick={() => void saveCheckIn()} disabled={saving}>
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {canEvaluateWriting ? "Evaluate and save" : "Save checkpoint"}
        </Button>
      </div>
    </Card>
  );
}

function SkillBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink">{label}</p>
        <span className="text-xs tabular-nums text-ink-muted">{score}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full", score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-accent" : "bg-amber-500")} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-muted">{detail}</p>
    </div>
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
}
