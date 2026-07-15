"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { useStageTimer } from "@/features/method/useStageTimer";
import { saveAudioRecording, saveProductionAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import type { ProductionAttempt } from "@/lib/performance/types";
import { useT } from "@/i18n/I18nProvider";

/** A bounded open-speaking surface for the timed-monologue progression stages. */
export function TimedMonologue({
  prompt,
  targetSeconds,
  lessonId,
  scaffoldUsed = true,
  onComplete,
}: {
  prompt: string;
  targetSeconds: number;
  lessonId?: string;
  scaffoldUsed?: boolean;
  onComplete?: () => void;
}) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [promptStartedAt] = useState(() => Date.now());
  const timer = useStageTimer("speak", 3);
  const audio = useCorrectionAudio({
    onNote: setNote,
    onText: (updater) => setText(updater),
    onBlob: setBlob,
    maxDurationMs: targetSeconds * 1000,
  });

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || saved) return;
    const createdAt = Date.now();
    const durationMs = Math.max(audio.recordingElapsedMs, 1000);
    const recordingId = blob
      ? crypto.randomUUID()
      : undefined;
    if (recordingId && blob) {
      await saveAudioRecording({
        id: recordingId,
        blob,
        mimeType: blob.type || "audio/webm",
        sizeBytes: blob.size,
        createdAt,
      }).catch(() => undefined);
    }
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      lessonId,
      source: "study",
      stage: "production",
      prompt,
      recordingId,
      preparationMs: Math.max(0, createdAt - promptStartedAt),
      text: trimmed,
      spoken: Boolean(blob),
      wordCount,
      finished: true,
      issueCount: 0,
      evaluated: false,
      scaffoldUsed,
      durationMs,
      fluency: {
        wordsPerMinute: Math.round((wordCount / (durationMs / 60000)) * 10) / 10,
      },
      createdAt,
    };
    await saveProductionAttempt(attempt);
    await emitActivity("production_attempt", {
      attemptId: attempt.id,
      lessonId,
      source: attempt.source,
      stage: attempt.stage,
      prompt,
      recordingId,
      text: attempt.text,
      spoken: attempt.spoken,
      wordCount,
      finished: true,
      issueCount: 0,
      evaluated: false,
      scaffoldUsed,
      durationMs,
      preparationMs: attempt.preparationMs,
      fluency: attempt.fluency,
      createdAt,
    });
    const minutes = timer.commit("speak");
    await emitActivity("method_stage", {
      stage: "speak",
      area: "speaking",
      source: "study",
      minutes,
      subjectId: lessonId,
    });
    setSaved(true);
    onComplete?.();
  };

  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Timed speaking")}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{t("Keep speaking for {seconds} seconds", { seconds: targetSeconds })}</h3>
        <p className="mt-1 text-sm text-ink-soft">{t(prompt)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span>{Math.round(audio.recordingElapsedMs / 1000)}s / {targetSeconds}s</span>
        {audio.transcribing && <span className="inline-flex items-center gap-1"><Spinner className="h-3 w-3" /> {t("Transcribing…")}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={audio.recording ? "secondary" : "primary"} onClick={audio.recording ? audio.stopRecording : audio.startRecording} disabled={audio.transcribing || saved}>
          {audio.recording ? t("Stop recording") : t("Start recording")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void save()} disabled={!text.trim() || audio.recording || audio.transcribing || saved}>
          {saved ? t("Saved") : t("Save speaking evidence")}
        </Button>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        placeholder={t("Your transcript appears here; you can also type if the microphone is unavailable.")}
        className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
        aria-label={t("Timed monologue transcript")}
      />
      {note && <p className="text-xs text-danger">{t(note)}</p>}
      {saved && <p className="text-xs text-emerald-700 dark:text-emerald-300">{t("Speaking duration and word-rate evidence saved separately from study time.")}</p>}
    </Card>
  );
}
