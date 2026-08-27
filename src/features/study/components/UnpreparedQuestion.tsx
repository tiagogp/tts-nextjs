"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { getProductionAttempts, saveAudioRecording, saveProductionAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import type { EnglishLevel } from "@/features/discover/types";
import type { ProductionAttempt } from "@/lib/performance/types";
import {
  PREPARATION_SECONDS,
  RESPONSE_SECONDS,
  dailySeed,
  selectTimedPrompts,
  type TimedPrompt,
} from "../timedPrompts";

type Phase = "ready" | "preparing" | "speaking" | "done";

/**
 * Production under load: a question the learner did not choose, seconds to think, and the
 * question hidden while they answer.
 *
 * The existing timed monologue leaves the prompt on screen and lets the learner pick the
 * topic, which measures fluency on prepared ground. Hiding the question is the entire
 * difference — with it visible the exercise becomes reading aloud with a microphone.
 *
 * `scaffoldUsed` is false here, so these attempts count toward active vocabulary and
 * production latency. That is correct: nothing supported the learner. It also means a
 * re-shown question would inflate those numbers, which is why `selectTimedPrompts` avoids
 * repeats until the bank is exhausted.
 */
export function UnpreparedQuestion({
  level,
  onCompleted,
}: {
  level: EnglishLevel;
  onCompleted?: () => void;
}) {
  const { t } = useT();
  const [prompt, setPrompt] = useState<TimedPrompt | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [remaining, setRemaining] = useState(PREPARATION_SECONDS);
  const [text, setText] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(0);
  const audio = useCorrectionAudio({
    onNote: setNote,
    onText: (updater) => setText(updater),
    onBlob: setBlob,
    maxDurationMs: RESPONSE_SECONDS * 1000,
  });

  const load = useCallback(async () => {
    const attempts = await getProductionAttempts();
    const answered = attempts
      .filter((attempt) => attempt.context?.startsWith("unprepared:"))
      .map((attempt) => attempt.context!.slice("unprepared:".length));
    const [chosen] = selectTimedPrompts({ level, answered, seed: dailySeed() });
    setPrompt(chosen ?? null);
  }, [level]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run().catch(() => undefined);
  }, [load]);

  // One timer drives both phases: think, then speak. The countdown is derived from a
  // deadline rather than decremented, so a backgrounded tab resumes at the right second
  // instead of pausing the clock the learner is being measured against.
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);
  useEffect(() => {
    if (phase !== "preparing" && phase !== "speaking") return;
    const total = phase === "preparing" ? PREPARATION_SECONDS : RESPONSE_SECONDS;
    const endsAt = Date.now() + total * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) return;
      clearInterval(timer);
      if (phase === "preparing") {
        startedAt.current = Date.now();
        void audioRef.current.startRecording();
        setRemaining(RESPONSE_SECONDS);
        setPhase("speaking");
      } else {
        audioRef.current.stopRecording();
        setPhase("done");
      }
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  const save = async () => {
    const answer = text.trim();
    if (!prompt || !answer) return;
    const now = Date.now();
    const recordingId = blob ? crypto.randomUUID() : undefined;
    if (recordingId && blob) {
      await saveAudioRecording({
        id: recordingId, blob, mimeType: blob.type || "audio/webm",
        sizeBytes: blob.size, createdAt: now,
      }).catch(() => undefined);
    }
    const attempt: ProductionAttempt = {
      id: crypto.randomUUID(),
      source: "study",
      stage: "production",
      context: `unprepared:${prompt.id}`,
      prompt: t(prompt.question),
      recordingId,
      text: answer,
      spoken: Boolean(blob),
      wordCount: answer.split(/\s+/).filter(Boolean).length,
      finished: true,
      issueCount: 0,
      evaluated: false,
      // Nothing supported the learner here, so this counts toward the unaided measures.
      scaffoldUsed: false,
      // Preparation is fixed by the clock, not chosen — recording it would be recording a
      // constant, so the fluency signal is duration and words per minute instead.
      durationMs: startedAt.current ? now - startedAt.current : undefined,
      fluency: startedAt.current && now > startedAt.current
        ? {
            wordsPerMinute: Math.round(
              (answer.split(/\s+/).filter(Boolean).length / ((now - startedAt.current) / 60000)) * 10,
            ) / 10,
          }
        : undefined,
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
      recordingId: attempt.recordingId,
      wordCount: attempt.wordCount,
      finished: attempt.finished,
      issueCount: attempt.issueCount,
      evaluated: attempt.evaluated,
      scaffoldUsed: attempt.scaffoldUsed,
      durationMs: attempt.durationMs,
      fluency: attempt.fluency,
      createdAt: attempt.createdAt,
    });
    onCompleted?.();
  };

  if (!prompt) return null;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
          {t("Unprepared question")}
        </span>
        {(phase === "preparing" || phase === "speaking") && (
          <span className="text-sm font-semibold tabular-nums text-accent">{remaining}s</span>
        )}
      </div>

      {phase === "ready" && (
        <>
          <p className="text-lg leading-relaxed text-ink">{t(prompt.question)}</p>
          <p className="text-xs text-ink-muted">
            {t("Answer out loud. You have {seconds} seconds to think.", { seconds: PREPARATION_SECONDS })}
          </p>
          <Button
            variant="primary"
            size="lg"
            className="w-full py-2.5"
            onClick={() => { setPhase("preparing"); setRemaining(PREPARATION_SECONDS); }}
          >
            {t("Start")}
          </Button>
        </>
      )}

      {phase === "preparing" && (
        <p className="text-lg leading-relaxed text-ink">{t(prompt.question)}</p>
      )}

      {phase === "speaking" && (
        <>
          {/* Hidden on purpose: with the question on screen this is reading, not recall. */}
          <p className="text-sm text-ink-soft">{t("Speak now — the question is hidden on purpose.")}</p>
          {revealed && <p className="text-sm text-ink-muted">{t(prompt.question)}</p>}
          {!revealed && (
            <Button variant="secondary" size="sm" onClick={() => setRevealed(true)}>
              {t("Show the question again")}
            </Button>
          )}
        </>
      )}

      {phase === "done" && (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">{t(prompt.question)}</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder={t("Write your sentence in English")}
            className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full py-2.5"
            disabled={!text.trim()}
            onClick={() => void save()}
          >
            {t("Save")}
          </Button>
        </div>
      )}

      {note && <p className="text-xs text-ink-muted">{note}</p>}
    </Card>
  );
}
