"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getConversations,
  getCounts,
  getErrorEvents,
  getReviews,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import { computePerformance, computeWeeklyActivity, detectWeaknesses, type Weakness } from "@/lib/srs/analytics";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile } from "@/features/settings/learningProfile";
import { DEFAULT_WEEKLY_GOAL, getWeeklyGoal } from "@/features/study/weeklyGoal";

export function HomeDashboard({
  onDiscover,
  onStudy,
  onSpeak,
  onCorrect,
}: {
  onDiscover: () => void;
  onStudy?: () => void;
  onSpeak?: () => void;
  onCorrect?: () => void;
}) {
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0 });
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [topWeakness, setTopWeakness] = useState<Weakness | null>(null);
  const [now, setNow] = useState(0);
  const [profile, setProfile] = useState(DEFAULT_LEARNING_PROFILE);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL);

  useEffect(() => {
    if (!isStoreAvailable()) return;
    let cancelled = false;
    const load = async () => {
      const [nextCounts, nextReviews, nextConversations, errorEvents] = await Promise.all([
        getCounts(),
        getReviews(),
        getConversations(),
        getErrorEvents(),
      ]);
      if (cancelled) return;
      setCounts(nextCounts);
      setReviews(nextReviews);
      setConversations(nextConversations);
      setTopWeakness(detectWeaknesses(nextReviews, errorEvents)[0] ?? null);
      setNow(Date.now());
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadProfile = () => {
      setProfile(getLearningProfile());
      setWeeklyGoal(getWeeklyGoal());
    };
    loadProfile();
    window.addEventListener("phraseloop:profile-updated", loadProfile);
    return () => window.removeEventListener("phraseloop:profile-updated", loadProfile);
  }, []);

  const referenceNow = now || reviews[0]?.reviewedAt || conversations[0]?.startedAt || 0;
  const stats = computePerformance(reviews, referenceNow);
  const activity = computeWeeklyActivity(conversations, reviews, referenceNow);
  const recentConversations = conversations.filter((item) => referenceNow - item.startedAt < 7 * 86_400_000).length;
  const hasDueCards = counts.due > 0;
  const hasCards = counts.cards > 0;
  const needsConversation = hasCards && activity.conversations < weeklyGoal;
  const recommendation = !hasCards
    ? {
        stage: "Capture",
        label: "Start with one real source",
        detail: profile.focus
          ? `Find a small batch for ${profile.level}, biased toward ${profile.focus}.`
          : `Find a small batch for your ${profile.level} level.`,
        action: "Start with Discover",
        onClick: onDiscover,
      }
    : hasDueCards
      ? {
        stage: "Review",
        label: `${counts.due} card${counts.due === 1 ? "" : "s"} due now`,
        detail: "Review first so new material does not pile up.",
        action: "Study due cards",
        onClick: onStudy ?? onDiscover,
      }
      : topWeakness
        ? {
          stage: "Reinforce",
          label: `Reinforce ${topWeakness.label}`,
          detail: "This pattern is showing up as a weak spot in your reviews.",
          action: "Practice weak spot",
          onClick: onStudy ?? onDiscover,
        }
        : needsConversation
          ? {
            stage: "Produce",
            label: "Practice output this week",
            detail: `${Math.max(0, weeklyGoal - activity.conversations)} conversation${
              weeklyGoal - activity.conversations === 1 ? "" : "s"
            } left to hit your weekly rhythm.`,
            action: "Practice speaking",
            onClick: onSpeak ?? onStudy ?? onDiscover,
          }
          : {
            stage: "Expand",
            label: "You are caught up",
            detail: "Add a small batch, or correct something you wrote to create a sharper drill.",
            action: "Correct writing",
            onClick: onCorrect ?? onDiscover,
          };

  return (
    <Card className="surface-grid-glow p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">Next learning step · {recommendation.stage}</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">{recommendation.label}</p>
          <p className="mt-1 text-sm text-ink-soft">{recommendation.detail}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <RoutineStep active={recommendation.stage === "Capture" || recommendation.stage === "Expand"} label="Discover" />
            <RoutineStep active={recommendation.stage === "Review"} label="Study" />
            <RoutineStep active={recommendation.stage === "Produce"} label="Speak / Correct" />
            <RoutineStep active={recommendation.stage === "Reinforce"} label="Reinforce" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:min-w-[24rem]">
          <Stat label="Due today" value={String(counts.due)} />
          <Stat label="Cards" value={String(counts.cards)} />
          <Stat label="Streak" value={`${stats.streakDays}d`} />
          <Stat label="7d sessions" value={String(recentConversations)} />
        </div>
        <Button variant="primary" size="sm" onClick={recommendation.onClick}>
          {recommendation.action}
        </Button>
      </div>
    </Card>
  );
}

function RoutineStep({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`rounded border px-2.5 py-2 text-xs ${active ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface text-ink-muted"}`}>
      {label}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.7px] text-ink-muted">{label}</p>
    </div>
  );
}
