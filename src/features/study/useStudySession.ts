"use client";

/**
 * State + orchestration for the study tab: queue lifecycle (standard / light /
 * reinforcement), grading, saturation cooldown, and directed generation. The
 * component that renders it stays presentational; data fetching lives in
 * studySession.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getDueCards,
  getCardsWithSrs,
  getCounts,
  getReviews,
  getReinforcementCards,
  getReinforcementSources,
  recordReview,
  saveCards,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import {
  computePerformance,
  computeReturnAfterMiss,
  computeWeeklyActivity,
  detectWeaknesses,
  type Weakness,
} from "@/lib/srs/analytics";
import { deriveSkillStates } from "@/lib/srs/skillState";
import type { BandGateResult } from "@/lib/srs/band";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { markFirstRunReviewCompleted } from "@/features/activation/firstRun";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import type { DueCard, ScaffoldTelemetry } from "./components/StudyCard";
import type { SessionResult } from "./components/SessionSummary";
import {
  endOfTomorrowLocal,
  localDayIndex,
  mistakeCardStats,
} from "@/features/home/returnMoment";
import { buildLightQueue, isSaturated, type SessionMode } from "./sessionMode";
import { deriveCyclePlan } from "./cyclePlanner";
import { getWeeklyGoal } from "./weeklyGoal";
import { loadOrderedDueQueue, loadStudySnapshot } from "./studySession";

export function useStudySession() {
  const { t } = useT();
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
  /** P2 #5 — current cards with SRS + speech logs, the inputs the cycle planner reads. */
  const [cardsWithSrs, setCardsWithSrs] = useState<{ card: Card; srs: SrsRecord }[]>([]);
  const [pronAttempts, setPronAttempts] = useState<PronunciationAttempt[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  /** P1 #4 — "standard" due queue vs. a short "light" round of already-stable cards. */
  const [mode, setMode] = useState<SessionMode>("standard");
  /** Recent grade+latency, newest last — feeds the mid-session saturation check. */
  const [recentAnswers, setRecentAnswers] = useState<{ grade: Grade; latencyMs?: number }[]>([]);
  /** True once saturation fired this session and the cooldown prompt hasn't been dismissed. */
  const [cooldown, setCooldown] = useState(false);
  /** Epoch ms a card was flipped (answer shown) — the start of the flip→grade latency. */
  const flipAtRef = useRef<number | null>(null);
  /** P3 #7 — latest offline band-gate result; drives whether the queue is band-ordered. */
  const [bandGate, setBandGate] = useState<BandGateResult | null>(null);
  /** D5 — when set, the queue is a focused reinforcement drill, not the due queue. */
  const [reinforcing, setReinforcing] = useState<{
    label: string;
    kind: Weakness["kind"];
  } | null>(null);
  /** D5 (a) — key (`kind:label`) of the weakness currently generating variants, if any. */
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  /** End-of-session "Amanhã" preview — the calm reason to return tomorrow. */
  const [tomorrow, setTomorrow] = useState<{
    due: number;
    mistakeCards: number;
    fromToday: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    const snapshot = await loadStudySnapshot();
    setQueue(snapshot.queue);
    setBandGate(snapshot.gate);
    setReviews(snapshot.reviews);
    setErrorEvents(snapshot.errorEvents);
    setConversations(snapshot.conversations);
    setCounts(snapshot.counts);
    setCards(snapshot.cards);
    setCardsWithSrs(snapshot.cardsWithSrs);
    setPronAttempts(snapshot.pronAttempts);
    setFlipped(false);
  }, []);

  const reloadStandardQueue = useCallback(async (): Promise<DueCard[]> => {
    const { queue, gate } = await loadOrderedDueQueue();
    setBandGate(gate);
    return queue;
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

  // The study tab stays mounted in the background while cards are saved from
  // lessons, Discover, or Correct. Pick those up when they happen — but only
  // while idle, so a running queue or an end-of-session summary is never
  // reshuffled underneath the learner.
  const idle = queue.length === 0 && sessionResults.length === 0 && !reinforcing && !loading;
  const idleRef = useRef(idle);
  useEffect(() => {
    idleRef.current = idle;
  }, [idle]);
  useEffect(() => {
    const handle = () => {
      if (idleRef.current && isStoreAvailable()) void refresh().catch(() => undefined);
    };
    window.addEventListener("phraseloop:activity", handle);
    window.addEventListener("phraseloop:lesson-saved", handle);
    return () => {
      window.removeEventListener("phraseloop:activity", handle);
      window.removeEventListener("phraseloop:lesson-saved", handle);
    };
  }, [refresh]);

  // When a session lands on the summary, look ahead to the local end of tomorrow
  // and count what's waiting — including whether any of it came from today's own
  // mistakes. This line is the loop-closer the D+1 return moment picks back up.
  const sessionEnded = !loading && queue.length === 0 && sessionResults.length > 0;
  useEffect(() => {
    if (!sessionEnded) return;
    let cancelled = false;
    void (async () => {
      const dueByTomorrow = await getDueCards(endOfTomorrowLocal());
      if (cancelled) return;
      const stats = mistakeCardStats(
        dueByTomorrow.map((item) => item.card),
        errorEvents,
        localDayIndex(Date.now()),
      );
      setTomorrow({
        due: dueByTomorrow.length,
        mistakeCards: stats.mistakeCards,
        fromToday: stats.fromMatchDay,
      });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionEnded, errorEvents]);

  const current = queue[0];

  /** Start of the flip→grade latency window; shows the answer. */
  const flip = useCallback(() => {
    flipAtRef.current = Date.now();
    setFlipped(true);
  }, []);

  const grade = useCallback(
    async (g: Grade, scaffold: ScaffoldTelemetry) => {
      if (!current) return;
      const latencyMs = flipAtRef.current != null ? Date.now() - flipAtRef.current : undefined;
      flipAtRef.current = null;
      const next = await recordReview(current.card, current.srs, g, {
        latencyMs,
        hintUsed: scaffold.hintUsed,
        scaffoldLevel: scaffold.scaffoldLevel,
      });
      const activation = markFirstRunReviewCompleted();
      void emitActivity("cards_reviewed", {
        count: 1,
        cardIds: [current.card.id],
        activation,
      });
      setSessionResults((prev) => [...prev, { cardId: current.card.id, grade: g, srs: next }]);
      // P1 #4 — track the running window and raise the cooldown prompt on a genuine bad
      // streak. Only in a standard session; a light round is already the gentle path.
      const answers = [...recentAnswers, { grade: g, latencyMs }];
      setRecentAnswers(answers);
      if (mode === "standard" && !cooldown && isSaturated(answers)) setCooldown(true);
      const rest = queue.slice(1);
      const [allReviews, c] = await Promise.all([getReviews(), getCounts()]);
      setReviews(allReviews);
      setCounts(c);
      if (rest.length > 0) {
        setQueue(rest);
      } else if (reinforcing) {
        // Reinforcement drill finished — drop back to the normal due queue.
        setReinforcing(null);
        setQueue(await reloadStandardQueue());
      } else if (mode === "light") {
        // Light round done — end cleanly into the summary rather than reopening the queue.
        setMode("standard");
        setQueue([]);
      } else {
        // Re-query: FSRS learning steps may have re-queued a card minutes out.
        setQueue(await reloadStandardQueue());
      }
      setFlipped(false);
    },
    [current, queue, reinforcing, mode, cooldown, recentAnswers, reloadStandardQueue],
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
    setQueue(await reloadStandardQueue());
    setFlipped(false);
  }, [reloadStandardQueue]);

  /** P1 #4 — swap the queue for a short, low-load round of already-stable cards. */
  const startLight = useCallback(async () => {
    const [due, all] = await Promise.all([getDueCards(), getCardsWithSrs()]);
    const light = buildLightQueue(due, all);
    if (light.length === 0) return;
    setReinforcing(null);
    setCooldown(false);
    setMode("light");
    setQueue(light);
    setFlipped(false);
  }, []);

  /** P2 #5 — return to the standard due queue and scroll the card into view. */
  const startReview = useCallback(async () => {
    setReinforcing(null);
    setCooldown(false);
    setMode("standard");
    setQueue(await reloadStandardQueue());
    setFlipped(false);
    document.querySelector<HTMLElement>("section.app-scroll-region:not([hidden])")?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [reloadStandardQueue]);

  /** P1 #4 — cooldown choice: bank the session and stop into the honest summary. */
  const stopSession = useCallback(() => {
    setCooldown(false);
    setMode("standard");
    setQueue([]);
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
        setGenError(
          t("{provider} is unavailable. Open Settings to connect it.", {
            provider: defaultProvider?.label ?? t("The selected AI"),
          }),
        );
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
          setGenError(t('No saved material left for "{label}" to generate from.', { label: w.label }));
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
          setGenError(data?.error ?? t("Couldn't create new practice phrases."));
          return;
        }
        await saveCards(data.cards);
        await refresh();
        // Drill everything for this concept now — the new variants included.
        await startReinforcement(w);
      } catch {
        setGenError(t("Couldn't reach IA. Try again."));
      } finally {
        setGeneratingKey(null);
      }
    },
    [defaultProvider, refresh, settings.defaultProvider, settings.ollama.model, startReinforcement, t],
  );

  const stats = computePerformance(reviews);
  const retention = computeReturnAfterMiss(reviews);
  const activity = computeWeeklyActivity(conversations, reviews);
  const weaknesses = detectWeaknesses(reviews, errorEvents);
  const weeklyGoal = getWeeklyGoal();
  const showAdaptiveDepth = reviews.length >= 5;

  // P2 #5 — derive the three-path cycle plan from per-skill state + due + light availability.
  const skillStates = deriveSkillStates(reviews, cardsWithSrs, pronAttempts, errorEvents);
  const lightAvailable = buildLightQueue(queue, cardsWithSrs).length > 0;
  const cyclePlan = deriveCyclePlan(skillStates, { due: counts.due, lightAvailable });

  return {
    available,
    loading,
    queue,
    current,
    flipped,
    reviews,
    counts,
    cards,
    sessionResults,
    // Gate on sessionEnded so a fresh queue never renders last session's preview.
    tomorrow: sessionEnded ? tomorrow : null,
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
  };
}
