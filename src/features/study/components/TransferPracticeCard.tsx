"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCards, getConversations, getErrorEvents, getMethodProgression, saveAudioRecording, saveErrorEvents, saveProductionAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { buildTransferActivities, type TransferActivity } from "../transfer";
import { useT } from "@/i18n/I18nProvider";
import { interpolate } from "@/i18n/translate";
import { READING_WRITING_STAGE_LABEL, supportForProgression, type MethodProgressionState } from "@/features/method/progression";
import type { ProductionAttempt } from "@/lib/performance/types";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { evaluateGuidedLessonResponse } from "@/features/correct/api";
import { correctSentenceLocally } from "@/features/learn/localCorrection";
import { evaluateRecall } from "../responseEvaluation";
import { checkOpenResponse } from "../openResponse";
import { LOCAL_JUDGE, modelJudge, type JudgeStamp } from "@/lib/evaluation/judge";
import { verifyTransfer } from "../transferVerification";
import type { ErrorEvent } from "@/lib/cards/schema";

/**
 * A bounded transfer check. Fixed-pattern prompts have a conservative local evaluator;
 * a configured evaluator additionally checks open task completion and general language.
 */
export function TransferPracticeCard({ onCompleted }: { onCompleted?: () => void } = {}) {
  const { t } = useT();
  const responseId = useId();
  const [activities, setActivities] = useState<TransferActivity[]>([]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState<ProductionAttempt | null>(null);
  const [evaluation, setEvaluation] = useState<{
    clear: boolean;
    evaluated: boolean;
    /** The device checked the form and found nothing, without judging the answer itself. */
    formOnly?: boolean;
    notes: string[];
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const promptStartedAtRef = useRef(0);
  const [progression, setProgression] = useState<MethodProgressionState | undefined>();
  const { provider, selectedModel, hasEvaluator } = useProviderSelection({ fallbackToEvaluator: true });
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
    setEvaluation(null);
    promptStartedAtRef.current = Date.now();
  };

  const evaluate = async (activity: TransferActivity, text: string): Promise<{
    clear: boolean;
    evaluated: boolean;
    notes: string[];
    errors: ErrorEvent[];
    /**
     * Undefined when nothing judged the task. An unjudged task must not be saved as a
     * failed one — the same rule the D7/D30/D60 windows follow.
     */
    taskCompleted: boolean | undefined;
    /** Notes that are actual findings, not the standing caveat about what was checked. */
    issueCount?: number;
    /** The form was checked and came back clean; the task itself went unjudged. */
    formOnly?: boolean;
    /** Who reached this verdict. Absent when nothing judged the attempt. */
    judge?: JudgeStamp;
    /** Whether the app could reach a transfer verdict at all. Undefined off the transfer path. */
    transferVerified?: boolean;
    /** Whether the pattern actually reached new content. Never true when unverified. */
    transferred?: boolean;
  }> => {
    const task = `${interpolate(activity.prompt, activity.promptVars)} Use the target pattern: ${activity.expected ?? ""}`;
    if (hasEvaluator) {
      try {
        const result = await evaluateGuidedLessonResponse({
          provider,
          selectedModel,
          text,
          context: `transfer:${activity.kind}`,
          task,
        });
        const taskMet = result.task?.status === "met";
        // Even with a provider, "did they leave the source sentence behind?" is checked
        // locally: it is a deterministic property of the text, and asking a model to
        // confirm the app's own claim is how the claim stops being checked.
        const contextCheck = activity.newContextRequested
          ? verifyTransfer({
              response: text,
              frame: activity.patternFrame,
              sourceExample: activity.sourceExample ?? activity.expected,
            })
          : undefined;
        return {
          clear: result.events.length === 0 && taskMet && (contextCheck?.transferred ?? true),
          transferVerified: contextCheck?.verified,
          transferred: contextCheck?.transferred,
          evaluated: true,
          notes: [
            ...result.events.map((event) => event.rationale || "Revise this language point before trying again."),
            ...(taskMet ? [] : [result.task?.feedback || "Complete the communicative task more directly."]),
          ],
          errors: result.events,
          taskCompleted: taskMet,
          // The model judged the task; `verifyTransfer` judged the transfer, locally, as
          // it always does. The stamp records the weaker of the two, because that is the
          // one a reader would otherwise mistake for a deterministic result.
          judge: result.judge ?? modelJudge({ provider }),
        };
      } catch {
        // The deterministic path below keeps fixed-pattern transfer available offline.
      }
    }
    if (!activity.expected) {
      // Open task, no provider. The device cannot judge whether the answer does what the
      // task asked, but it can still name a transfer error, a non-answer, or the prompt
      // handed back — and it must not record an unjudged task as a failed one.
      const open = checkOpenResponse({ response: text, prompt: interpolate(activity.prompt, activity.promptVars) });
      const noteFor: Record<typeof open.verdict, string[]> = {
        empty: ["Write something before checking."],
        too_short: ["Answer the situation in a full sentence."],
        echoed_prompt: ["This repeats the task back. Say what you would actually say in that situation."],
        form_error: open.formIssues.map((issue) => issue.note),
        form_clear: [],
      };
      const findings = noteFor[open.verdict];
      return {
        // Never `clear`: nothing here checked the answer against the task.
        clear: false,
        // A named error, a non-answer or an echo is an observation. Everything else is not.
        evaluated: open.taskCompleted === false,
        notes: [...findings, "Checked for known errors only — connect an evaluator to have the answer itself judged."],
        issueCount: findings.length,
        formOnly: open.verdict === "form_clear",
        judge: open.taskCompleted === false ? LOCAL_JUDGE : undefined,
        errors: [],
        taskCompleted: open.taskCompleted,
      };
    }
    if (activity.kind === "reading_to_meaning" || activity.kind === "listening_recognition") {
      const recall = evaluateRecall(activity.expected, text);
      return {
        clear: recall.quality === "correct",
        evaluated: true,
        notes: recall.quality === "correct" ? [] : ["Restate the meaning more precisely, then try again."],
        errors: [],
        taskCompleted: recall.quality === "correct",
        judge: LOCAL_JUDGE,
      };
    }
    const local = correctSentenceLocally(text, activity.expected, activity.concept);
    const blocking = local.issues.filter((issue) => issue.priority !== "polish");
    if (!activity.newContextRequested) {
      return {
        clear: local.usedPhrase && blocking.length === 0,
        evaluated: true,
        notes: blocking.map((issue) => issue.note).concat(local.usedPhrase ? [] : ["Use the target pattern without copying the model answer."]),
        errors: [],
        taskCompleted: local.usedPhrase,
        judge: LOCAL_JUDGE,
      };
    }
    // The prompt asked for a *new* situation. Grading it with `usedPhrase` rewarded the
    // learner for rebuilding the sentence they memorized — the prompt and the check were
    // asking for opposite things. Verify the three conditions instead.
    const check = verifyTransfer({
      response: text,
      frame: activity.patternFrame,
      sourceExample: activity.sourceExample ?? activity.expected,
    });
    const noteFor = {
      transferred: [],
      reused: ["This is close to the sentence you studied. Say the same kind of thing about something else."],
      off_pattern: ["Good English, but use the structure this card practises."],
      form_error: check.formIssues.map((issue) => issue.note),
      unverifiable: [],
    }[check.verdict];
    return {
      clear: check.transferred && blocking.length === 0,
      // An item with no authored pattern cannot be judged offline. Saying so is the point:
      // an unverifiable attempt must not be recorded as a transfer.
      evaluated: check.verified,
      notes: [...noteFor, ...blocking.map((issue) => issue.note)],
      errors: [],
      taskCompleted: check.transferred,
      transferVerified: check.verified,
      transferred: check.transferred,
      // `unverifiable` reached no verdict, so it gets no stamp.
      judge: check.verified ? LOCAL_JUDGE : undefined,
    };
  };

  const submit = async () => {
    const text = value.trim();
    if (!activity || !text || pendingAttempt || checking) return;
    setChecking(true);
    try {
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
    const result = await evaluate(activity, text);
    if (result.errors.length) await saveErrorEvents(result.errors);
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      source: "study" as const,
      stage: "production" as const,
      prompt: interpolate(activity.prompt, activity.promptVars),
      context: activity.kind,
      transferKind: activity.kind,
      transferSourceId: activity.sourceId,
      recordingId,
      preparationMs: Math.max(0, now - (promptStartedAtRef.current || now)),
      text,
      spoken: Boolean(recordingBlob),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      finished: true,
      issueCount: result.issueCount ?? result.notes.length,
      evaluated: result.evaluated,
      // "needs_support" is a verdict. An attempt nothing could judge gets none, the same
      // way an unmeasured metric is null rather than zero.
      transferOutcome: result.evaluated ? (result.clear ? "clear" : "needs_support") : undefined,
      avoidedErrorIds: result.clear ? activity.errorIds : undefined,
      errorTypesFound: [...new Set(result.errors.flatMap((error) => error.errorTypes))],
      taskCompleted: result.taskCompleted,
      judge: result.judge,
      targetPatternId: activity.patternId,
      durationMs: audio.recordingElapsedMs || undefined,
      fluency: recordingBlob && audio.recordingElapsedMs > 0
        ? { wordsPerMinute: Math.round((text.split(/\s+/).filter(Boolean).length / (audio.recordingElapsedMs / 60000)) * 10) / 10 }
        : undefined,
      // Observed, not requested. `newContext` now means "the learner actually carried the
      // pattern into new content", and is left undefined when the app could not tell.
      newContext: result.transferVerified ? result.transferred : undefined,
      transferVerified: result.transferVerified,
      listeningRecognition: activity.kind === "listening_recognition",
      retold: activity.kind === "topic_retell" || activity.kind === "error_reconstruction",
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
      transferVerified: attempt.transferVerified,
      listeningRecognition: attempt.listeningRecognition,
      transferOutcome: attempt.transferOutcome,
      avoidedErrorIds: attempt.avoidedErrorIds,
      durationMs: attempt.durationMs,
      fluency: attempt.fluency,
      createdAt: attempt.createdAt,
    });
    setPendingAttempt(attempt);
    setEvaluation({ clear: result.clear, evaluated: result.evaluated, formOnly: result.formOnly, notes: result.notes });
    setSaved(true);
    setRecordingBlob(null);
    } finally {
      setChecking(false);
    }
  };

  const skip = async () => {
    if (!activity || pendingAttempt) return;
    const createdAt = Date.now();
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      source: "study",
      stage: "production",
      prompt: interpolate(activity.prompt, activity.promptVars),
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
      // A skipped prompt produced no text, so there is nothing to verify. Both fields stay
      // undefined rather than recording a transfer that was never attempted.
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

  if (!activity) return null;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Transfer practice")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t("Use a saved idea in a new context")}</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
            {t("Write or speak a short response. PhraseLoop checks it before the review is complete.")}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-ink-muted">
          {t("Support · {stage}", { stage: t(READING_WRITING_STAGE_LABEL[support.readingWriting.stage]) })}
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
        <p className="text-sm leading-relaxed text-ink">{t(activity.prompt, activity.promptVars)}</p>
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
        <Button variant="primary" onClick={() => void submit()} disabled={!value.trim() || Boolean(pendingAttempt) || checking}>
          {checking ? t("Checking…") : t("Check response")}
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
          <p className="font-medium text-ink">
            {evaluation?.clear
              ? t("Transfer confirmed")
              : evaluation?.evaluated
                ? t("Try once more")
                : evaluation?.formOnly
                  ? t("No known error found")
                  : t("Evaluation unavailable")}
          </p>
          {evaluation?.notes.map((note) => <p key={note} className="text-ink-soft">{t(note)}</p>)}
          <div className="flex flex-wrap gap-2">
            {evaluation?.clear ? (
              <Button variant="secondary" size="sm" onClick={() => { onCompleted?.(); advancePrompt(); }}>
                {t("Finish transfer")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => {
                setPendingAttempt(null);
                setEvaluation(null);
                setSaved(false);
                setValue("");
                promptStartedAtRef.current = Date.now();
              }}>
                {t("Retry without seeing the answer")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
