import type {
  ActivityEvent,
  CardsCreatedPayload,
  CardsReviewedPayload,
  FirstRunStartedPayload,
} from "@/lib/store/activityLog";
import type { FirstRunActivationSource } from "@/features/activation/firstRun";

/**
 * W5 validation gate metrics, derived from the persistent local activity log.
 *
 * The activation timer (see ./firstRun) writes timing onto the `cards_created`
 * and `cards_reviewed` events as they happen; this module reads it back out so a
 * moderator can score a session against the protocol in docs/w5-validation-protocol.md.
 * Durations are null when the relevant step has not happened yet on this device.
 */
export type W5DropoffStep =
  | "clip"
  | "save_phrase"
  | "review"
  | "mistake"
  | "correction"
  | "own_source";

export interface W5Metrics {
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
  /** Earliest missing protocol step (save → review → mistake → correction). */
  dropoffStep: W5DropoffStep | null;
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

function emptyMetrics(): W5Metrics {
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

export function computeW5Metrics(events: ActivityEvent[]): W5Metrics {
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
  const dropoffStep: W5DropoffStep | null =
    firstLoopCompleted
      ? null
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
    ttfrUnderTarget: timeToFirstReviewMs === null ? null : timeToFirstReviewMs <= TTFR_TARGET_MS,
    timeToFirstLoopMs,
    firstLoopUnderTarget: timeToFirstLoopMs === null ? null : timeToFirstLoopMs <= TTFR_TARGET_MS,
    firstLoopCompleted,
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
