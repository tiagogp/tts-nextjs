"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { assessPronunciation } from "@/features/pronunciation/api";
import { synthesizeSpeech } from "@/features/converse/api";
import { getPronunciationAttempts, saveAudioRecording, savePronunciationAttempt, saveProductionAttempt } from "@/lib/store/repository";
import type { ProductionAttempt } from "@/lib/performance/types";
import { RecordingComparison } from "@/features/pronunciation/components/RecordingComparison";
import { emitActivity } from "@/lib/store/activityLog";
import { useStageTimer } from "@/features/method/useStageTimer";
import { useT } from "@/i18n/I18nProvider";
import { micFallbackAvailable } from "@/features/correct/micFallback";
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
  stage?: "repeat" | "production" | "retry";
  noticedPhraseId?: string;
  onAttemptComplete?: (attempt: { spoken: boolean; text: string }) => void;
  /** Let a learner continue explicitly when the browser denies microphone access. */
  allowTypedFallback?: boolean;
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
  stage,
  noticedPhraseId,
  onAttemptComplete,
  allowTypedFallback = false,
  compact = false,
}: PronunciationCoachProps) {
  const { t } = useT();
  const repeatTimer = useStageTimer("repeat", 3);
  const [recording, setRecording] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [playingReference, setPlayingReference] = useState(false);
  const [assessment, setAssessment] = useState<PronunciationAssessment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [history, setHistory] = useState<PronunciationAttempt[]>([]);
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
          stage,
          noticedPhraseId,
        };
        const recordingId = crypto.randomUUID();
        attempt.recordingId = recordingId;
        await saveAudioRecording({
          id: recordingId,
          blob,
          mimeType: blob.type || "audio/webm",
          sizeBytes: blob.size,
          createdAt: attempt.createdAt,
        }).catch(() => undefined);
        void savePronunciationAttempt(attempt).catch(() => {});
        const production: ProductionAttempt = {
          id: attempt.id,
          lessonId,
          source: source === "lesson" ? "lesson" : "correct",
          stage,
          noticedPhraseId,
          recordingId,
          prompt: targetText,
          text: result.transcript,
          spoken: true,
          wordCount: result.transcript.split(/\s+/).filter(Boolean).length,
          finished: true,
          issueCount: result.scores.completeness < 80 ? 1 : 0,
          durationMs: result.durationMs,
          createdAt: attempt.createdAt,
        };
        if (stage) void saveProductionAttempt(production).catch(() => {});
        setHistory((current) => [...current, attempt]);
        onAttemptComplete?.({ spoken: true, text: result.transcript });
        // One window per attempt: commit this one, then reopen for the next take.
        // The coach is reused by Repeat, original production, and retry; do not
        // flatten those distinct method stages into repeat in the ledger.
        const methodStage = stage === "production" ? "speak" : stage ?? "repeat";
        const repeatMinutes = repeatTimer.commit();
        repeatTimer.start();
        void emitActivity("method_stage", {
          stage: methodStage,
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
    [cardId, lessonId, noticedPhraseId, onAttemptComplete, source, stage, targetLang, targetText, t, repeatTimer],
  );

  const startRecording = useCallback(async () => {
    setAssessment(null);
    setNote(null);
    setMicDenied(false);
    setFallbackUsed(false);
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
      setMicDenied(true);
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [assessBlob, t]);

  const completeTypedFallback = () => {
    if (!fallbackText.trim() || fallbackUsed) return;
    setFallbackUsed(true);
    setNote(null);
    const now = Date.now();
    const id = crypto.randomUUID();
    const text = fallbackText.trim();
    const production: ProductionAttempt = {
      id,
      lessonId,
      source: source === "lesson" ? "lesson" : "correct",
      stage,
      noticedPhraseId,
      prompt: targetText,
      text,
      spoken: false,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      finished: true,
      issueCount: 0,
      createdAt: now,
    };
    if (stage) void saveProductionAttempt(production).catch(() => {});
    onAttemptComplete?.({ spoken: false, text });
    const methodStage = stage === "production" ? "speak" : stage ?? "repeat";
    const repeatMinutes = repeatTimer.commit();
    void emitActivity("method_stage", {
      stage: methodStage,
      area: "speaking",
      source: "pronunciation",
      minutes: repeatMinutes,
      subjectId: cardId ?? lessonId,
    }).catch(() => {});
  };

  useEffect(() => {
    if (!cardId && !lessonId) return;
    void getPronunciationAttempts().then((attempts) => {
      setHistory(attempts.filter((attempt) =>
        attempt.targetText === targetText && attempt.lessonId === lessonId && attempt.cardId === cardId,
      ));
    }).catch(() => {});
  }, [cardId, lessonId, targetText]);

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

      {micFallbackAvailable({ allowTypedFallback, micDenied }) && !fallbackUsed && (
        <div className="space-y-2 rounded border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs text-ink-soft">
            {t("Microphone access was denied. Type the phrase back once to continue with an accessibility fallback.")}
          </p>
          <input
            value={fallbackText}
            onChange={(event) => setFallbackText(event.target.value)}
            aria-label={t("Typed repeat fallback")}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
            placeholder={targetText}
          />
          <Button type="button" variant="secondary" size="sm" onClick={completeTypedFallback}>
            {t("Continue with typed repeat")}
          </Button>
        </div>
      )}

      {fallbackUsed && (
        <p className="text-xs text-ink-muted">
          {t("Typed fallback completed. You can continue to your own sentence.")}
        </p>
      )}

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

      <RecordingComparison attempts={history} />

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
