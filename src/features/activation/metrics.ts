import type {
  ActivityEvent,
  CardsCreatedPayload,
  CardsReviewedPayload,
  FirstRunStartedPayload,
} from "@/lib/store/activityLog";
import type { FirstRunActivationSource } from "@/features/activation/firstRun";

/**
 * First-run activation metrics, derived from the persistent local activity log.
 *
 * The activation timer (see ./firstRun) writes timing onto the `cards_created`
 * and `cards_reviewed` events as they happen; this module reads those values back
 * for local diagnostics and product analysis. Durations are null when the
 * relevant step has not happened yet on this device.
 */
export type ActivationDropoffStep =
  | "clip"
  | "save_phrase"
  | "review"
  | "mistake"
  | "correction"
  | "own_source";

export interface ActivationMetrics {
  /** Source path that produced activation timing, if captured. */
  activationSource: FirstRunActivationSource | null;
  /** First-run handover timestamp captured by the activation timer, if any. */
  startedAt: number | null;
  /** First app activity recorded in the local log. */
  firstActivityAt: number | null;
  /** Most recent app activity recorded in the local log. */
  lastActivityAt: number | null;
  /** First-run start -> first saved phrase. The protocol's "TT saved phrase". */
  timeToSavedPhraseMs: number | null;
  /** First-run start -> first completed review. The protocol's "TT first review" (TTFR). */
  timeToFirstReviewMs: number | null;
  /** TTFR within the 2-minute activation gate. Null until a first review exists. */
  ttfrUnderTarget: boolean | null;
  /** First-run start -> first completed loop, including a saved correction. */
  timeToFirstLoopMs: number | null;
  /** First loop within the 2-minute activation gate. Null until the loop is complete. */
  firstLoopUnderTarget: boolean | null;
  /** Activation gate: review plus correction saved from the first loop. */
  firstLoopCompleted: boolean;
  /** Own-source funnel: an import of the learner's own material was started. */
  ownSourceStarted: boolean;
  /** Own-source funnel: cards from the learner's own material were saved. */
  ownSourceCompleted: boolean;
  /** Earliest missing protocol step (save → review → mistake → correction → own source). */
  dropoffStep: ActivationDropoffStep | null;
  /** Distinct local-calendar days with activity, offset from the first active day. */
  activeDayOffsets: number[];
  /** Returned exactly on the day after the first session (classic D+1). */
  returnedDay1: boolean;
  /** Returned on or after the seventh day following the first session (D+7 signal). */
  returnedDay7: boolean;
}

/** Activation gate: median TTFR under 2 minutes on a fresh install. */
export const TTFR_TARGET_MS = 2 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-calendar day index, so "next day" follows the user's wall clock, not UTC. */
function localDayIndex(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return Math.round(d.getTime() / DAY_MS);
}

function emptyMetrics(): ActivationMetrics {
  return {
    activationSource: null,
    startedAt: null,
    firstActivityAt: null,
    lastActivityAt: null,
    timeToSavedPhraseMs: null,
    timeToFirstReviewMs: null,
    ttfrUnderTarget: null,
    timeToFirstLoopMs: null,
    firstLoopUnderTarget: null,
    firstLoopCompleted: false,
    ownSourceStarted: false,
    ownSourceCompleted: false,
    dropoffStep: null,
    activeDayOffsets: [],
    returnedDay1: false,
    returnedDay7: false,
  };
}

function isCorrectionSavedEvent(event: ActivityEvent): boolean {
  if (event.type === "correction_generated") return true;
  if (event.type !== "cards_created") return false;
  return (event.payload as CardsCreatedPayload).source === "correct";
}

