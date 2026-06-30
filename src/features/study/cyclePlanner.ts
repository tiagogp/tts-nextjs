/**
 * Phase 2 #5 — cycle planner. Turns the derived per-skill state + due count into up to three
 * honest paths for *how to spend this session* — **challenge** (stretch / produce while sharp),
 * **review** (clear the cards FSRS says are due), **light** (a short low-load round) — with
 * exactly one pre-selected so the home surface never forces a cold decision.
 *
 * Pure, mirrors `skillState`/`sessionMode` so the policy is testable away from React. It reads
 * the signals those modules already derive (proficiency, fatigue, due); it owns no scheduling
 * and no storage. The recommended load mirrors `effort.ts`'s minute costs (~1 min per card).
 */

import { SKILLS, type SkillState } from "@/lib/srs/skillState";

export type CyclePath = "challenge" | "review" | "light";

export interface CycleOption {
  path: CyclePath;
  title: string;
  /** One honest line on when this path is the right call. */
  description: string;
  /** Approximate cost, e.g. "~8 min focused" / "~4 min light". */
  load: string;
  /** Pre-highlighted default — exactly one option in a plan carries this. */
  recommended: boolean;
  /** Whether the path can actually start right now (review needs due cards, light needs stable ones). */
  available: boolean;
}

export interface CyclePlan {
  recommended: CyclePath;
  /** Always ordered [challenge, review, light] so the UI can render them stably. */
  options: CycleOption[];
}

/** Minutes per due card — mirrors `effort.ts`'s `cards_reviewed` cost so estimates agree. */
const MIN_PER_CARD = 1;
/** A light round is ≤5 already-easy cards; budget it short and honest. */
const LIGHT_MINUTES = 4;
/** Producing language / stretching into fresh material — a focused block. */
const CHALLENGE_MINUTES = 10;
/** Aggregate fatigue at or above this means "retreat" — recommend the light path. */
const HIGH_FATIGUE = 0.5;

export interface CycleInputs {
  /** Total cards FSRS considers due right now. */
  due: number;
  /** Whether `buildLightQueue` would actually yield a non-empty round. */
  lightAvailable: boolean;
}

/**
 * Reviews-weighted average of a per-skill signal. A skill the learner hasn't touched (0
 * reviews) contributes nothing, so a single fresh skill can't be diluted to "calm" by three
 * dormant ones. Falls back to 0 when nothing has been reviewed in the window.
 */
function weighted(states: Record<string, SkillState>, pick: (s: SkillState) => number): number {
  let sum = 0;
  let weight = 0;
  for (const skill of SKILLS) {
    const s = states[skill];
    sum += pick(s) * s.reviews;
    weight += s.reviews;
  }
  return weight > 0 ? sum / weight : 0;
}

function minutesLabel(minutes: number, tone: "focused" | "light"): string {
  return `~${Math.max(1, Math.round(minutes))} min ${tone}`;
}

/**
 * Decide the recommended path and describe all three. Rules (in priority order):
 * - **High fatigue + a light round available → Light.** The retreat half: ease off honestly.
 * - **Otherwise cards due → Review.** Clear them at the right time before adding load.
 * - **Otherwise → Challenge.** Caught up and not drained → stretch / produce while sharp.
 *
 * The recommended option is always one that can actually start now, so a one-tap "just start"
 * is always safe.
 */
export function deriveCyclePlan(
  states: Record<string, SkillState>,
  { due, lightAvailable }: CycleInputs,
): CyclePlan {
  const fatigue = weighted(states, (s) => s.fatigue);

  let recommended: CyclePath;
  if (fatigue >= HIGH_FATIGUE && lightAvailable) {
    recommended = "light";
  } else if (due > 0) {
    recommended = "review";
  } else {
    recommended = "challenge";
  }

  const dueLabel = due === 1 ? "1 phrase due" : `${due} phrases due`;

  const options: CycleOption[] = [
    {
      path: "challenge",
      title: "Challenge",
      description: "Stretch into fresh material and produce language while you're sharp.",
      load: minutesLabel(CHALLENGE_MINUTES, "focused"),
      recommended: recommended === "challenge",
      available: true,
    },
    {
      path: "review",
      title: "Review",
      description: due > 0 ? `${dueLabel} — lock them in at the right time.` : "Nothing due right now.",
      load: minutesLabel(due * MIN_PER_CARD, "focused"),
      recommended: recommended === "review",
      available: due > 0,
    },
    {
      path: "light",
      title: "Light session",
      description: "A short, easy round to keep the rhythm without the load.",
      load: minutesLabel(LIGHT_MINUTES, "light"),
      recommended: recommended === "light",
      available: lightAvailable,
    },
  ];

  return { recommended, options };
}
