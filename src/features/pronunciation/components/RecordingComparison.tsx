"use client";

import { useEffect, useState } from "react";
import { getAudioRecording } from "@/lib/store/repository";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";

export function comparableAttemptPair(attempts: PronunciationAttempt[]): {
  earlier: PronunciationAttempt;
  later: PronunciationAttempt;
} | null {
  const groups = new Map<string, PronunciationAttempt[]>();
  for (const attempt of attempts) {
    if (!attempt.recordingId) continue;
    // Compare like with like: a later recording only says something useful when it
    // answers the same prompt/phrase, not merely because it is newer.
    const key = [
      attempt.targetText.trim().toLowerCase(),
      attempt.lessonId ?? "",
      attempt.cardId ?? "",
      attempt.noticedPhraseId ?? "",
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(attempt);
    groups.set(key, group);
  }
  const comparable = [...groups.values()]
    .filter((group) => group.length >= 2)
    .sort((left, right) => {
      const latestLeft = Math.max(...left.map((attempt) => attempt.createdAt));
      const latestRight = Math.max(...right.map((attempt) => attempt.createdAt));
      return right.length - left.length || latestRight - latestLeft;
    })[0]
    ?.sort((a, b) => a.createdAt - b.createdAt);
  if (!comparable) return null;
  return { earlier: comparable[0], later: comparable[comparable.length - 1] };
}

function signedDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function seconds(durationMs?: number): string {
  return durationMs == null ? "—" : `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * A deliberately descriptive comparison: it shows two samples and their evidence,
 * without claiming that the later sample caused the score change.
 */
export function RecordingComparison({ attempts }: { attempts: PronunciationAttempt[] }) {
  const pair = comparableAttemptPair(attempts);
  const earlier = pair?.earlier;
  const later = pair?.later;
  const earlierId = earlier?.id;
  const laterId = later?.id;
  const earlierRecordingId = earlier?.recordingId;
  const laterRecordingId = later?.recordingId;
  const [urls, setUrls] = useState<{ earlier?: string; later?: string }>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        [earlierRecordingId, laterRecordingId].map(async (recordingId) => {
          if (!recordingId) return undefined;
          const recording = await getAudioRecording(recordingId);
          return recording ? URL.createObjectURL(recording.blob) : undefined;
        }),
      );
      if (cancelled) {
        entries.forEach((url) => url && URL.revokeObjectURL(url));
        return;
      }
      setUrls({ earlier: entries[0], later: entries[1] });
    };
    void load();
    return () => {
      cancelled = true;
      setUrls((current) => {
        if (current.earlier) URL.revokeObjectURL(current.earlier);
        if (current.later) URL.revokeObjectURL(current.later);
        return {};
      });
    };
  }, [earlierId, laterId, earlierRecordingId, laterRecordingId]);

  if (!earlier || !later) return null;

  return (
    <div className="space-y-2 rounded border border-line bg-surface/60 p-3 text-xs">
      <p className="font-medium text-ink">Compare attempts</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["Earlier", earlier, urls.earlier],
          ["Later", later, urls.later],
        ] as const).map(([label, attempt, url]) => (
          <div key={label} className="space-y-1.5">
            <p className="font-medium text-ink-soft">{label}</p>
            {url ? <audio controls preload="metadata" src={url} className="w-full" /> : <p className="text-ink-muted">Audio is no longer available.</p>}
            <p className="text-ink-muted">
              Overall {attempt.scores.overall}% · completeness {attempt.scores.completeness}% · rhythm {attempt.scores.fluency}% · {seconds(attempt.durationMs)}
            </p>
            <p className="text-ink-soft">{attempt.transcript || "No transcript"}</p>
          </div>
        ))}
      </div>
      <p className="text-ink-muted">
        Change: overall {signedDelta(later.scores.overall - earlier.scores.overall)} · completeness {signedDelta(later.scores.completeness - earlier.scores.completeness)} · rhythm {signedDelta(later.scores.fluency - earlier.scores.fluency)} · duration {seconds(earlier.durationMs)} → {seconds(later.durationMs)}
      </p>
    </div>
  );
}
