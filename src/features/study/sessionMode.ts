/**
 * Phase 1 #4 — Light / Cooldown session mode, kept pure so the policy (what a low-load
 * queue looks like, when a session is genuinely saturated) is testable away from React.
 *
 * The retreat half of the cycle needs a graceful *down*: a short, easy round for tired or
 * short-on-time states, and an honest "you're fading — bank these and stop" signal after a
 * real bad streak. Neither is a hard wall; both are opt-in micro-recovery.
 */

import { Rating, recallProbability, type Grade } from "@/lib/srs/fsrs";
import type { DueCard } from "./components/StudyCard";

export type SessionMode = "standard" | "light";

/** A light round stays easy: only cards FSRS already considers comfortably recallable. */
const LIGHT_RECALL = 0.85;
/** Target size of a light round — small enough to finish tired, big enough to count. */
const LIGHT_MAX = 5;

/** How many of the most-recent answers the saturation check looks back over. */
const SATURATION_WINDOW = 3;
/** Two-plus failures in the window is a clear "above reach right now" signal. */
const SATURATION_FAILURES = 2;
/** A monotonic latency climb only counts if the latest answer is genuinely slow (ms). */
const RISING_LATENCY_FLOOR = 12_000;

function hasAudio(c: DueCard): boolean {
  return !!c.card.audioClipPath?.startsWith("/");
}

/**
 * A low-load queue of ≤5 already-stable cards, audio-first. Cards that are *both* due and
 * stable lead the round (so the easy reps still advance scheduling), then non-due stable
 * cards top it up. Returns fewer than the target when the deck doesn't have enough stable
 * material yet — better a short honest round than padding it with fragile cards.
 */
export function buildLightQueue(
  due: DueCard[],
  all: DueCard[],
  at: Date = new Date(),
): DueCard[] {
  const isStableEnough = (c: DueCard) => recallProbability(c.srs, at) >= LIGHT_RECALL;
  const rank = (cards: DueCard[]) =>
    [...cards].sort((a, b) => {
      const audio = (hasAudio(b) ? 1 : 0) - (hasAudio(a) ? 1 : 0);
      if (audio !== 0) return audio;
      return recallProbability(b.srs, at) - recallProbability(a.srs, at);
    });

  const dueIds = new Set(due.map((d) => d.card.id));
  const stableDue = rank(due.filter(isStableEnough));
  const stableOther = rank(all.filter((c) => !dueIds.has(c.card.id) && isStableEnough(c)));
  return [...stableDue, ...stableOther].slice(0, LIGHT_MAX);
}

/**
 * Saturation = the running session is turning sour: ≥2 of the last 3 answers were `Again`,
 * or latency is climbing monotonically into genuinely-slow territory. Fires only on a real
 * bad streak so the cooldown prompt never feels random.
 */
export function isSaturated(recent: { grade: Grade; latencyMs?: number }[]): boolean {
  const window = recent.slice(-SATURATION_WINDOW);
  if (window.length < SATURATION_WINDOW) return false;

  const failures = window.filter((r) => r.grade === Rating.Again).length;
  if (failures >= SATURATION_FAILURES) return true;

  const latencies = window.map((r) => r.latencyMs);
  if (latencies.every((ms): ms is number => ms != null)) {
    const rising = latencies.every((ms, i) => i === 0 || ms > latencies[i - 1]!);
    if (rising && latencies[latencies.length - 1]! >= RISING_LATENCY_FLOOR) return true;
  }
  return false;
}
