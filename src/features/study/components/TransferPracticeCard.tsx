"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCards, getConversations, getErrorEvents, getMethodProgression, saveAudioRecording, saveProductionAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { buildTransferActivities, type TransferActivity } from "../transfer";
import { useT } from "@/i18n/I18nProvider";
import { supportForProgression, type MethodProgressionState } from "@/features/method/progression";
import type { ProductionAttempt } from "@/lib/performance/types";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";

/**
 * A small open-production surface for transfer review. It deliberately records
 * practice as unevaluated evidence: saying something new is useful, but it is
 * not the same claim as saying it was correct.
 */
export function TransferPracticeCard() {
  const { t } = useT();
  const responseId = useId();
  const [activities, setActivities] = useState<TransferActivity[]>([]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState<ProductionAttempt | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const promptStartedAtRef = useRef(0);
  const [progression, setProgression] = useState<MethodProgressionState | undefined>();
  const support = supportForProgression(progression);
  const audio = useCorrectionAudio({
    onNote: setAudioNote,
    onText: (updater) => setValue(updater),
    onBlob: setRecordingBlob,
  });

  const load = useCallback(async () => {
    const [cards, errors, conversations, currentProgression] = await Promise.all([
      getCards(),
      getErrorEvents(),
      getConversations(),
      getMethodProgression(),
    ]);
    setActivities(buildTransferActivities(cards, errors, conversations));
    promptStartedAtRef.current = Date.now();
    setProgression(currentProgression);
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run().catch(() => undefined);
    const refresh = () => void load().catch(() => undefined);
    window.addEventListener("phraseloop:activity", refresh);
    return () => window.removeEventListener("phraseloop:activity", refresh);
  }, [load]);

  const activity = activities[index];

  const playSpeechPrompt = () => {
    if (!activity?.speechText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(activity.speechText));
  };

  const advancePrompt = () => {
    setIndex((current) => (current + 1) % Math.max(1, activities.length));
    setValue("");
    setRecordingBlob(null);
    setAudioNote(null);
    setSaved(false);
    setPendingAttempt(null);
    promptStartedAtRef.current = Date.now();
  };

  const submit = async () => {
    const text = value.trim();
    if (!activity || !text || pendingAttempt) return;
    const now = Date.now();
    const recordingId = recordingBlob ? crypto.randomUUID() : undefined;
    if (recordingId && recordingBlob) {
      await saveAudioRecording({
        id: recordingId,
        blob: recordingBlob,
        mimeType: recordingBlob.type || "audio/webm",
        sizeBytes: recordingBlob.size,
        createdAt: now,
      }).catch(() => undefined);
    }
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      source: "study" as const,
      stage: "production" as const,
      prompt: activity.prompt,
      context: activity.kind,
      transferKind: activity.kind,
      transferSourceId: activity.sourceId,
      recordingId,
      preparationMs: Math.max(0, now - (promptStartedAtRef.current || now)),
      text,
      spoken: Boolean(recordingBlob),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      finished: true,
      issueCount: 0,
      evaluated: false,
      durationMs: audio.recordingElapsedMs || undefined,
      fluency: recordingBlob && audio.recordingElapsedMs > 0
        ? { wordsPerMinute: Math.round((text.split(/\s+/).filter(Boolean).length / (audio.recordingElapsedMs / 60000)) * 10) / 10 }
        : undefined,
      newContext: activity.newContext,
      listeningRecognition: activity.kind === "listening_recognition",
      scaffoldUsed: activity.kind === "reading_to_meaning" || support.readingWriting.stage !== "independent_transfer",
      createdAt: now,
    };
    await saveProductionAttempt(attempt);
    await emitActivity("production_attempt", {
      attemptId: attempt.id,
      source: attempt.source,
      stage: attempt.stage,
      prompt: attempt.prompt,
      text: attempt.text,
      spoken: attempt.spoken,
      wordCount: attempt.wordCount,
      finished: attempt.finished,
      issueCount: attempt.issueCount,
      evaluated: attempt.evaluated,
      scaffoldUsed: attempt.scaffoldUsed,
      transferKind: attempt.transferKind,
      transferSourceId: attempt.transferSourceId,
      recordingId: attempt.recordingId,
      preparationMs: attempt.preparationMs,
      newContext: attempt.newContext,
      listeningRecognition: attempt.listeningRecognition,
      durationMs: attempt.durationMs,
      fluency: attempt.fluency,
      createdAt: attempt.createdAt,
    });
    setPendingAttempt(attempt);
    setSaved(true);
    setValue("");
    setRecordingBlob(null);
  };

  const skip = async () => {
    if (!activity || pendingAttempt) return;
    const createdAt = Date.now();
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      source: "study",
      stage: "production",
      prompt: activity.prompt,
      context: activity.kind,
      transferKind: activity.kind,
      transferSourceId: activity.sourceId,
      text: "",
      spoken: false,
      wordCount: 0,
      finished: false,
      skipped: true,
      evaluated: true,
      issueCount: 0,
      preparationMs: Math.max(0, createdAt - (promptStartedAtRef.current || createdAt)),
      newContext: activity.newContext,
      createdAt,
    };
    await saveProductionAttempt(attempt);
    await emitActivity("production_attempt", {
      attemptId: attempt.id,
      source: attempt.source,
      stage: attempt.stage,
      prompt: attempt.prompt,
      text: attempt.text,
      spoken: attempt.spoken,
      wordCount: 0,
      finished: false,
      issueCount: 0,
      evaluated: true,
      skipped: true,
      preparationMs: attempt.preparationMs,
      transferKind: attempt.transferKind,
      transferSourceId: attempt.transferSourceId,
      newContext: attempt.newContext,
      createdAt,
    });
    advancePrompt();
  };

  const evaluateTransfer = async (clear: boolean) => {
    if (!pendingAttempt) return;
    const evaluated: ProductionAttempt = {
      ...pendingAttempt,
      evaluated: true,
      issueCount: clear ? 0 : 1,
      transferOutcome: clear ? "clear" : "needs_support",
      comprehensionScore: pendingAttempt.transferKind === "reading_to_meaning" || pendingAttempt.transferKind === "listening_recognition"
        ? (clear ? 100 : 50)
        : undefined,
      writingScore: pendingAttempt.transferKind !== "reading_to_meaning" && pendingAttempt.transferKind !== "listening_recognition"
        ? (clear ? 100 : 50)
        : undefined,
      retold: pendingAttempt.transferKind === "topic_retell" ? clear : undefined,
      avoidedErrorIds: activity?.errorIds && clear ? activity.errorIds : undefined,
    };
    await saveProductionAttempt(evaluated);
    await emitActivity("production_attempt", {
      attemptId: evaluated.id,
      source: evaluated.source,
      stage: evaluated.stage,
      prompt: evaluated.prompt,
      text: evaluated.text,
      spoken: evaluated.spoken,
      wordCount: evaluated.wordCount,
      finished: evaluated.finished,
      issueCount: evaluated.issueCount,
      evaluated: true,
      scaffoldUsed: evaluated.scaffoldUsed,
      transferKind: evaluated.transferKind,
      transferSourceId: evaluated.transferSourceId,
      recordingId: evaluated.recordingId,
      transferOutcome: evaluated.transferOutcome,
      newContext: evaluated.newContext,
      retold: evaluated.retold,
      listeningRecognition: evaluated.listeningRecognition,
      avoidedErrorIds: evaluated.avoidedErrorIds,
      comprehensionScore: evaluated.comprehensionScore,
      writingScore: evaluated.writingScore,
      createdAt: evaluated.createdAt,
    });
    await emitActivity("method_stage", {
      stage: activity?.kind === "reading_to_meaning" ? "feedback" : "retry",
      area: "readingWriting",
      source: "study",
      minutes: activity?.kind === "reading_to_meaning" ? 3 : 2,
      subjectId: evaluated.transferSourceId,
    });
    setPendingAttempt(null);
  };

  if (!activity) return null;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Transfer practice")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t("Use a saved idea in a new context")}</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
            {t("Write or speak a short response, then decide whether the meaning was clear.")}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-ink-muted">
          {t("Support · {stage}", { stage: support.readingWriting.stage.replaceAll("_", " ") })}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        {t("Guidance · {guidance}", { guidance: t(support.readingWriting.guidance) })}
      </p>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.6px] text-accent">
            {activity.kind === "reading_to_meaning" ? t("Reading comprehension") : activity.kind === "listening_recognition" ? t("Listening recognition") : activity.kind === "topic_retell" ? t("Topic retell") : t("Open transfer")}
          </span>
          {activity.recurring && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
              {t("Recurring pattern")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-ink">{t(activity.prompt)}</p>
        {activity.audioUrl && (
          <audio controls preload="metadata" className="w-full" src={activity.audioUrl} aria-label={t("Listening recognition audio")} />
        )}
        {activity.speechText && (
          <Button type="button" variant="secondary" size="sm" onClick={playSpeechPrompt}>
            {t("Play prompt")}
          </Button>
        )}
      </div>

      <div>
        <label htmlFor={responseId} className="mb-1.5 block text-xs font-medium text-ink-soft">
          {t("Your response")}
        </label>
        <textarea
          id={responseId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setRecordingBlob(null);
            setSaved(false);
          }}
          rows={3}
          placeholder={t("Write or say a new sentence…")}
          className="w-full resize-y rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {activity.spoken && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={audio.recording ? "primary" : "secondary"}
            onClick={audio.recording ? audio.stopRecording : () => void audio.startRecording()}
            disabled={audio.transcribing || Boolean(pendingAttempt)}
          >
            {audio.recording ? t("Stop recording") : t("Record response")}
          </Button>
          <span className="text-xs text-ink-muted">
            {t("You can also type your response.")}
          </span>
        </div>
      )}
      {audioNote && <p className="text-xs text-danger">{t(audioNote)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void submit()} disabled={!value.trim() || Boolean(pendingAttempt)}>
          {t("Continue to self-check")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (pendingAttempt) return;
            void skip();
          }}
        >
          {t("Skip for now")}
        </Button>
        {saved && <span className="text-xs text-success">{t("Response saved")}</span>}
      </div>
      {pendingAttempt && (
        <div className="space-y-2 rounded border border-accent/30 bg-accent/5 p-3 text-xs">
          <p className="font-medium text-ink">{t("Was the meaning clear?")}</p>
          <p className="text-ink-soft">{t("Your answer records transfer evidence and helps adjust future support.")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void evaluateTransfer(true)}>
              {t("Yes, it was clear")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void evaluateTransfer(false)}>
              {t("Needs more support")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