export function computeActivationMetrics(events: ActivityEvent[]): ActivationMetrics {
  if (events.length === 0) return emptyMetrics();

  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const firstActivityAt = sorted[0].ts;
  const lastActivityAt = sorted[sorted.length - 1].ts;
  const startedEvent = sorted.find((e) => e.type === "first_run_started");
  const startedPayload = startedEvent?.payload as FirstRunStartedPayload | undefined;

  const savedTiming = sorted
    .filter((e) => e.type === "cards_created")
    .map((e) => (e.payload as CardsCreatedPayload).activation)
    .find((a) => a !== undefined);
  const reviewEvent = sorted.find(
    (e) => e.type === "cards_reviewed" && (e.payload as CardsReviewedPayload).activation,
  );
  const reviewTiming = reviewEvent
    ? (reviewEvent.payload as CardsReviewedPayload).activation
    : undefined;

  const timeToSavedPhraseMs = savedTiming?.elapsedMs ?? null;
  const timeToFirstReviewMs = reviewTiming?.elapsedMs ?? null;
  const activationSource = reviewTiming?.source ?? savedTiming?.source ?? startedPayload?.source ?? null;
  const startedAt = startedEvent?.ts ?? savedTiming?.startedAt ?? reviewTiming?.startedAt ?? null;
  const mistakeEvent = sorted.find((e) => e.type === "mistake_submitted");
  // Loop-scoped: only corrections after the first-run handover count, but the
  // guided lesson lets the learner write/correct before reviewing, so the loop
  // completes with review and correction in either order.
  const correctionEvent =
    startedAt === null
      ? undefined
      : sorted.find((e) => e.ts >= startedAt && isCorrectionSavedEvent(e));
  const timeToFirstLoopMs =
    startedAt !== null && reviewEvent && correctionEvent
      ? Math.max(0, Math.max(reviewEvent.ts, correctionEvent.ts) - startedAt)
      : null;
  const firstLoopCompleted = timeToFirstLoopMs !== null;
  // Own-source funnel (first_loop_completed → started → completed). New builds
  // emit explicit own_source_* events; older logs still score via the legacy
  // discover signals so past sessions don't read as "not attempted".
  const ownSourceCompleted = sorted.some(
    (e) =>
      e.type === "own_source_completed" ||
      (e.type === "cards_created" && (e.payload as CardsCreatedPayload).source === "discover"),
  );
  const ownSourceStarted =
    ownSourceCompleted ||
    sorted.some(
      (e) =>
        e.type === "own_source_started" ||
        e.type === "video_processed" ||
        (e.type === "first_run_started" &&
          (e.payload as FirstRunStartedPayload).source === "own_source"),
    );
  const dropoffStep: ActivationDropoffStep | null =
    firstLoopCompleted
      ? ownSourceCompleted
        ? null
        : "own_source"
      : startedAt === null
        ? "clip"
        : !savedTiming
          ? "save_phrase"
          : !reviewTiming
            ? "review"
            : !mistakeEvent && !correctionEvent
              ? "mistake"
              : "correction";

  const firstDay = localDayIndex(firstActivityAt);
  const activeDayOffsets = Array.from(
    new Set(sorted.map((e) => localDayIndex(e.ts) - firstDay)),
  ).sort((a, b) => a - b);

  return {
    activationSource,
    startedAt,
    firstActivityAt,
    lastActivityAt,
    timeToSavedPhraseMs,
    timeToFirstReviewMs,
    ttfrUnderTarget: timeToFirstReviewMs === null ? null : timeToFirstReviewMs < TTFR_TARGET_MS,
    timeToFirstLoopMs,
    firstLoopUnderTarget: timeToFirstLoopMs === null ? null : timeToFirstLoopMs < TTFR_TARGET_MS,
    firstLoopCompleted,
    ownSourceStarted,
    ownSourceCompleted,
    dropoffStep,
    activeDayOffsets,
    // Classic day-1 retention: a return on day 3 alone is not a D+1 return, and
    // a single day-30 visit must not satisfy both gates at once.
    returnedDay1: activeDayOffsets.includes(1),
    returnedDay7: activeDayOffsets.some((offset) => offset >= 7),
  };
}

/** Compact "1m 30s" / "45s" rendering for an activation duration. */
export function formatActivationDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
