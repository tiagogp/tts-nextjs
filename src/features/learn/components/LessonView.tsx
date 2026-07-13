"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as PanelCard } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TranscriptReview } from "@/features/discover/components/TranscriptReview";
import type { DiscoverResult, TranscriptSegment } from "@/features/discover/types";
import { markFirstRunPhrasesSaved } from "@/features/activation/firstRun";
import {
  LESSONS,
  buildDeckFromPhrases,
  firstLesson,
  lessonById,
  type Lesson,
  type LessonPhrase,
} from "@/features/learn/lessonDeck";
import {
  buildListeningChallenge,
  learningPhrases,
  passedListeningChallenge,
} from "@/features/learn/lessonFlow";
import { MistakeStep } from "@/features/learn/components/MistakeStep";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";

function waitForAudioEvent(
  audio: HTMLAudioElement,
  eventName: "loadedmetadata",
  timeoutMs = 4000,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeEventListener(eventName, finish);
      audio.removeEventListener("error", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    audio.addEventListener(eventName, finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

function resultForLesson(lesson: Lesson): DiscoverResult {
  return {
    sourceId: `lesson-${lesson.id}`,
    title: lesson.title,
    hasAudio: true,
    segments: lesson.phrases.map((phrase) => ({
      text: phrase.en,
      startMs: 0,
      endMs: 0,
      clipUrl: phrase.clip,
    })),
  };
}

export function LessonView({
  lessonId,
  onBack,
  onStudyNow,
}: {
  lessonId?: string;
  onBack?: () => void;
  onStudyNow?: () => void;
}) {
  const lesson = useMemo(() => (lessonId ? lessonById(lessonId) : undefined) ?? firstLesson(), [lessonId]);

  return <LessonViewContent key={lesson.id} lesson={lesson} onBack={onBack} onStudyNow={onStudyNow} />;
}

function LessonViewContent({
  lesson,
  onBack,
  onStudyNow,
}: {
  lesson: Lesson;
  onBack?: () => void;
  onStudyNow?: () => void;
}) {
  const { t } = useT();
  const result = useMemo(() => resultForLesson(lesson), [lesson]);
  const learnSet = useMemo(() => learningPhrases(lesson), [lesson]);
  const listeningChallenge = useMemo(
    () => buildListeningChallenge(lesson, LESSONS),
    [lesson],
  );
  const [kept, setKept] = useState<Set<number>>(() => new Set(lesson.phrases.map((_, i) => i)));
  const [learnComplete, setLearnComplete] = useState(false);
  const [challengePlays, setChallengePlays] = useState<number[]>(() =>
    listeningChallenge.audio.map(() => 0),
  );
  const [comprehensionAnswers, setComprehensionAnswers] = useState<(string | null)[]>(() =>
    listeningChallenge.questions.map(() => null),
  );
  const [listeningChecked, setListeningChecked] = useState(false);
  const [listeningPassed, setListeningPassed] = useState(false);
  const [transcriptRevealed, setTranscriptRevealed] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exercisePhrase, setExercisePhrase] = useState<LessonPhrase | null>(null);
  const [savedPhraseCount, setSavedPhraseCount] = useState(0);
  const [mistakeSaved, setMistakeSaved] = useState<{ hadMistake: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playRequestRef = useRef(0);

  useEffect(() => {
    void fetch("/api/models/whisper", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(null);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [result]);

  const playClip = useCallback(
    async (index: number, segment: TranscriptSegment, challengeIndex?: number) => {
      const audio = audioRef.current;
      if (!audio || !segment.clipUrl) return;
      const requestId = playRequestRef.current + 1;
      playRequestRef.current = requestId;

      if (playing === index) {
        audio.pause();
        setPlaying(null);
        return;
      }

      audio.pause();
      setPlaying(null);
      if (audio.src !== new URL(segment.clipUrl, window.location.href).href) {
        audio.src = segment.clipUrl;
        audio.load();
        await waitForAudioEvent(audio, "loadedmetadata");
        if (playRequestRef.current !== requestId) return;
      }
      audio.currentTime = 0;
      try {
        await audio.play();
        if (playRequestRef.current === requestId) {
          setPlaying(index);
          if (!transcriptRevealed && challengeIndex !== undefined) {
            setChallengePlays((counts) =>
              counts.map((count, currentIndex) =>
                currentIndex === challengeIndex ? count + 1 : count,
              ),
            );
          }
          void emitActivity("method_stage", {
            stage: "listen",
            area: "listening",
            source: "lesson",
            minutes: 1,
            subjectId: lesson.id,
          });
        }
      } catch {
        if (playRequestRef.current === requestId) setPlaying(null);
      }
    },
    [lesson.id, playing, transcriptRevealed],
  );

  const completeLearn = () => {
    setLearnComplete(true);
    void emitActivity("method_stage", {
      stage: "learn",
      area: "structured",
      source: "lesson",
      minutes: 4,
      subjectId: lesson.id,
    });
  };

  const checkListening = () => {
    if (
      challengePlays.some((count) => count === 0) ||
      comprehensionAnswers.some((answer) => !answer)
    ) return;
    const passed = passedListeningChallenge(listeningChallenge, comprehensionAnswers);
    setListeningChecked(true);
    setListeningPassed(passed);
  };

  const chooseComprehensionAnswer = (questionIndex: number, answer: string) => {
    setComprehensionAnswers((answers) =>
      answers.map((current, index) => (index === questionIndex ? answer : current)),
    );
    setListeningChecked(false);
    setListeningPassed(false);
  };

  const toggleKeep = (index: number) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setDone(null);
    setError(null);
  };

  const saveLesson = async () => {
    if (kept.size === 0 || saving) return;
    setSaving(true);
    setDone(null);
    setError(null);
    try {
      const deck = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, kept);
      const result = await saveGeneratedDeck(deck.cards, deck.candidates);
      const activation = markFirstRunPhrasesSaved({ sourceId: lesson.id });
      void emitActivity("cards_created", {
        count: deck.cards.length,
        source: "learn",
        activation,
      });
      void emitActivity("method_stage", {
        stage: "notice",
        area: "structured",
        source: "lesson",
        minutes: 3,
        subjectId: lesson.id,
      });
      setDone(
        result.added === 0
          ? t("Lesson already saved. Now write one sentence of your own below.")
          : t("{count} practice phrases saved. Now write one sentence of your own below.", { count: result.added }),
      );
      setSavedPhraseCount(deck.cards.length);
      const firstKept = Math.min(...[...kept]);
      setExercisePhrase(lesson.phrases[firstKept] ?? lesson.phrases[0]);
      window.dispatchEvent(new CustomEvent("phraseloop:lesson-saved", { detail: { lessonId: lesson.id } }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Could not save this lesson."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PanelCard className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.7px] text-accent">{t(lesson.level)} · {t(lesson.topic)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-ink">{t(lesson.title)}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {lesson.objective
                ? t(lesson.objective)
                : t("Learn a small set, listen without the transcript, then use one phrase yourself.")}
            </p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t("Back")}
            </Button>
          )}
        </div>
        {done && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <span>
              {mistakeSaved
                ? t(
                    mistakeSaved.hadMistake
                      ? "You saved {count} phrases to review: {phrases} from real English and 1 from your own mistake."
                      : "You saved {count} phrases to review: {phrases} from real English and 1 you wrote yourself.",
                    { count: savedPhraseCount + 1, phrases: savedPhraseCount },
                  )
                : done}
            </span>
            {onStudyNow && (
              <button type="button" onClick={onStudyNow} className="font-medium underline hover:no-underline">
                {t("Review now")}
              </button>
            )}
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </PanelCard>

      <audio ref={audioRef} preload="metadata" />

      {!learnComplete && (
        <PanelCard className="space-y-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("1 · Learn")}</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
              {t("Learn five useful phrases")}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {t("Study the meaning, pattern, and situation. You will hear this language next.")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {learnSet.map((phrase) => (
              <div key={phrase.en} className="space-y-2 rounded border border-line bg-surface p-3">
                <p className="text-sm font-semibold text-ink">{phrase.en}</p>
                <p className="text-sm text-ink-soft">{phrase.pt}</p>
                <div className="border-t border-line pt-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-accent">
                    {t("Pattern: {pattern}", { pattern: phrase.concept })}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">{t(phrase.note)}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="primary" onClick={completeLearn}>
            {t("Continue to listening")}
          </Button>
        </PanelCard>
      )}

      {learnComplete && !transcriptRevealed && (
        <PanelCard className="space-y-5 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("2 · Listen")}</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
              {t("Listen before reading")}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {t("First catch the situation and two phrases. You do not need to understand every word.")}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {listeningChallenge.audio.map((clip, clipIndex) => {
              const playingIndex = -(clipIndex + 1);
              return (
                <div key={clip.id} className="space-y-3 rounded border border-line bg-surface p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.5px] text-ink-muted">
                      {clip.speaker
                        ? t("{speaker} · audio-only clip {count}", {
                            speaker: clip.speaker,
                            count: clipIndex + 1,
                          })
                        : t("Audio-only clip {count}", { count: clipIndex + 1 })}
                    </p>
                    <Button
                      className="mt-3"
                      variant="secondary"
                      onClick={() =>
                        void playClip(
                          playingIndex,
                          { text: clip.en, startMs: 0, endMs: 0, clipUrl: clip.clip },
                          clipIndex,
                        )
                      }
                    >
                      {playing === playingIndex
                        ? t("Pause clip")
                        : t("Play clip {count} without transcript", { count: clipIndex + 1 })}
                    </Button>
                    <p className="mt-2 text-xs text-ink-muted">
                      {challengePlays[clipIndex] === 0
                        ? t("Listen at least once before answering.")
                        : t("Listened {count} time(s). Replay whenever you need.", {
                            count: challengePlays[clipIndex],
                          })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {listeningChallenge.questions.map((question, questionIndex) => (
              <fieldset
                key={`${question.kind}-${question.prompt}`}
                className="space-y-2 rounded border border-line bg-surface p-4"
                disabled={challengePlays.some((count) => count === 0)}
              >
                <legend className="px-1 text-sm font-medium text-ink">{t(question.prompt)}</legend>
                <div className="grid gap-2">
                  {question.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={comprehensionAnswers[questionIndex] === option}
                      onClick={() => chooseComprehensionAnswer(questionIndex, option)}
                      className={cn(
                        "rounded border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        comprehensionAnswers[questionIndex] === option
                          ? "border-accent bg-accent/8 text-ink"
                          : "border-line bg-card text-ink-soft hover:border-line-strong",
                      )}
                    >
                      {t(option)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="space-y-3">
            <Button
              variant="primary"
              onClick={checkListening}
              disabled={
                challengePlays.some((count) => count === 0) ||
                comprehensionAnswers.some((answer) => !answer)
              }
            >
              {t("Check what I heard")}
            </Button>
            {listeningChecked && !listeningPassed && (
              <Notice tone="warning">
                {t("Not yet. Replay the clip and focus on the familiar words; there is no penalty for another try.")}
              </Notice>
            )}
            {listeningChecked && listeningPassed && (
              <Notice tone="success" className="space-y-3">
                <p>{t("You caught the main idea and the important details.")}</p>
                <Button variant="secondary" onClick={() => setTranscriptRevealed(true)}>
                  {t("Reveal transcript and choose phrases")}
                </Button>
              </Notice>
            )}
          </div>
        </PanelCard>
      )}

      {transcriptRevealed && (
        <>
          <Notice tone="success">
            {t("Now compare what you heard with the transcript and notice the phrases worth keeping.")}
          </Notice>
          {lesson.dialogue?.length ? (
            <PanelCard className="space-y-3 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Listening transcript")}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {t("Compare the dialogue with what you understood before reading.")}
                </p>
              </div>
              <div className="space-y-3">
                {lesson.dialogue.map((line, index) => (
                  <div key={`${line.speaker}-${index}`} className="rounded border border-line bg-surface p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-accent">
                      {line.speaker}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">{line.en}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{line.pt}</p>
                  </div>
                ))}
              </div>
            </PanelCard>
          ) : null}
          <TranscriptReview
            result={result}
            audioRef={audioRef}
            renderAudio={false}
            kept={kept}
            playing={playing}
            curationNote={t("All phrases are selected by default.")}
            generating={saving}
            genError={error}
            genDone={done}
            generationStage={t("Saving practice phrases…")}
            generationSeconds={0}
            generateLabel={t("Save and study")}
            cancelLabel={t("Saving…")}
            onGenerate={() => void saveLesson()}
            onCancel={() => undefined}
            onToggleKeep={toggleKeep}
            onPlay={(index, segment) => void playClip(index, segment)}
          />
        </>
      )}

      {done && exercisePhrase && !mistakeSaved && (
        <MistakeStep
          lessonId={lesson.id}
          phrase={exercisePhrase}
          productionPrompt={lesson.productionPrompt}
          retryHint={lesson.retryHint}
          onSaved={(hadMistake) => setMistakeSaved({ hadMistake })}
        />
      )}

      {/* The saved retry is not the end state: review is the only forward action
          until the measured first loop is complete. Own-source and pronunciation
          depth remain available from the unlocked app after that review. */}
      {mistakeSaved && (
        <PanelCard className="space-y-3 border-accent/30 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("One step left")}</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
              {t("Review a saved phrase to finish this lesson")}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {t("After the review, your own sources and extra practice will be ready in the app.")}
            </p>
          </div>
          {onStudyNow && (
            <Button variant="primary" onClick={onStudyNow}>
              {t("Review now and finish")}
            </Button>
          )}
        </PanelCard>
      )}
    </div>
  );
}
