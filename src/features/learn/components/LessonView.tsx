"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as PanelCard } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TranscriptReview } from "@/features/discover/components/TranscriptReview";
import { SUGGESTED_FIRST_VIDEO_URL } from "@/features/discover/constants";
import type { DiscoverResult, TranscriptSegment } from "@/features/discover/types";
import { markFirstRunPhrasesSaved } from "@/features/activation/firstRun";
import { buildDeckFromPhrases, firstLesson, lessonById, type Lesson, type LessonPhrase } from "@/features/learn/lessonDeck";
import { MistakeStep } from "@/features/learn/components/MistakeStep";
import { PronunciationCoach } from "@/features/pronunciation/components/PronunciationCoach";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
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
  onTryOwnSource,
}: {
  lessonId?: string;
  onBack?: () => void;
  onStudyNow?: () => void;
  onTryOwnSource?: (url: string) => void;
}) {
  const lesson = useMemo(() => (lessonId ? lessonById(lessonId) : undefined) ?? firstLesson(), [lessonId]);

  return <LessonViewContent key={lesson.id} lesson={lesson} onBack={onBack} onStudyNow={onStudyNow} onTryOwnSource={onTryOwnSource} />;
}

function LessonViewContent({
  lesson,
  onBack,
  onStudyNow,
  onTryOwnSource,
}: {
  lesson: Lesson;
  onBack?: () => void;
  onStudyNow?: () => void;
  onTryOwnSource?: (url: string) => void;
}) {
  const { t } = useT();
  const result = useMemo(() => resultForLesson(lesson), [lesson]);
  const [kept, setKept] = useState<Set<number>>(() => new Set(lesson.phrases.map((_, i) => i)));
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
    async (index: number, segment: TranscriptSegment) => {
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
        if (playRequestRef.current === requestId) setPlaying(index);
      } catch {
        if (playRequestRef.current === requestId) setPlaying(null);
      }
    },
    [playing],
  );

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
              {t("Listen to the audio, save the phrases you want, then review them. No setup needed.")}
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
                      ? "You created {count} review cards: {phrases} from real English and 1 from your own mistake."
                      : "You created {count} review cards: {phrases} from real English and 1 you wrote yourself.",
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

      <TranscriptReview
        result={result}
        audioRef={audioRef}
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

      {done && exercisePhrase && !mistakeSaved && (
        <MistakeStep
          lessonId={lesson.id}
          phrase={exercisePhrase}
          onSaved={(hadMistake) => setMistakeSaved({ hadMistake })}
        />
      )}

      {/* Depth, not the front door: pronunciation practice appears only after the
          save → write → correct loop is complete, so the first run stays one story. */}
      {mistakeSaved && (
        <>
          <PanelCard className="space-y-3 p-5">
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Now try a video of your own")}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t("Use a short video to turn real phrases into review with the original audio.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onTryOwnSource && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onTryOwnSource(SUGGESTED_FIRST_VIDEO_URL)}
                >
                  {t("Try a suggested video")}
                </Button>
              )}
              {onStudyNow && (
                <Button variant="secondary" size="sm" onClick={onStudyNow}>
                  {t("Review now")}
                </Button>
              )}
            </div>
          </PanelCard>
          <PanelCard className="space-y-3 p-5">
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Practice pronunciation")}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t("Repeat the lesson phrases and get local feedback.")}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {lesson.phrases.map((phrase, index) => (
                <div key={`${lesson.id}-${index}`} className="space-y-2 rounded border border-line bg-surface p-3">
                  <p className="text-sm leading-relaxed text-ink">{phrase.en}</p>
                  <PronunciationCoach
                    source="lesson"
                    lessonId={lesson.id}
                    targetText={phrase.en}
                    referenceAudioUrl={phrase.clip}
                    compact
                  />
                </div>
              ))}
            </div>
          </PanelCard>
        </>
      )}
    </div>
  );
}
