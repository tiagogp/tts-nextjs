"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as PanelCard } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import {
  correctSentenceLocally,
  mergeEvaluatedCorrection,
  type LocalCorrectionIssue,
  type LocalCorrectionResult,
} from "@/features/learn/localCorrection";
import { evaluateCorrectionText } from "@/features/correct/api";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { useStageTimer } from "@/features/method/useStageTimer";
import type { SpeakingStage } from "@/features/method/progression";
import { countPolishFeedback, focusFeedback, prioritizeLocalFeedback } from "@/features/correct/feedbackContract";
import { OWN_SENTENCE_CARD_PREFIX, type LessonPhrase } from "@/features/learn/lessonDeck";
import type { Card, ErrorEvent, ErrorType, PhraseCandidate } from "@/lib/cards/schema";
import {
  saveAudioRecording,
  saveCorrectionDeck,
  saveGeneratedDeck,
  saveProductionAttempt,
  saveRetryOutcome,
} from "@/lib/store/repository";
import type { ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";

/**
 * The production → feedback → retry half of the guided loop. It always has a
 * local check and adds general language feedback when an existing evaluator is
 * available. Saving is gated on a real second response that applies the focused
 * feedback instead of treating a click on “save” as a retry.
 *
 * Production can be spoken or typed. Speaking it is what puts the method's `speak`
 * stage on the learner's first day — the mic runs on local Whisper, so it needs no
 * provider — while typing stays a first-class path for a denied or missing mic.
 */
export function MistakeStep({
  lessonId,
  phrase,
  noticedPhraseId,
  productionPrompt,
  productionInstruction,
  retryHint,
  speakingStage = "fixed_phrases",
  targetDurationSeconds = 15,
  voiceFirst = false,
  onSaved,
}: {
  lessonId: string;
  phrase: LessonPhrase;
  noticedPhraseId?: string;
  productionPrompt?: string;
  productionInstruction?: string;
  retryHint?: string;
  speakingStage?: SpeakingStage;
  targetDurationSeconds?: number;
  /** Lead with the mic. Typing stays available either way. */
  voiceFirst?: boolean;
  onSaved: (hadMistake: boolean) => void;
}) {
  const { t } = useT();
  const { provider, selectedModel, hasEvaluator } = useProviderSelection({
    fallbackToEvaluator: true,
  });
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<LocalCorrectionResult | null>(null);
  const [checkedSentence, setCheckedSentence] = useState("");
  const [retrySentence, setRetrySentence] = useState("");
  const [retryResult, setRetryResult] = useState<LocalCorrectionResult | null>(null);
  const [checkedRetry, setCheckedRetry] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingRetry, setCheckingRetry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const retryLoggedRef = useRef(false);
  const firstAttemptAtRef = useRef(0);
  const firstAttemptIdRef = useRef("");
  const retryAttemptIdRef = useRef("");
  const retryStartedAtRef = useRef(0);
  const productionPromptStartedAtRef = useRef(0);
  /** Whether the attempt being checked came from the mic. Decides which stage it credits. */
  const spokenRef = useRef(false);
  const retrySpokenRef = useRef(false);
  const productionBlobRef = useRef<Blob | null>(null);
  const retryBlobRef = useRef<Blob | null>(null);

  // One window per attempt. The production stage is only known on submit (spoken → speak,
  // typed → feedback), so the stage is passed at commit rather than at creation.
  const productionTimer = useStageTimer("feedback", 3);
  const retryTimer = useStageTimer("retry", 2);

  useEffect(() => {
    productionPromptStartedAtRef.current = Date.now();
  }, []);

  const note = (message: string | null) => setError(message ? t(message) : null);

  const productionAudio = useCorrectionAudio({
    onNote: note,
    onText: (updater) => {
      spokenRef.current = true;
      setSentence(updater);
    },
    onBlob: (blob) => {
      productionBlobRef.current = blob;
    },
    maxDurationMs: targetDurationSeconds * 1000,
  });

  const retryAudio = useCorrectionAudio({
    onNote: note,
    onText: (updater) => {
      retrySpokenRef.current = true;
      setRetrySentence(updater);
    },
    onBlob: (blob) => {
      retryBlobRef.current = blob;
    },
    maxDurationMs: targetDurationSeconds * 1000,
  });

  const saveRecording = async (blob: Blob | null, createdAt: number): Promise<string | undefined> => {
    if (!blob || blob.size === 0) return undefined;
    const recordingId = crypto.randomUUID();
    await saveAudioRecording({
      id: recordingId,
      blob,
      mimeType: blob.type || "audio/webm",
      sizeBytes: blob.size,
      createdAt,
    });
    return recordingId;
  };

  const evaluateAttempt = async (text: string): Promise<LocalCorrectionResult> => {
    const local = correctSentenceLocally(text, phrase.en, phrase.concept);
    if (!hasEvaluator) return local;
    try {
      const events = await evaluateCorrectionText({
        provider,
        selectedModel,
        text,
        context: "guided-lesson",
      });
      return mergeEvaluatedCorrection(text, phrase.en, phrase.concept, events);
    } catch {
      // Deep feedback is additive. A provider outage must not break the
      // provider-free first lesson or strand a learner before review.
      return local;
    }
  };

  const check = async () => {
    const trimmed = sentence.trim();
    if (!trimmed || checking) return;
    setError(null);
    setCheckedSentence(trimmed);
    setChecking(true);
    setRetrySentence("");
    setRetryResult(null);
    setCheckedRetry("");
    retryLoggedRef.current = false;
    firstAttemptAtRef.current = Date.now();
    firstAttemptIdRef.current = crypto.randomUUID();
    if (!submittedRef.current) {
      submittedRef.current = true;
      const spoken = spokenRef.current;
      void emitActivity("mistake_submitted", { source: "lesson", lessonId });
      // Spoken production is stage 5 (`speak`); typed production is credited as stage 6
      // (`feedback`), as it always was. One stage per attempt, so a single window is
      // never counted into two areas.
      void emitActivity("method_stage", {
        stage: spoken ? "speak" : "feedback",
        area: spoken ? "speaking" : "readingWriting",
        source: "lesson",
        minutes: productionTimer.commit(spoken ? "speak" : "feedback"),
        subjectId: lessonId,
      });
    }
    try {
      const evaluated = await evaluateAttempt(trimmed);
      setResult(evaluated);
      const createdAt = Date.now();
      const recordingId = await saveRecording(productionBlobRef.current, createdAt).catch(() => undefined);
      const productionAttempt: ProductionAttempt = {
        lessonId,
        source: "lesson",
        stage: "production",
        noticedPhraseId: noticedPhraseId ?? phrase.id ?? phrase.en,
        prompt: productionPrompt ?? productionInstruction ?? `Use ${phrase.en} in a sentence of your own.`,
        durationMs: Math.max(0, Date.now() - firstAttemptAtRef.current),
        preparationMs: Math.max(0, createdAt - productionPromptStartedAtRef.current),
        text: trimmed,
        spoken: spokenRef.current,
        wordCount: trimmed.split(/\s+/).length,
        finished: true,
        issueCount: evaluated.issues.length,
        scaffoldUsed: speakingStage !== "real_world_production",
        recordingId,
        createdAt,
        id: firstAttemptIdRef.current,
      };
      void saveProductionAttempt(productionAttempt).catch(() => {});
      void emitActivity("production_attempt", {
        attemptId: productionAttempt.id,
        lessonId: productionAttempt.lessonId,
        source: productionAttempt.source,
        prompt: productionAttempt.prompt,
        stage: productionAttempt.stage,
        noticedPhraseId: productionAttempt.noticedPhraseId,
        durationMs: productionAttempt.durationMs,
        text: productionAttempt.text,
        spoken: productionAttempt.spoken,
        wordCount: productionAttempt.wordCount,
        finished: productionAttempt.finished,
        issueCount: productionAttempt.issueCount,
        recordingId: productionAttempt.recordingId,
        preparationMs: productionAttempt.preparationMs,
        createdAt: productionAttempt.createdAt,
      }).catch(() => {});
    } finally {
      setChecking(false);
    }
  };

  const checkRetry = async () => {
    const trimmed = retrySentence.trim();
    if (!trimmed || checkingRetry) return;
    setCheckingRetry(true);
    setError(null);
    setCheckedRetry(trimmed);
    retryAttemptIdRef.current = crypto.randomUUID();
    retryStartedAtRef.current = Date.now();
    try {
      const next = await evaluateAttempt(trimmed);
      const createdAt = Date.now();
      const recordingId = await saveRecording(retryBlobRef.current, createdAt).catch(() => undefined);
      const retryProduction: ProductionAttempt = {
        id: retryAttemptIdRef.current,
        lessonId,
        source: "lesson",
        stage: "retry",
        noticedPhraseId: noticedPhraseId ?? phrase.id ?? phrase.en,
        retryOf: firstAttemptIdRef.current,
        prompt: productionPrompt ?? productionInstruction ?? `Use ${phrase.en} in a sentence of your own.`,
        text: trimmed,
        spoken: retrySpokenRef.current,
        wordCount: trimmed.split(/\s+/).length,
        finished: true,
        issueCount: next.issues.length,
        recordingId,
        durationMs: Math.max(0, Date.now() - retryStartedAtRef.current),
        createdAt,
      };
      void saveProductionAttempt(retryProduction).catch(() => {});
      void emitActivity("production_attempt", {
        attemptId: retryProduction.id,
        lessonId: retryProduction.lessonId,
        source: retryProduction.source,
        stage: retryProduction.stage,
        retryOf: retryProduction.retryOf,
        noticedPhraseId: retryProduction.noticedPhraseId,
        prompt: retryProduction.prompt,
        recordingId: retryProduction.recordingId,
        durationMs: retryProduction.durationMs,
        text: retryProduction.text,
        spoken: retryProduction.spoken,
        wordCount: retryProduction.wordCount,
        finished: retryProduction.finished,
        issueCount: retryProduction.issueCount,
        scaffoldUsed: retryProduction.scaffoldUsed,
        createdAt: retryProduction.createdAt,
      }).catch(() => {});
      setRetryResult(next);
      const retryOutcome: RetryOutcome = {
        id: retryAttemptIdRef.current,
        retryOf: firstAttemptIdRef.current,
        source: "lesson",
        recordingId,
        feedbackIds: result?.issues.map((_, index) => `${firstAttemptIdRef.current}:issue:${index}`),
        text: trimmed,
        spoken: retrySpokenRef.current,
        wordCount: trimmed.split(/\s+/).length,
        durationMs: Math.max(0, Date.now() - retryStartedAtRef.current),
        resolved: next.issues.length === 0,
        resolution: next.issues.length === 0 ? "completed" : undefined,
        issueCount: next.issues.length,
        scaffoldUsed: speakingStage !== "real_world_production",
        createdAt,
      };
      void saveRetryOutcome(retryOutcome).catch(() => {});
      void emitActivity("retry_outcome", {
        attemptId: retryOutcome.id,
        retryOf: retryOutcome.retryOf,
        source: retryOutcome.source,
        text: retryOutcome.text,
        spoken: retryOutcome.spoken,
        wordCount: retryOutcome.wordCount,
        durationMs: retryOutcome.durationMs,
        resolved: retryOutcome.resolved,
        resolution: retryOutcome.resolution,
        issueCount: retryOutcome.issueCount,
        recordingId: retryOutcome.recordingId,
        feedbackIds: retryOutcome.feedbackIds,
        scaffoldUsed: retryOutcome.scaffoldUsed,
        createdAt: retryOutcome.createdAt,
      }).catch(() => {});
      if (next.issues.length === 0 && !retryLoggedRef.current) {
        retryLoggedRef.current = true;
        void emitActivity("method_stage", {
          stage: "retry",
          area: retrySpokenRef.current ? "speaking" : "readingWriting",
          source: "lesson",
          minutes: retryTimer.commit(),
          subjectId: lessonId,
        });
      }
    } finally {
      setCheckingRetry(false);
    }
  };

  const changedSinceCheck = result !== null && sentence.trim() !== checkedSentence;
  const retryChangedSinceCheck = retryResult !== null && retrySentence.trim() !== checkedRetry;
  const acceptedRetry =
    retryResult && !retryChangedSinceCheck && retryResult.issues.length === 0
      ? retryResult
      : null;

  const save = async () => {
    if (!result || !acceptedRetry || saving) return;
    setSaving(true);
    setError(null);
    try {
      const hadMistake = result.issues.length > 0;
      const id = crypto.randomUUID();
      const now = Date.now();
      const card: Card = {
        id: `${OWN_SENTENCE_CARD_PREFIX}${id}`,
        front: acceptedRetry.corrected,
        back: phrase.pt,
        concept: phrase.concept,
        errorType: hadMistake ? result.issues[0].type : undefined,
        source: { kind: hadMistake ? "error" : "phrase", id },
        createdAt: now,
      };
      if (hadMistake) {
        const event: ErrorEvent = {
          id,
          original: checkedSentence,
          corrected: acceptedRetry.corrected,
          errorTypes: [...new Set<ErrorType>(result.issues.map((issue) => issue.type))],
          sourceLang: "pt",
          targetLang: "en",
          rationale: result.issues.map((issue) => t(issue.note)).join(" "),
          context: "lesson",
          // Keep the error before the successful retry so the method planner does
          // not incorrectly ask for another retry after this loop is complete.
          createdAt: firstAttemptAtRef.current || now,
        };
        await saveCorrectionDeck([card], [event]);
      } else {
        const candidate: PhraseCandidate = {
          id,
          sourceId: `lesson-${lessonId}-own`,
          text: acceptedRetry.corrected,
          translation: phrase.pt,
          status: "accepted",
          createdAt: now,
        };
        await saveGeneratedDeck([card], [candidate]);
      }
      void emitActivity("correction_generated", { cardsCreated: 1, source: "lesson" });
      void emitActivity("cards_created", { count: 1, source: "correct" });
      onSaved(hadMistake);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Could not save your sentence."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard className="space-y-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("5 · Speak")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
          {voiceFirst ? t("Say one sentence in English") : t("Write one sentence in English")}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">{t(productionPrompt ?? productionInstruction ?? "Use the lesson language in your own idea.")}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {t("Speaking stage: {stage} · aim for {seconds} seconds", {
            stage: speakingStage.replaceAll("_", " "),
            seconds: targetDurationSeconds,
          })}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {t('Use "{phrase}" or its reusable pattern, and add one detail of your own.', {
            phrase: phrase.en,
          })}
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={sentence}
          onChange={(event) => {
            spokenRef.current = false;
            productionBlobRef.current = null;
            setSentence(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
                void check();
            }
          }}
          rows={2}
          placeholder={voiceFirst ? t("Speak, or write your sentence here…") : t("Write your sentence here…")}
          className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          disabled={saving || checking}
        />
        <div className="flex flex-wrap items-center gap-2">
          <VoiceButton
            audio={productionAudio}
            disabled={saving || checking}
            label={t("Say your sentence")}
            // Speaking is the method's stage 5; typing is the fallback, not the default.
            variant={voiceFirst ? "primary" : "secondary"}
          />
          <Button
            variant={voiceFirst ? "secondary" : "primary"}
            onClick={() => void check()}
            disabled={!sentence.trim() || saving || checking}
          >
            {checking
              ? t("Checking your sentence…")
              : result && !changedSinceCheck
                ? t("Check again")
                : t("Check my sentence")}
          </Button>
        </div>
      </div>

      {result && !changedSinceCheck && (
        <div className="space-y-4">
          <FeedbackPanel result={result} original={checkedSentence} />

          <div className="space-y-3 rounded border border-accent/30 bg-accent/5 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.5px] text-accent">
                {t("7 · Retry")}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{t("Write the sentence again")}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {retryHint
                  ? t(retryHint)
                  : result.issues.length > 0
                    ? t("Use the feedback above in a new attempt. Saving unlocks only after the second attempt is clear.")
                    : t("Your first answer was clear. Produce it once more from memory before saving it.")}
              </p>
            </div>
            <textarea
              value={retrySentence}
              onChange={(event) => {
                retrySpokenRef.current = false;
                retryBlobRef.current = null;
                setRetrySentence(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void checkRetry();
                }
              }}
              rows={2}
              placeholder={t("Write your second attempt here…")}
              aria-label={t("Second attempt")}
              className="w-full resize-none rounded border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              disabled={saving || checkingRetry}
            />
            <div className="flex flex-wrap items-center gap-2">
              <VoiceButton
                audio={retryAudio}
                disabled={saving || checkingRetry}
                label={t("Say it again")}
              />
              <Button
                variant="secondary"
                onClick={() => void checkRetry()}
                disabled={!retrySentence.trim() || saving || checkingRetry}
              >
                {checkingRetry
                  ? t("Checking second attempt…")
                  : retryResult && !retryChangedSinceCheck
                    ? t("Check second attempt again")
                    : t("Check second attempt")}
              </Button>
            </div>

            {retryResult && !retryChangedSinceCheck && retryResult.issues.length > 0 && (
              <FeedbackIssues issues={retryResult.issues} />
            )}
            {acceptedRetry && (
              <Notice tone="success" className="space-y-3">
                <p>{t("Your second attempt applies the feedback and is ready for review.")}</p>
                <Button variant="primary" onClick={() => void save()} disabled={saving}>
                  {saving
                    ? t("Saving…")
                    : result.issues.length > 0
                      ? t("Save the improved sentence for tomorrow")
                      : t("Save your sentence for tomorrow")}
                </Button>
              </Notice>
            )}
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </PanelCard>
  );
}

/**
 * The mic for one attempt. Transcription runs on local Whisper, so this works with no
 * provider configured — but it is always additive: a refused or missing mic leaves the
 * textarea and the save path untouched.
 */
function VoiceButton({
  audio,
  disabled,
  label,
  variant = "secondary",
}: {
  audio: ReturnType<typeof useCorrectionAudio>;
  disabled: boolean;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const { t } = useT();
  const { recording, transcribing, startRecording, stopRecording, recordingElapsedMs, maxDurationMs } = audio;
  const elapsedSeconds = Math.floor(recordingElapsedMs / 1000);
  const limitSeconds = maxDurationMs ? Math.ceil(maxDurationMs / 1000) : undefined;

  return (
    <Button
      variant={variant}
      onClick={() => (recording ? stopRecording() : void startRecording())}
      disabled={disabled || transcribing}
      aria-pressed={recording}
    >
      {transcribing
        ? t("Transcribing…")
        : recording
          ? t("Stop recording · {elapsed}/{limit}s", { elapsed: elapsedSeconds, limit: limitSeconds ?? elapsedSeconds })
          : label}
    </Button>
  );
}

function FeedbackPanel({
  result,
  original,
}: {
  result: LocalCorrectionResult;
  original: string;
}) {
  const { t } = useT();
  if (result.issues.length === 0) {
    return <Notice tone="success">{t("Your message is clear and uses the lesson language.")}</Notice>;
  }

  return (
    <div className="space-y-3 rounded border border-line bg-surface p-3">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("6 · Feedback")}</p>
        <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">{t("You wrote")}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{original}</p>
      </div>
      {result.corrected !== original && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.5px] text-accent">{t("Corrected version")}</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{result.corrected}</p>
        </div>
      )}
      <FeedbackIssues issues={result.issues} />
    </div>
  );
}

function FeedbackIssues({ issues }: { issues: LocalCorrectionIssue[] }) {
  const { t } = useT();
  const prioritized = prioritizeLocalFeedback(issues);
  const focused = focusFeedback(prioritized);
  const polishCount = countPolishFeedback(prioritized);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink">
        {t("Focus first: {category}", { category: t(focused[0].category) })}
      </p>
      <ul className="space-y-2">
        {focused.map((issue) => (
          <li key={issue.id} className="flex items-start gap-2 text-xs text-ink-muted">
            <span className="mt-0.5 rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px] text-ink-soft">
              {t(issue.category)}
            </span>
            <span className="pt-0.5">{t(issue.evidence)}</span>
            <span className="pt-0.5 text-ink-muted">· {t(issue.suggestedRetrySupport)}</span>
          </li>
        ))}
      </ul>
      {polishCount > 0 && polishCount > focused.filter((issue) => issue.priority === "polish").length && (
        <p className="text-[11px] text-ink-muted">
          {t("{count} minor polish issue(s) are available, but do not block your retry.", { count: polishCount })}
        </p>
      )}
    </div>
  );
}
