"use client";

/**
 * D2–D4 surface: study due cards (FSRS), track performance, and show recurring
 * weaknesses — all read from the local-first store, nothing leaves the device.
 */

import { useCallback, useEffect, useState } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getDueCards,
  getReviews,
  getErrorEvents,
  recordReview,
  getCounts,
  getReinforcementCards,
  getReinforcementSources,
  saveCards,
  type ReviewRecord,
} from "@/lib/store/repository";
import type { ErrorEvent } from "@/lib/cards/schema";
import {
  GRADES,
  GRADE_LABELS,
  previewInterval,
  type Grade,
  type SrsRecord,
} from "@/lib/srs/fsrs";
import { Rating } from "@/lib/srs/fsrs";
import {
  computePerformance,
  detectWeaknesses,
  type Weakness,
  type WeaknessTrend,
} from "@/lib/srs/analytics";
import type { Card } from "@/lib/cards/schema";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import Disclosure from "@/components/ui/Disclosure";

interface DueCard {
  card: Card;
  srs: SrsRecord;
}

const GRADE_COLOR: Record<Grade, string> = {
  [Rating.Again]: "#c41c1c",
  [Rating.Hard]: "#b8860b",
  [Rating.Good]: "#2e7d32",
  [Rating.Easy]: "#1565c0",
};

