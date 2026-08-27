"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getListeningAttempts, saveListeningAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import type { ListeningAttempt } from "@/lib/performance/types";
import type { DiscoverResult } from "@/features/discover/types";
import type { JudgeStamp } from "@/lib/evaluation/judge";
import type { ColdProbeQuestion } from "../coldProbeBank";
import { PROBE_SOURCE_ID } from "../coldProbeBank";
import { probeClipUrl, probeEligibility, type ProbeWindow } from "../importedProbe";
import type { GeneratedProbe } from "../probeContract";

const DAY_MS = 86_400_000;

/**
 * A cold-listening check on the learner's own import, offered before the transcript.
 *
 * Order is the whole design. Once the transcript is on screen the voice is no longer
 * unfamiliar and the words are no longer unheard, so the only honest moment to measure
 * comprehension of unfamiliar speech is right now, before the source becomes study
 * material. Declining is free and silent; there is nothing to record about a probe that
 * was not taken.
 *
 * Everything else follows the rules the bundled bank follows — one play, full speed, no
 * transcript, no replay — because those are the conditions `coldListening()` counts.
 */
export function ImportedListeningProbe({
  result,
  onDone,
}: {
  result: DiscoverResult;
  onDone?: () => void;
}) {
  const { t } = useT();
  const { provider, selectedModel, hasEvaluator } = useProviderSelection({ fallbackToEvaluator: true });
  const [window_, setWindow] = useState<ProbeWindow | null>(null);
  const [offered, setOffered] = useState(false);
  const [probe, setProbe] = useState<GeneratedProbe | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [result_, setResult] = useState<{ mainIdeaCorrect: boolean; detailCorrect: number; detailTotal: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef(0);

  const attemptKey = `probe:source:${result.sourceId}`;

  const check = useCallback(async () => {
    const attempts = await getListeningAttempts();
    // Heard already means: probed before, or listened to as part of this source's study.
    // A probe taken in the last day also counts: a learner importing five things in an
    // afternoon should not meet a checkpoint five times, and yesterday's number is still
    // a number. The unmeasured voice is a smaller loss than a probe nobody takes.
    const recentProbe = attempts.some(
      (attempt) => attempt.sourceId === PROBE_SOURCE_ID && Date.now() - attempt.completedAt < DAY_MS,
    );
    const alreadyHeard = recentProbe || attempts.some(
      (attempt) => attempt.lessonId === attemptKey || attempt.sourceId === result.sourceId,
    );
    const eligibility = probeEligibility({
      hasAudio: result.hasAudio,
      segments: result.segments,
      hasProvider: hasEvaluator,
      alreadyHeard,
    });
    setWindow(eligibility.eligible ? eligibility.window ?? null : null);
    startedAtRef.current = Date.now();
  }, [attemptKey, hasEvaluator, result.hasAudio, result.segments, result.sourceId]);

  useEffect(() => {
    const run = async () => {
      await check();
    };
    void run().catch(() => undefined);
  }, [check]);

  const start = async () => {
    if (!window_ || loading) return;
    setOffered(true);
    setLoading(true);
    setFailed(false);
    try {
      const { targetLang } = getLearnerLangs();
      const response = await fetch("/api/listening/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ollamaModel: selectedModel || undefined,
          targetLang,
          text: window_.text,
          startMs: window_.startMs,
          endMs: window_.endMs,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<GeneratedProbe>;
      if (!response.ok || !data.questions?.length) {
        setFailed(true);
        return;
      }
      setProbe({ questions: data.questions, judge: data.judge as JudgeStamp });
      setAnswers(data.questions.map(() => null));
      startedAtRef.current = Date.now();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const play = () => {
    const element = audioRef.current;
    if (!element || played || playing) return;
    setPlaying(true);
    element.playbackRate = 1;
    element.currentTime = 0;
    void element.play().catch(() => setPlaying(false));
  };

  const submit = async () => {
    if (!probe || !window_ || result_ || answers.some((answer) => answer === null)) return;
    const now = Date.now();
    const scored = probe.questions.map((question, index) => answers[index] === question.answer);
    const mainIdeaIndex = probe.questions.findIndex((question) => question.kind === "mainIdea");
    const detailTotal = probe.questions.filter((question) => question.kind === "detail").length;
    const detailCorrect = probe.questions.reduce(
      (total, question, index) => total + (question.kind === "detail" && scored[index] ? 1 : 0),
      0,
    );
    const attempt: ListeningAttempt = {
      id: crypto.randomUUID(),
      lessonId: attemptKey,
      // Tagged as a probe, not as this source's listening: the source's own study happens
      // afterwards and must not be able to claim this attempt.
      sourceId: PROBE_SOURCE_ID,
      questions: probe.questions.map(({ kind, prompt }) => ({ kind, prompt })),
      answers: [...answers],
      questionCount: probe.questions.length,
      answeredCount: answers.filter((answer) => answer !== null).length,
      correctCount: scored.filter(Boolean).length,
      mainIdeaCorrect: mainIdeaIndex >= 0 ? scored[mainIdeaIndex] : false,
      detailCorrect,
      detailTotal,
      playCounts: [1],
      transcriptVisible: false,
      playbackRate: 1,
      playbackRates: [1],
      // A real speaker the learner has never heard — which is the whole point, and is true
      // here in a way it can never be true of a bundled synthetic clip.
      speakerIds: [`source:${result.sourceId}`],
      speakerFamiliarity: "unfamiliar",
      subtitleUsed: false,
      scaffoldUsed: false,
      finished: true,
      durationMs: startedAtRef.current ? now - startedAtRef.current : undefined,
      startedAt: startedAtRef.current || now,
      completedAt: now,
    };
    await saveListeningAttempt(attempt);
    await emitActivity("listening_attempt", {
      attemptId: attempt.id,
      lessonId: attempt.lessonId,
      sourceId: attempt.sourceId,
      questions: attempt.questions,
      answers: attempt.answers,
      questionCount: attempt.questionCount,
      answeredCount: attempt.answeredCount,
      correctCount: attempt.correctCount,
      mainIdeaCorrect: attempt.mainIdeaCorrect,
      detailCorrect: attempt.detailCorrect,
      detailTotal: attempt.detailTotal,
      playCounts: attempt.playCounts,
      transcriptVisible: false,
      playbackRate: 1,
      playbackRates: attempt.playbackRates,
      speakerIds: attempt.speakerIds,
      speakerFamiliarity: attempt.speakerFamiliarity,
      subtitleUsed: false,
      scaffoldUsed: false,
      finished: true,
      durationMs: attempt.durationMs,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    }).catch(() => undefined);
    setResult({ mainIdeaCorrect: attempt.mainIdeaCorrect, detailCorrect, detailTotal });
  };

  if (!window_) return null;
  const clip = probeClipUrl(result.sourceId, window_);
  if (!clip) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
          {t("Cold listening check")}
        </span>
        <span className="text-xs text-ink-muted">
          {t("{seconds}s of what you just imported", { seconds: Math.round((window_.endMs - window_.startMs) / 1000) })}
        </span>
      </div>

      {!offered ? (
        <>
          <p className="text-sm text-ink-soft">
            {t("Before you read the transcript: can you follow this speaker on one listen? This is the only moment the voice is still new to you.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => void start()}>{t("Take the check")}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setWindow(null); onDone?.(); }}>
              {t("Skip to the transcript")}
            </Button>
          </div>
        </>
      ) : loading ? (
        <p className="text-sm text-ink-muted">{t("Writing the questions…")}</p>
      ) : failed ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">{t("Could not build a check for this audio. Nothing was recorded.")}</p>
          <Button variant="ghost" size="sm" onClick={() => { setWindow(null); onDone?.(); }}>{t("Continue")}</Button>
        </div>
      ) : probe ? (
        <div className="space-y-3">
          {/* No caption track on purpose: a transcript is exactly what this check withholds. */}
          <audio
            ref={audioRef}
            src={clip}
            preload="auto"
            onEnded={() => { setPlayed(true); setPlaying(false); }}
            onError={() => setPlaying(false)}
          />
          {!played ? (
            <>
              <p className="text-xs text-ink-muted">
                {t("One play, full speed, no transcript — this measures listening, it does not train it.")}
              </p>
              <Button variant="primary" size="lg" className="w-full py-2.5" disabled={playing} onClick={play}>
                {playing ? t("Listening…") : t("Play once")}
              </Button>
            </>
          ) : result_ ? (
            <div className="space-y-2">
              <p className={result_.mainIdeaCorrect ? "text-sm text-success" : "text-sm text-ink-soft"}>
                {result_.mainIdeaCorrect
                  ? t("Main idea followed on one listen.")
                  : t("Main idea missed. Recorded — nothing about your schedule changes.")}
              </p>
              {result_.detailTotal > 0 && (
                <p className="text-xs text-ink-muted">
                  {t("{correct} of {total} details", { correct: result_.detailCorrect, total: result_.detailTotal })}
                </p>
              )}
              <Button variant="secondary" size="sm" onClick={() => { setWindow(null); onDone?.(); }}>
                {t("Continue to the transcript")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {probe.questions.map((question: ColdProbeQuestion, index) => (
                <fieldset key={question.prompt} className="space-y-1.5">
                  <legend className="text-sm text-ink">{question.prompt}</legend>
                  <div className="flex flex-col gap-1">
                    {question.options.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-ink-soft">
                        <input
                          type="radio"
                          name={`${result.sourceId}-${index}`}
                          checked={answers[index] === option}
                          onChange={() => setAnswers((current) => current.map((value, position) => (position === index ? option : value)))}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Button
                variant="primary"
                size="lg"
                className="w-full py-2.5"
                disabled={answers.some((answer) => answer === null)}
                onClick={() => void submit()}
              >
                {t("Check")}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
