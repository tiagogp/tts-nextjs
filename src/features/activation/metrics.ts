import type {
  ActivityEvent,
  CardsCreatedPayload,
  CardsReviewedPayload,
} from "@/lib/store/activityLog";

/**
 * W5 validation gate metrics, derived from the persistent local activity log.
 *
 * The activation timer (see ./firstRun) writes timing onto the `cards_created`
 * and `cards_reviewed` events as they happen; this module reads it back out so a
 * moderator can score a session against the protocol in docs/w5-validation-protocol.md.
 * Durations are null when the relevant step has not happened yet on this device.
 */
export interface W5Metrics {
  /** Demo handover timestamp captured by the activation timer, if any. */
  startedAt: number | null;
  /** First app activity recorded in the local log. */
  firstActivityAt: number | null;
  /** Most recent app activity recorded in the local log. */
  lastActivityAt: number | null;
  /** Demo start -> first saved phrase. The protocol's "TT saved phrase". */
  timeToSavedPhraseMs: number | null;
  /** Demo start -> first completed review. The protocol's "TT first review" (TTFR). */
  timeToFirstReviewMs: number | null;
  /** TTFR within the 2-minute activation gate. Null until a first review exists. */
  ttfrUnderTarget: boolean | null;
  /** Distinct local-calendar days with activity, offset from the first active day. */
  activeDayOffsets: number[];
  /** Returned on or after the day following the first session (D+1 signal). */
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
    startedAt: null,
    firstActivityAt: null,
    lastActivityAt: null,
    timeToSavedPhraseMs: null,
    timeToFirstReviewMs: null,
    ttfrUnderTarget: null,
    activeDayOffsets: [],
    returnedDay1: false,
    returnedDay7: false,
  };
}

export function computeW5Metrics(events: ActivityEvent[]): W5Metrics {
  if (events.length === 0) return emptyMetrics();

  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const firstActivityAt = sorted[0].ts;
  const lastActivityAt = sorted[sorted.length - 1].ts;

  const savedTiming = sorted
    .filter((e) => e.type === "cards_created")
    .map((e) => (e.payload as CardsCreatedPayload).activation)
    .find((a) => a !== undefined);
  const reviewTiming = sorted
    .filter((e) => e.type === "cards_reviewed")
    .map((e) => (e.payload as CardsReviewedPayload).activation)
    .find((a) => a !== undefined);

  const timeToSavedPhraseMs = savedTiming?.elapsedMs ?? null;
  const timeToFirstReviewMs = reviewTiming?.elapsedMs ?? null;

  const firstDay = localDayIndex(firstActivityAt);
  const activeDayOffsets = Array.from(
    new Set(sorted.map((e) => localDayIndex(e.ts) - firstDay)),
  ).sort((a, b) => a - b);

  return {
    startedAt: savedTiming?.startedAt ?? reviewTiming?.startedAt ?? null,
    firstActivityAt,
    lastActivityAt,
    timeToSavedPhraseMs,
    timeToFirstReviewMs,
    ttfrUnderTarget: timeToFirstReviewMs === null ? null : timeToFirstReviewMs <= TTFR_TARGET_MS,
    activeDayOffsets,
    returnedDay1: activeDayOffsets.some((offset) => offset >= 1),
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
