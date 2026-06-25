"use client";

/**
 * D2–D4 surface: study due cards (FSRS), track performance, and show recurring
 * weaknesses — all read from the local-first store, nothing leaves the device.
 */

import { useCallback, useEffect, useState } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import {
  getDueCards,
  getReviews,
  getErrorEvents,
  getConversations,
  recordReview,
  getCounts,
  getCards,
  getReinforcementCards,
  getReinforcementSources,
  saveCards,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { Grade } from "@/lib/srs/fsrs";
import {
  computePerformance,
  computeWeeklyActivity,
  detectWeaknesses,
  type Weakness,
} from "@/lib/srs/analytics";
import type { Card } from "@/lib/cards/schema";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { getWeeklyGoal } from "@/features/study/weeklyGoal";
import { emitActivity } from "@/lib/store/activityLog";
import { StudyCard, type DueCard } from "./StudyCard";
import { PerformanceStats } from "./PerformanceStats";
import { ExposureMeter } from "./ExposureMeter";
import { WeaknessList } from "./WeaknessList";
import { SavedCardsBrowser } from "./SavedCardsBrowser";

export default function StudyTab({
  onDiscover,
  onConversation,
}: {
  onDiscover?: () => void;
  onConversation?: () => void;
}) {
  const { settings } = useAiSettings();
  const defaultProvider = settings.providers.find(
    (provider) => provider.kind === settings.defaultProvider,
  );
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [errorEvents, setErrorEvents] = useState<ErrorEvent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0 });
  const [cards, setCards] = useState<Card[]>([]);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  /** D5 — when set, the queue is a focused reinforcement drill, not the due queue. */
  const [reinforcing, setReinforcing] = useState<{
    label: string;
    kind: Weakness["kind"];
  } | null>(null);
  /** D5 (a) — key (`kind:label`) of the weakness currently generating variants, if any. */
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [due, allReviews, events, convos, c, allCards] = await Promise.all([
      getDueCards(),
      getReviews(),
      getErrorEvents(),
      getConversations(),
      getCounts(),
      getCards(),
    ]);
    setQueue(due);
    setReviews(allReviews);
    setErrorEvents(events);
    setConversations(convos);
    setCounts(c);
    setCards(allCards.sort((a, b) => b.createdAt - a.createdAt));
    setFlipped(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isStoreAvailable()) {
        if (!cancelled) {
          setAvailable(false);
          setLoading(false);
        }
        return;
      }
      await refresh();
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const current = queue[0];

  const grade = useCallback(
    async (g: Grade) => {
      if (!current) return;
      await recordReview(current.card, current.srs, g);
      void emitActivity("cards_reviewed", { count: 1, cardIds: [current.card.id] });
      setReviewedThisSession((n) => n + 1);
      const rest = queue.slice(1);
      const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);
      setReviews(allReviews);
      setCounts(c);
      if (rest.length > 0) {
        setQueue(rest);
      } else if (reinforcing) {
        // Reinforcement drill finished — drop back to the normal due queue.
        setReinforcing(null);
        setQueue(await getDueCards());
      } else {
        // Re-query: FSRS learning steps may have re-queued a card minutes out.
        setQueue(await getDueCards());
      }
      setFlipped(false);
    },
    [current, queue, reinforcing],
  );

  /** D5 — start a focused drill on a weak concept/error-type, on top of the due queue. */
  const startReinforcement = useCallback(async (w: Weakness) => {
    const cards = await getReinforcementCards({ label: w.label, kind: w.kind });
    if (cards.length === 0) return;
    setReinforcing({ label: w.label, kind: w.kind });
    setQueue(cards);
    setFlipped(false);
    document.querySelector<HTMLElement>("section.app-scroll-region:not([hidden])")?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const exitReinforcement = useCallback(async () => {
    setReinforcing(null);
    setQueue(await getDueCards());
    setFlipped(false);
  }, []);

  /**
   * D5 (a) — directed generation: make fresh variant cards for a weak concept from the
   * sources that already produced its (struggled-with) cards, then drill them.
   */
  const generateReinforcement = useCallback(
    async (w: Weakness) => {
      const key = `${w.kind}:${w.label}`;
      if (!defaultProvider?.available) {
        setGenError(`${defaultProvider?.label ?? "The default AI provider"} is unavailable. Open Settings to connect it.`);
        return;
      }
      setGenError(null);
      setGeneratingKey(key);
      try {
        const { candidates, errors } = await getReinforcementSources({
          label: w.label,
          kind: w.kind,
        });
        if (candidates.length === 0 && errors.length === 0) {
          setGenError(`No source material left for "${w.label}" to generate from.`);
          return;
        }
        const res = await fetch("/api/cards/reinforce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidates,
            errors,
            provider: settings.defaultProvider,
            ollamaModel: settings.ollama.model || undefined,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { cards?: Card[]; error?: string }
          | null;
        if (!res.ok || !data?.cards?.length) {
          setGenError(data?.error ?? "Couldn't generate reinforcement cards.");
          return;
        }
        await saveCards(data.cards);
        await refresh();
        // Drill everything for this concept now — the new variants included.
        await startReinforcement(w);
      } catch {
        setGenError("Couldn't reach the generator. Try again.");
      } finally {
        setGeneratingKey(null);
      }
    },
    [defaultProvider, refresh, settings.defaultProvider, settings.ollama.model, startReinforcement],
  );

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  if (!available) {
    return (
      <p className="text-sm text-ink-muted">
        Local storage isn’t available in this browser, so studying is disabled.
      </p>
    );
  }

  const stats = computePerformance(reviews);
  const activity = computeWeeklyActivity(conversations, reviews);
  const weaknesses = detectWeaknesses(reviews, errorEvents);
  const weeklyGoal = getWeeklyGoal();

  return (
    <div className="space-y-5">
      {/* D5 — reinforcement drill banner */}
      {reinforcing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-danger bg-danger/10 px-4 py-2.5">
          <p className="text-xs text-ink">
            Reinforcing <span className="font-medium">{reinforcing.label}</span> · {queue.length} remaining
          </p>
          <button
            type="button"
            onClick={() => void exitReinforcement()}
            className="shrink-0 cursor-pointer text-xs font-medium text-danger transition-opacity hover:opacity-80"
          >
            Exit
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

      <StudyCard
        totalCards={counts.cards}
        current={current}
        queueLength={queue.length}
        flipped={flipped}
        reviewedThisSession={reviewedThisSession}
        onFlip={() => setFlipped(true)}
        onGrade={(g) => void grade(g)}
        onDiscover={onDiscover ?? (() => {})}
      />

      <PerformanceStats cardsCount={counts.cards} stats={stats} />

      <ExposureMeter activity={activity} />

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

function MethodCoach({
  due,
  cards,
  weeklyGoal,
  conversations,
  topWeakness,
  onDiscover,
  onConversation,
}: {
  due: number;
  cards: number;
  weeklyGoal: number;
  conversations: number;
  topWeakness: Weakness | null;
  onDiscover?: () => void;
  onConversation?: () => void;
}) {
  const remainingConversations = Math.max(0, weeklyGoal - conversations);
  const next = cards === 0
    ? {
        title: "Capture your first source",
        text: "Start with one video, article, or PDF. Keep a small set so review stays light.",
        action: "Open Discover",
        onClick: onDiscover,
      }
    : due > 0
      ? {
          title: "Review before adding more",
          text: `${due} card${due === 1 ? "" : "s"} due now. Clear the queue, then produce language.`,
          action: null,
          onClick: undefined,
        }
      : topWeakness
        ? {
            title: `Reinforce ${topWeakness.label}`,
            text: "Use the weak spots list below to drill existing cards or create new variants.",
            action: null,
            onClick: undefined,
          }
        : remainingConversations > 0
          ? {
              title: "Produce language this week",
              text: `${remainingConversations} conversation${
                remainingConversations === 1 ? "" : "s"
              } left for your weekly rhythm.`,
              action: "Start conversation",
              onClick: onConversation,
            }
          : {
              title: "Add the next small batch",
              text: "You are caught up. Add fresh input only when you want more material.",
              action: "Open Discover",
              onClick: onDiscover,
            };

  return (
    <UiCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">Today&apos;s method</p>
          <p className="mt-1 text-sm font-semibold text-ink">{next.title}</p>
          <p className="mt-1 text-xs text-ink-muted">{next.text}</p>
        </div>
        {next.action && next.onClick && (
          <Button variant="secondary" size="sm" onClick={next.onClick}>
            {next.action}
          </Button>
        )}
      </div>
    </UiCard>
  );
}
