"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { assessPronunciation } from "@/features/pronunciation/api";
import { synthesizeSpeech } from "@/features/converse/api";
import { savePronunciationAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useStageTimer } from "@/features/method/useStageTimer";
import { useT } from "@/i18n/I18nProvider";
import type {
  PronunciationAssessment,
  PronunciationAttempt,
  PronunciationWordFeedback,
} from "@/lib/pronunciation/types";

interface PronunciationCoachProps {
  targetText: string;
  targetLang?: string;
  cardId?: string;
  lessonId?: string;
  referenceAudioUrl?: string;
  source: "study" | "lesson" | "c1";
  compact?: boolean;
}

function scoreTone(score: number): string {
  if (score >= 82) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "text-accent";
  return "text-danger";
}

function wordClass(word: PronunciationWordFeedback): string {
  if (word.status === "match") return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  if (word.status === "close") return "border-accent/30 bg-accent/8 text-accent";
  if (word.status === "extra") return "border-line bg-surface text-ink-muted";
  return "border-danger/30 bg-danger/8 text-danger";
}

export function PronunciationCoach({
  targetText,
  targetLang = "en",
  cardId,
  lessonId,
  referenceAudioUrl,
  source,
  compact = false,
}: PronunciationCoachProps) {
  const { t } = useT();
  const repeatTimer = useStageTimer("repeat", 3);
  const [recording, setRecording] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [playingReference, setPlayingReference] = useState(false);
  const [assessment, setAssessment] = useState<PronunciationAssessment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const referenceRef = useRef<HTMLAudioElement | null>(null);
  const referenceUrlRef = useRef<string | null>(null);
  const referenceDurationRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      referenceRef.current?.pause();
      if (referenceUrlRef.current) URL.revokeObjectURL(referenceUrlRef.current);
    },
    [],
  );

  const playReference = useCallback(async () => {
    setNote(null);
    setPlayingReference(true);
    try {
      if (!referenceRef.current) referenceRef.current = new Audio();
      const audio = referenceRef.current;
      audio.pause();
      audio.onended = () => setPlayingReference(false);
      audio.onerror = () => setPlayingReference(false);
      if (referenceAudioUrl) {
        audio.src = referenceAudioUrl;
      } else {
        const blob = await synthesizeSpeech(targetText);
        if (referenceUrlRef.current) URL.revokeObjectURL(referenceUrlRef.current);
        referenceUrlRef.current = URL.createObjectURL(blob);
        audio.src = referenceUrlRef.current;
      }
      audio.load();
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener("loadedmetadata", done, { once: true });
        audio.addEventListener("error", done, { once: true });
      });
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        referenceDurationRef.current = Math.round(audio.duration * 1000);
      }
      await audio.play();
    } catch (err: unknown) {
      setPlayingReference(false);
      setNote(err instanceof Error ? err.message : t("Couldn't play the reference audio."));
    }
  }, [referenceAudioUrl, targetText, t]);

  const assessBlob = useCallback(
    async (blob: Blob) => {
      setAssessing(true);
      setNote(null);
      try {
        const result = await assessPronunciation({
          blob,
          targetText,
          targetLang,
          referenceDurationMs: referenceDurationRef.current,
        });
        setAssessment(result);
        if (!result.transcript) {
          setNote(t("Couldn't make out any speech in that clip."));
          return;
        }
        const attempt: PronunciationAttempt = {
          ...result,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          targetLang,
          cardId,
          lessonId,
          source,
        };
        void savePronunciationAttempt(attempt).catch(() => {});
        // One window per attempt: commit this one, then reopen for the next take.
        const repeatMinutes = repeatTimer.commit();
        repeatTimer.start();
        void emitActivity("method_stage", {
          stage: "repeat",
          area: "speaking",
          source: "pronunciation",
          minutes: repeatMinutes,
          subjectId: cardId ?? lessonId,
        }).catch(() => {});
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : t("Pronunciation assessment failed."));
      } finally {
        setAssessing(false);
      }
    },
    [cardId, lessonId, source, targetLang, targetText, t, repeatTimer],
  );

  const startRecording = useCallback(async () => {
    setAssessment(null);
    setNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) void assessBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [assessBlob, t]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  return (
    <div className={cn("rounded border border-line bg-surface/60 p-3", compact ? "space-y-2" : "space-y-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.7px] text-ink-muted">{t("Pronunciation")}</p>
          {!compact && (
            <p className="mt-0.5 text-sm text-ink-soft">{t("Listen, repeat, then check what was heard.")}</p>
          )}
        </div>
        {assessment && (
          <span className={cn("text-sm font-semibold tabular-nums", scoreTone(assessment.scores.overall))}>
            {assessment.scores.overall}%
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void playReference()}
          disabled={playingReference || recording || assessing}
        >
          {playingReference ? t("Playing...") : t("Listen")}
        </Button>
        <Button
          type="button"
          variant={recording ? "secondary" : "primary"}
          size="sm"
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={assessing}
        >
          {assessing ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              {t("Checking...")}
            </>
          ) : recording ? (
            t("Stop")
          ) : assessment ? (
            t("Try again")
          ) : (
            t("Record")
          )}
        </Button>
      </div>

      {assessment && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Score label={t("Accuracy")} value={assessment.scores.accuracy} />
            <Score label={t("Completeness")} value={assessment.scores.completeness} />
            <Score label={t("Rhythm")} value={assessment.scores.fluency} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {assessment.words.map((word, index) => (
              <span
                key={`${word.target ?? word.spoken}-${index}`}
                className={cn("rounded border px-2 py-1 text-xs", wordClass(word))}
                title={word.status}
              >
                {word.target ?? word.spoken}
              </span>
            ))}
          </div>
          {assessment.transcript && (
            <p className="text-xs text-ink-muted">{t("Heard: {transcript}", { transcript: assessment.transcript })}</p>
          )}
          <ul className="space-y-1 text-xs text-ink-soft">
            {assessment.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {note && <p className="text-xs text-danger">{note}</p>}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-card px-2 py-1.5">
      <p className="text-ink-muted">{label}</p>
      <p className={cn("font-semibold tabular-nums", scoreTone(value))}>{value}%</p>
    </div>
  );
}
