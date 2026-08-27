"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getListeningAttempts, saveListeningAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import type { ListeningAttempt } from "@/lib/performance/types";
import { probeAttemptKey, remainingProbes, selectColdProbe, PROBE_SOURCE_ID, type ColdProbe } from "../coldProbeBank";

/**
 * The cold-listening probe.
 *
 * Measurement, like `RetentionProofCard` — and held to the same rules. One play, no
 * transcript, no replay, no slow-down, no second chance. Every one of those affordances
 * would make the exercise kinder and the number meaningless: `coldListening()` only counts
 * an attempt where the speaker was unfamiliar, the clip was heard once at full speed, and
 * no subtitle was shown, so anything this component offers beyond that silently removes
 * the attempt from the metric it exists to feed.
 *
 * It renders nothing at all when no probe is due, which — with the bank shipped empty — is
 * the normal state today.
 */
export function ColdListeningProbe({ onCompleted }: { onCompleted?: () => void } = {}) {
  const { t } = useT();
  const [probe, setProbe] = useState<ColdProbe | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<{ mainIdeaCorrect: boolean; detailCorrect: number; detailTotal: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef(0);

  const load = useCallback(async () => {
    const attempts = await getListeningAttempts();
    const next = selectColdProbe({ attempts, now: Date.now() });
    setProbe(next);
    setRemaining(remainingProbes(attempts));
    setAnswers(next ? next.questions.map(() => null) : []);
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run().catch(() => undefined);
  }, [load]);

  const play = () => {
    const element = audioRef.current;
    if (!element || played || playing) return;
    setPlaying(true);
    element.playbackRate = 1;
    element.currentTime = 0;
    void element.play().catch(() => {
      // A blocked autoplay is not a heard clip: leave the single play unspent.
      setPlaying(false);
    });
  };

  const submit = async () => {
    if (!probe || saving || result || answers.some((answer) => answer === null)) return;
    setSaving(true);
    try {
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
        // Tagged, not filed under a lesson: a probe belongs to no lesson and must never be
        // pulled into one.
        lessonId: probeAttemptKey(probe),
        sourceId: PROBE_SOURCE_ID,
        questions: probe.questions.map(({ kind, prompt }) => ({ kind, prompt })),
        answers: [...answers],
        questionCount: probe.questions.length,
        answeredCount: answers.filter((answer) => answer !== null).length,
        correctCount: scored.filter(Boolean).length,
        mainIdeaCorrect: mainIdeaIndex >= 0 ? scored[mainIdeaIndex] : false,
        detailCorrect,
        detailTotal,
        // One play, at full speed, no transcript, no scaffold. These are the conditions
        // `coldListening()` requires; the component enforces them rather than reporting them.
        playCounts: [1],
        transcriptVisible: false,
        playbackRate: 1,
        playbackRates: [1],
        speakerIds: [probe.speakerId],
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
    } finally {
      setSaving(false);
    }
  };

  if (!probe) return null;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
          {t("Cold listening check")}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {t("{count} clips left", { count: remaining })}
        </span>
      </div>

      <p className="text-xs text-ink-muted">
        {t("A voice you have not heard before, played once. No transcript, no replay — this measures listening, it does not train it.")}
      </p>

      <p className="text-sm text-ink-soft">
        {t("Topic: {topic} · accent: {accent}", { topic: probe.topic, accent: probe.accent })}
      </p>

      {/* No caption track on purpose: a transcript is exactly what this check withholds. */}
      <audio
        ref={audioRef}
        src={probe.clip}
        preload="auto"
        onEnded={() => { setPlayed(true); setPlaying(false); }}
        onError={() => setPlaying(false)}
      />

      {!played ? (
        <Button variant="primary" size="lg" className="w-full py-2.5" disabled={playing} onClick={play}>
          {playing ? t("Listening…") : t("Play once")}
        </Button>
      ) : result ? (
        <div className="space-y-3">
          <p className={result.mainIdeaCorrect ? "text-sm text-success" : "text-sm text-ink-soft"}>
            {result.mainIdeaCorrect
              ? t("Main idea followed on one listen.")
              : t("Main idea missed. Recorded — nothing about your schedule changes.")}
          </p>
          {result.detailTotal > 0 && (
            <p className="text-xs text-ink-muted">
              {t("{correct} of {total} details", { correct: result.detailCorrect, total: result.detailTotal })}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={() => { onCompleted?.(); void load(); }}>{t("Done")}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {probe.questions.map((question, index) => (
            <fieldset key={question.prompt} className="space-y-2">
              <legend className="text-sm text-ink">{question.prompt}</legend>
              <div className="flex flex-col gap-1.5">
                {question.options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name={`${probe.id}-${index}`}
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
            disabled={saving || answers.some((answer) => answer === null)}
            onClick={() => void submit()}
          >
            {t("Check")}
          </Button>
        </div>
      )}
    </Card>
  );
}
