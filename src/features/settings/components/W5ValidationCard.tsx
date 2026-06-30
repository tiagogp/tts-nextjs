"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Moderator-facing readout for the W5 first-run round (docs/w5-validation-protocol.md).
 * It surfaces the activation and retention gate metrics that the app already records
 * on this device, so a session can be scored from real local data instead of a stopwatch.
 */
export default function W5ValidationCard() {
  const { t } = useT();
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

  const returnTone = (returned: boolean): Tone => (returned ? "success" : "default");
  const returnLabel = (returned: boolean) => (returned ? t("Returned") : t("No return yet"));

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
