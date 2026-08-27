import type { ListeningAttempt } from "@/lib/performance/types";
import bank from "./coldProbes.json";

/**
 * The cold-listening probe: a short clip of real speech from a voice the learner has never
 * heard, played once, with no transcript.
 *
 * Every built-in lesson clip is Kokoro synthesis — one speaker set, clean audio, no
 * overlap, no accent variation. That is an honest fallback for *studying* a phrase, but it
 * makes the top rung of the listening ladder (`natural_comprehension`) unreachable, and it
 * makes "comprehension of unfamiliar speech" unmeasurable for anyone who imports nothing.
 * `coldListening()` says so today by returning null.
 *
 * This bank is how that stops being permanent. It is deliberately *separate* from lesson
 * audio, and the separation is the design:
 *
 *   - a probe is never card material. Studying it would destroy the one property being
 *     measured, which is that the voice has not been heard before;
 *   - a probe is never synthesized. `yarn learn:audio` only synthesizes clips declared in
 *     lessons.json, and the content validator rejects a probe without a licensed native
 *     recording behind it, so a probe is authentic or it does not exist;
 *   - a probe is played once. A replay turns a measurement into study.
 *
 * The bank ships empty, because licensed recordings are content acquisition, not code.
 * Empty means the probe is simply never offered — not that comprehension scored zero.
 */

export type ColdProbeQuestionKind = "mainIdea" | "detail";

export interface ColdProbeQuestion {
  kind: ColdProbeQuestionKind;
  prompt: string;
  options: string[];
  answer: string;
}

export interface ColdProbe {
  id: string;
  /** Public path of the recording, mirrored from `native-audio/`. */
  clip: string;
  /** Accent or region, so the bank can be checked for variety rather than assumed to have it. */
  accent: string;
  speakerId: string;
  durationSec: number;
  /** One line of orientation in the learner's own language is allowed; the audio is not. */
  topic: string;
  questions: ColdProbeQuestion[];
}

/** Two weeks between probes: often enough to plot a curve, rare enough not to become study. */
export const PROBE_INTERVAL_DAYS = 14;

/** Marks every attempt this feature writes, so past probes can be found without a new store. */
export const PROBE_SOURCE_ID = "cold-listening-probe";

const DAY_MS = 86_400_000;

function isUsable(probe: ColdProbe): boolean {
  if (!probe?.id || !probe.clip || !probe.accent || !probe.speakerId) return false;
  const mainIdea = probe.questions?.filter((question) => question.kind === "mainIdea") ?? [];
  if (mainIdea.length !== 1) return false;
  return probe.questions.every((question) =>
    question.options?.length >= 2 && question.options.includes(question.answer));
}

/**
 * Malformed entries are dropped rather than thrown on: the build already rejects them, and
 * a probe that cannot be scored must not reach a learner as a half-working exercise.
 */
export const COLD_PROBES: ColdProbe[] = ((bank as { probes?: ColdProbe[] }).probes ?? []).filter(isUsable);

export interface ColdProbeSelection {
  attempts: readonly ListeningAttempt[];
  now: number;
  /** The bank to draw from. Defaults to the bundled one; injected by tests. */
  probes?: readonly ColdProbe[];
}

/** Probe attempts already taken, oldest first. */
export function pastProbes(attempts: readonly ListeningAttempt[]): ListeningAttempt[] {
  return attempts
    .filter((attempt) => attempt.sourceId === PROBE_SOURCE_ID)
    .sort((left, right) => left.completedAt - right.completedAt);
}

/**
 * The next probe to run, or null.
 *
 * Null has three quite different causes — no bank, all clips heard, not due yet — and none
 * of them is a result about the learner. The caller renders nothing.
 */
export function selectColdProbe({ attempts, now, probes = COLD_PROBES }: ColdProbeSelection): ColdProbe | null {
  const usable = probes.filter(isUsable);
  if (usable.length === 0) return null;
  const past = pastProbes(attempts);
  const last = past[past.length - 1];
  if (last && now - last.completedAt < PROBE_INTERVAL_DAYS * DAY_MS) return null;
  const heard = new Set(past.map((attempt) => attempt.lessonId));
  return usable.find((probe) => !heard.has(probeAttemptKey(probe))) ?? null;
}

/** How a probe attempt is tagged, so a clip is never offered to the same learner twice. */
export function probeAttemptKey(probe: ColdProbe): string {
  return `probe:${probe.id}`;
}

/** Clips left for this learner. Surfaced so the UI never implies an endless supply. */
export function remainingProbes(
  attempts: readonly ListeningAttempt[],
  probes: readonly ColdProbe[] = COLD_PROBES,
): number {
  const heard = new Set(pastProbes(attempts).map((attempt) => attempt.lessonId));
  return probes.filter((probe) => !heard.has(probeAttemptKey(probe))).length;
}