export default function StudyTab() {
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
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0 });
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
    const [due, allReviews, events, c] = await Promise.all([
      getDueCards(),
      getReviews(),
      getErrorEvents(),
      getCounts(),
    ]);
    setQueue(due);
    setReviews(allReviews);
    setErrorEvents(events);
    setCounts(c);
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
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>;
  }

  if (!available) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Local storage isn’t available in this browser, so studying is disabled.
      </p>
    );
  }

  const stats = computePerformance(reviews);
  const weaknesses = detectWeaknesses(reviews, errorEvents);

  return (
    <div className="space-y-5 correct-tab-enter">
      {/* D5 — reinforcement drill banner */}
      {reinforcing && (
        <div
          className="rounded-lg px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ backgroundColor: "rgba(196, 28, 28, 0.08)", border: "1px solid #c41c1c" }}
        >
          <p className="text-xs" style={{ color: "var(--text-primary)" }}>
            Reinforcing{" "}
            <span className="font-medium">{reinforcing.label}</span>
            {" "}· {queue.length} remaining
          </p>
          <button
            onClick={() => void exitReinforcement()}
            className="text-xs font-medium shrink-0"
            style={{ color: "#c41c1c" }}
          >
            Exit
          </button>
        </div>
      )}

      {/* Study card */}
      <div
        className="app-panel p-6 sm:p-8"
      >
        {counts.cards === 0 ? (
          <div className="text-center py-8 space-y-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No cards yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Generate some cards in the Discover tab — they’ll show up here for review.
            </p>
          </div>
        ) : !current ? (
          <div className="text-center py-8 space-y-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              All caught up 🎉
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {reviewedThisSession > 0
                ? `${reviewedThisSession} reviewed this session. `
                : ""}
              Nothing due right now — come back later.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}
              >
                {current.card.concept || "Card"}
              </span>
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                {queue.length} due
              </span>
            </div>

            <div className="min-h-24 flex flex-col items-center justify-center text-center gap-3">
              <p className="text-lg leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {current.card.front}
              </p>
              {flipped && (
                <>
                  <div className="w-full" style={{ borderTop: "1px solid var(--border)" }} />
                  <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {current.card.back}
                  </p>
                  {current.card.errorType && (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {current.card.errorType}
                    </span>
                  )}
                </>
              )}
            </div>

            {!flipped ? (
              <button
                onClick={() => setFlipped(true)}
                className="primary-button w-full py-2.5 px-4 text-sm"
              >
                Show answer
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => void grade(g)}
                    className="py-2 px-2 text-xs font-medium transition-all flex flex-col items-center gap-0.5"
                    style={{
                      border: `1px solid ${GRADE_COLOR[g]}`,
                      color: GRADE_COLOR[g],
                      backgroundColor: "transparent",
                      borderRadius: "4px",
                    }}
                  >
                    <span>{GRADE_LABELS[g]}</span>
                    <span className="tabular-nums opacity-70">
                      {previewInterval(current.srs, g)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* D3 — performance */}
      <div
        className="app-panel p-5"
      >
        <p
          className="app-section-title mb-4"
        >
          Performance
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Cards" value={String(counts.cards)} />
          <Stat label="Reviews" value={String(stats.totalReviews)} />
          <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
          <Stat label="Streak" value={`${stats.streakDays}d`} />
        </div>

        {stats.totalReviews > 0 && (
          <Disclosure
            title="Review activity"
            description={`Last 14 days · ${stats.reviewsToday} today`}
            className="mt-5"
            nested
          >
            <div className="flex items-end gap-1 h-16">
              {stats.daily.map((d) => {
                const max = Math.max(1, ...stats.daily.map((x) => x.count));
                const h = d.count === 0 ? 2 : Math.round((d.count / max) * 56) + 4;
                return (
                  <div
                    key={d.day}
                    className="flex-1 rounded-sm"
                    title={`${d.day}: ${d.count}`}
                    style={{
                      height: `${h}px`,
                      backgroundColor: d.count === 0 ? "var(--border)" : "#ff5600",
                    }}
                  />
                );
              })}
            </div>
          </Disclosure>
        )}
      </div>

      {/* D4 — weakness detection */}
      {weaknesses.length > 0 && (
        <div
          className="app-panel p-5"
        >
          <p
            className="app-section-title mb-1"
          >
            Weak spots
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Concepts and error types you keep struggling with — worst first. ↓/↑ shows
            whether that error is slowing down or piling up in your writing.
          </p>
          {genError && (
            <p className="text-xs mb-3" style={{ color: "#c41c1c" }}>
              {genError}
            </p>
          )}
          <ul className="space-y-2">
            {weaknesses.slice(0, 8).map((w) => (
              <li key={`${w.kind}:${w.label}`} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 py-1">
                <div className="flex-1 basis-40 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                    {w.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {w.kind === "errorType" ? "error type" : "concept"} · {w.reviews} reviews
                  </p>
                </div>
                <div className="hidden sm:block w-24 shrink-0">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(w.struggleRate * 100)}%`, backgroundColor: "#c41c1c" }}
                    />
                  </div>
                </div>
                <span className="text-xs tabular-nums w-9 text-right" style={{ color: "var(--text-secondary)" }}>
                  {Math.round(w.struggleRate * 100)}%
                </span>
                <TrendBadge trend={w.trend} delta={w.trendDelta} />
                <button
                  onClick={() => void startReinforcement(w)}
                  className="text-xs font-medium shrink-0 px-2 py-1 transition-all"
                  style={{ border: "1px solid #c41c1c", color: "#c41c1c", borderRadius: "4px" }}
                >
                  Practice
                </button>
                <button
                  onClick={() => void generateReinforcement(w)}
                  disabled={generatingKey !== null}
                  className="weakness-secondary text-xs font-medium shrink-0 px-2 py-1 transition-all disabled:opacity-50"
                  style={{ color: "var(--text-muted)", borderRadius: "4px" }}
                  title="Generate new cards for this concept from existing sources"
                >
                  {generatingKey === `${w.kind}:${w.label}` ? "Generating…" : "New cards"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * D4 (b) — shows where a weak spot is heading: ↓ green = improving, ↑ red = worsening.
 * Stable spots show nothing, so attention stays on what's actually moving.
 */
function TrendBadge({ trend, delta }: { trend: WeaknessTrend; delta: number }) {
  if (trend === "stable") {
    return <span className="w-10 shrink-0" aria-hidden />;
  }
  const improving = trend === "improving";
  const color = improving ? "#1c8c3c" : "#c41c1c";
  const points = `${improving ? "−" : "+"}${Math.abs(Math.round(delta * 100))}`;
  return (
    <span
      className="text-xs tabular-nums w-10 shrink-0 text-right font-medium"
      style={{ color }}
      title={
        improving
          ? "Fewer errors of this type in your writing over time"
          : "More errors of this type in your writing over time"
      }
    >
      {improving ? "↓" : "↑"} {points}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: "var(--text-muted)", letterSpacing: "0.8px" }}>
        {label}
      </p>
    </div>
  );
}
