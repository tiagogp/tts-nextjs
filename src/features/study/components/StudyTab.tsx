"use client";

/**
 * D2–D4 surface: study due cards (FSRS), track performance, and show recurring
 * weaknesses — all read from the local-first store, nothing leaves the device.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  getCardsWithSrs,
  getPronunciationAttempts,
  saveCards,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { ErrorEvent } from "@/lib/cards/schema";
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
import { cn } from "@/lib/cn";
import type { Card } from "@/lib/cards/schema";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { markFirstRunReviewCompleted } from "@/features/activation/firstRun";
import { getWeeklyGoal } from "@/features/study/weeklyGoal";
import { ProgressOverview } from "@/features/progress/components/ProgressOverview";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import { StudyCard, type DueCard, type ScaffoldTelemetry } from "./StudyCard";
import type { SessionResult } from "./SessionSummary";
import { buildLightQueue, isSaturated, type SessionMode } from "../sessionMode";
import { deriveCyclePlan, type CyclePath, type CyclePlan } from "../cyclePlanner";
import { orderDueQueue, fatigueByCard } from "../bandQueue";
import type { BandGateResult } from "@/lib/srs/band";
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

  const refresh = useCallback(async () => {
    const [due, allReviews, events, convos, c, allCards, withSrs, pron] = await Promise.all([
      getDueCards(),
      getReviews(),
      getErrorEvents(),
      getConversations(),
      getCounts(),
      getCards(),
      getCardsWithSrs(),
      getPronunciationAttempts(),
    ]);
    // P3 #7 — gate the band over the real log; only re-order the due queue if it says "adopt".
    const states = deriveSkillStates(allReviews, withSrs, pron, events);
    const { queue: ordered, gate } = orderDueQueue(due, allReviews, {
      fatigueOf: fatigueByCard(states, pron),
    });
    setQueue(ordered);
    setBandGate(gate);
    setReviews(allReviews);
    setErrorEvents(events);
    setConversations(convos);
    setCounts(c);
    setCards(allCards.sort((a, b) => b.createdAt - a.createdAt));
    setCardsWithSrs(withSrs);
    setPronAttempts(pron);
    setFlipped(false);
  }, []);

  /**
   * P3 #7 — rebuild the standard (band-gated) due queue after a grade or when returning from a
   * drill/light round. Refetches the inputs the gate + fatigue weighting need so the ordering
   * reflects the review just recorded. Light and reinforcement queues bypass this by design.
   */
  const reloadStandardQueue = useCallback(async (): Promise<DueCard[]> => {
    const [due, allReviews, withSrs, pron, events] = await Promise.all([
      getDueCards(),
      getReviews(),
      getCardsWithSrs(),
      getPronunciationAttempts(),
      getErrorEvents(),
    ]);
    const states = deriveSkillStates(allReviews, withSrs, pron, events);
    const { queue, gate } = orderDueQueue(due, allReviews, {
      fatigueOf: fatigueByCard(states, pron),
    });
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

  // This tab stays mounted in the background while cards are saved from
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

  const current = queue[0];

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

  /** P2 #5 — dispatch the chosen cycle path: challenge (produce), review, or light. */
  const startPath = useCallback(
    (path: CyclePath) => {
      if (path === "challenge") (onConversation ?? onDiscover)?.();
      else if (path === "light") void startLight();
      else void startReview();
    },
    [onConversation, onDiscover, startLight, startReview],
  );

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
        sessionResults={sessionResults}
        streakDays={stats.streakDays}
        reviews={reviews}
        onFlip={() => {
          flipAtRef.current = Date.now();
          setFlipped(true);
        }}
        onGrade={(g, scaffold) => void grade(g, scaffold)}
        onDiscover={onDiscover ?? (() => {})}
      />

      <PerformanceStats cardsCount={counts.cards} stats={stats} retention={retention} />

      {showAdaptiveDepth && counts.cards > 0 && bandGate && <BandGateNote gate={bandGate} />}

      {showAdaptiveDepth && <ProgressOverview showCheckIn />}

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
  const { t } = useT();
  const remainingConversations = onConversation ? Math.max(0, weeklyGoal - conversations) : 0;
  const next = cards === 0
    ? {
        title: t("Save your first phrases"),
        text: t("Start with the demo or one source. Keep a small set so review stays light."),
        action: t("Open Discover"),
        onClick: onDiscover,
      }
    : due > 0
      ? {
          title: t("Review before adding more"),
          text: t("{count} practice phrases due now. Review first, then add more.", { count: due }),
          action: null,
          onClick: undefined,
        }
      : topWeakness
        ? {
            title: t("Reinforce {label}", { label: topWeakness.label }),
            text: t("Use the weak spots list below to practice saved phrases or create new variants."),
            action: null,
            onClick: undefined,
          }
        : remainingConversations > 0
          ? {
              title: t("Produce language this week"),
              text: t("{count} conversations left for your weekly rhythm.", {
                count: remainingConversations,
              }),
              action: t("Start conversation"),
              onClick: onConversation,
            }
          : {
              title: t("Add the next small batch"),
              text: t("You are caught up. Add fresh input only when you want more material."),
              action: t("Open Discover"),
              onClick: onDiscover,
            };

  return (
    <UiCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today's method")}</p>
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

/**
 * P3 #7 — surface the offline difficulty-band gate honestly. The band ships gated: it only
 * re-orders the due queue once the gate, replayed over the real review log, says "adopt". This
 * shows the current verdict and its plain-language reason so the decision is inspectable rather
 * than hidden — exactly the "confirm offline before any UI" step the strategy demands.
 */
function BandGateNote({ gate }: { gate: BandGateResult }) {
  const { t } = useT();
  const status =
    gate.verdict === "adopt"
      ? { label: t("Active"), cls: "border-accent bg-accent/10 text-accent" }
      : gate.verdict === "skip"
        ? { label: t("Holding"), cls: "border-line bg-surface-2 text-ink-soft" }
        : { label: t("Gathering data"), cls: "border-line bg-surface-2 text-ink-muted" };
  return (
    <UiCard className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.7px] text-ink-soft">{t("Review order")}</p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            status.cls,
          )}
        >
          {status.label}
        </span>
      </div>
      <p className="text-xs text-ink-muted">{gate.note}</p>
      {gate.verdict === "adopt" && (
        <p className="text-[11px] text-ink-soft">
          {t("Due phrases are ordered toward the best recall zone first.")}
        </p>
      )}
    </UiCard>
  );
}

