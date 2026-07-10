"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { StatusPill, type StatusPillProps } from "@/components/ui/StatusPill";
import { useT } from "@/i18n/I18nProvider";
import {
  computeW5Metrics,
  formatActivationDuration,
  type W5Metrics,
} from "@/features/activation/metrics";
import { getActivityLog } from "@/lib/store/activityLog";
import { isStoreAvailable } from "@/lib/store/db";

type Tone = NonNullable<StatusPillProps["tone"]>;

const MODERATOR_FLAG_KEY = "phraseloop.w5Moderator";
const subscribeNever = () => () => {};
let moderatorParamApplied = false;

/**
 * The readout is research instrumentation, not product: end users should never
 * see it. A moderator enables it once per machine by opening the app with
 * `?w5=1` (and disables it with `?w5=0`); the choice persists in localStorage.
 */
function readModeratorFlag(): boolean {
  try {
    if (!moderatorParamApplied) {
      moderatorParamApplied = true;
      const param = new URLSearchParams(window.location.search).get("w5");
      if (param === "1") window.localStorage.setItem(MODERATOR_FLAG_KEY, "1");
      if (param === "0") window.localStorage.removeItem(MODERATOR_FLAG_KEY);
    }
    return window.localStorage.getItem(MODERATOR_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function useW5ModeratorFlag(): boolean {
  return useSyncExternalStore(subscribeNever, readModeratorFlag, () => false);
}

/**
 * Moderator-facing readout for the W5 first-run round (docs/w5-validation-protocol.md).
 * It surfaces the activation and retention gate metrics that the app already records
 * on this device, so a session can be scored from real local data instead of a stopwatch.
 * Hidden unless the moderator flag is set (see `useW5ModeratorFlag`).
 */
export default function W5ValidationCard() {
  const { t } = useT();
  const moderator = useW5ModeratorFlag();
  const [metrics, setMetrics] = useState<W5Metrics | null>(null);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!isStoreAvailable()) return;
    try {
      setMetrics(computeW5Metrics(await getActivityLog()));
    } catch {
      // The readout is diagnostic only; never surface store errors here.
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
      setAvailable(isStoreAvailable());
    };
    void run();
    const handle = () => void load();
    window.addEventListener("phraseloop:activity", handle);
    window.addEventListener("phraseloop:backup-restored", handle);
    return () => {
      window.removeEventListener("phraseloop:activity", handle);
      window.removeEventListener("phraseloop:backup-restored", handle);
    };
  }, [load]);

  const duration = (ms: number | null) =>
    ms === null ? t("Not yet") : formatActivationDuration(ms);

  const ttfrTone: Tone =
    metrics?.ttfrUnderTarget == null ? "default" : metrics.ttfrUnderTarget ? "success" : "danger";
  const loopTone: Tone =
    metrics?.firstLoopUnderTarget == null
      ? "default"
      : metrics.firstLoopUnderTarget
        ? "success"
        : "danger";

  const returnTone = (returned: boolean): Tone => (returned ? "success" : "default");
  const returnLabel = (returned: boolean) => (returned ? t("Returned") : t("No return yet"));
  const activationSourceLabel = metrics?.activationSource === "own_source"
    ? t("Own source")
    : metrics?.activationSource === "bundled_lesson"
      ? t("Bundled lesson")
      : t("Not yet");
  const dropoffLabel = metrics?.dropoffStep ? dropoffStepLabel(metrics.dropoffStep, t) : t("Complete");

  if (!moderator) return null;

  return (
    <Card className="mt-4 p-5">
      <div>
        <h3 className="font-medium text-ink">{t("W5 validation")}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {t(
            "First-run activation and return signal recorded on this device. Use it to score a session against the validation protocol.",
          )}
        </p>
      </div>

      {!available ? (
        <p className="mt-4 text-sm text-ink-muted">
          {t("Local activity data is unavailable in this build.")}
        </p>
      ) : (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <MetricRow label={t("Activation source")} value={activationSourceLabel} />
          <MetricRow label={t("Time to saved phrase")} value={duration(metrics?.timeToSavedPhraseMs ?? null)} />
          <MetricRow
            label={t("Time to first review")}
            value={duration(metrics?.timeToFirstReviewMs ?? null)}
            pill={
              metrics?.timeToFirstReviewMs == null
                ? undefined
                : { tone: ttfrTone, label: metrics.ttfrUnderTarget ? t("Under 2m") : t("Over 2m") }
            }
          />
          <MetricRow
            label={t("Time to first loop")}
            value={duration(metrics?.timeToFirstLoopMs ?? null)}
            pill={
              metrics?.timeToFirstLoopMs == null
                ? { tone: "default", label: t("Incomplete") }
                : { tone: loopTone, label: metrics.firstLoopUnderTarget ? t("Under 2m") : t("Over 2m") }
            }
          />
          <MetricRow
            label={t("Dropoff step")}
            value={dropoffLabel}
            pill={{
              tone: metrics?.firstLoopCompleted ? "success" : "default",
              label: metrics?.firstLoopCompleted ? t("Complete") : t("Open"),
            }}
          />
          <MetricRow
            label={t("Own source funnel")}
            value={
              metrics?.ownSourceCompleted
                ? t("Completed")
                : metrics?.ownSourceStarted
                  ? t("Attempted")
                  : t("Not attempted")
            }
            pill={{
              tone: metrics?.ownSourceCompleted ? "success" : "default",
              label: metrics?.ownSourceCompleted ? t("Yes") : t("No"),
            }}
          />
          <MetricRow
            label={t("D+1 return")}
            value={returnLabel(metrics?.returnedDay1 ?? false)}
            pill={{ tone: returnTone(metrics?.returnedDay1 ?? false), label: metrics?.returnedDay1 ? t("Yes") : t("No") }}
          />
          <MetricRow
            label={t("D+7 return")}
            value={returnLabel(metrics?.returnedDay7 ?? false)}
            pill={{ tone: returnTone(metrics?.returnedDay7 ?? false), label: metrics?.returnedDay7 ? t("Yes") : t("No") }}
          />
        </dl>
      )}

      {available && metrics && metrics.activeDayOffsets.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">
          {t("Active days since first session: {days}", {
            days: metrics.activeDayOffsets.map((offset) => `D+${offset}`).join(", "),
          })}
        </p>
      )}
    </Card>
  );
}

function dropoffStepLabel(
  step: NonNullable<W5Metrics["dropoffStep"]>,
  t: (en: string, vars?: Record<string, string | number>) => string,
) {
  switch (step) {
    case "clip":
      return t("Clip");
    case "save_phrase":
      return t("Save phrase");
    case "review":
      return t("Review");
    case "mistake":
      return t("Mistake");
    case "correction":
      return t("Correction");
    case "own_source":
      return t("Own source");
  }
}

function MetricRow({
  label,
  value,
  pill,
}: {
  label: string;
  value: string;
  pill?: { tone: Tone; label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-line bg-card px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums text-ink">{value}</span>
        {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
      </dd>
    </div>
  );
}