/**
 * P2 #5 — the cycle-expressing home: up to three honest paths (challenge / review / light),
 * with the recommended one pre-highlighted and a one-tap "just start" that runs it — so the
 * common case is a single tap, not a cold decision.
 */
function CyclePicker({ plan, onStart }: { plan: CyclePlan; onStart: (path: CyclePath) => void }) {
  const { t } = useT();
  const rec = plan.options.find((o) => o.path === plan.recommended)!;
  return (
    <UiCard className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Today's next step")}</p>
          <p className="mt-1 text-xs text-ink-muted">{t("Start with the recommended path.")}</p>
        </div>
        <Button size="sm" onClick={() => onStart(plan.recommended)}>
          {t("Start · {load}", { load: rec.load })}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {plan.options.map((option) => (
          <button
            key={option.path}
            type="button"
            disabled={!option.available}
            onClick={() => onStart(option.path)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left transition-colors",
              option.recommended
                ? "border-accent bg-accent/10"
                : "border-line hover:border-accent/40",
              !option.available && "cursor-not-allowed opacity-40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{option.title}</span>
              {option.recommended && (
                <span className="text-[10px] uppercase tracking-wide text-accent">{t("Recommended")}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{option.description}</p>
            <p className="mt-1.5 text-[11px] text-ink-soft">{option.load}</p>
          </button>
        ))}
      </div>
    </UiCard>
  );
}
