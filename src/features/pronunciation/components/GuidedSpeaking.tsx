"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { PronunciationCoach } from "@/features/pronunciation/components/PronunciationCoach";
import { MistakeStep } from "@/features/learn/components/MistakeStep";
import { buildSpeakingDrill, type SpeakingDrillStep } from "@/features/pronunciation/speakingDrill";
import {
  completedLessonIdsFromCardIds,
  firstLesson,
  nextLessonFor,
  type Lesson,
  type LessonPhrase,
} from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { getCards } from "@/lib/store/repository";
import { useT } from "@/i18n/I18nProvider";

/**
 * The beginner speaking surface — the method's Rule #1 ("speaking must be present from
 * the beginning") made real. Open roleplay (`ConverseTab`) cannot start without an LLM
 * provider, so it stays gated; this drill runs on local Whisper and local Kokoro and
 * therefore opens on day 1, with no configuration.
 *
 * It composes what already exists: `PronunciationCoach` for the Repeat stage, and
 * `MistakeStep` in voice-first mode for Speak → Feedback → Retry.
 */
export function GuidedSpeaking({ onDone }: { onDone?: () => void }) {
  const { t } = useT();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<SpeakingDrillStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    // The store can be unavailable (private-mode browsers) or fail to read. Speaking has
    // to work on day 1 regardless, so the drill is built in `finally`: an empty card set
    // simply falls through to the first lesson rather than leaving the learner stranded.
    const cardIds = new Set<string>();
    try {
      for (const card of await getCards()) cardIds.add(card.id);
    } finally {
      const next: Lesson =
        nextLessonFor(getLearningProfile(), completedLessonIdsFromCardIds(cardIds)) ??
        firstLesson();
      const savedPhrases: LessonPhrase[] = next.phrases.filter((phrase, index) =>
        cardIds.has(`lesson-${next.id}-card-${phrase.id ?? index}`),
      );
      setLesson(next);
      setSteps(buildSpeakingDrill({ lesson: next, savedPhrases }));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!lesson || steps.length === 0) {
    return <Notice tone="default">{t("No speaking material is available yet.")}</Notice>;
  }

  const repeatSteps = steps.filter((step) => step.kind === "repeat");
  const speakStep = steps.find((step) => step.kind === "speak");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Speak")}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
          {t("Warm up, then say something of your own")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t("Imitate the model line first. You do not need to sound perfect — you need to be understood.")}
        </p>
      </Card>

      {repeatSteps.map((step, index) => (
        <Card key={`${step.phrase.en}-${index}`} className="space-y-3 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.5px] text-ink-muted">
              {t("Repeat {current} of {total}", { current: index + 1, total: repeatSteps.length })}
            </p>
            <p className="mt-1 text-base font-medium text-ink">{step.phrase.en}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{step.phrase.pt}</p>
            <p className="mt-1 text-xs text-ink-muted">{t(step.prompt)}</p>
          </div>
          <PronunciationCoach
            source="lesson"
            lessonId={lesson.id}
            targetText={step.phrase.en}
            referenceAudioUrl={step.phrase.clip}
            compact
          />
        </Card>
      ))}

      {speakStep && !saved && (
        <MistakeStep
          voiceFirst
          lessonId={lesson.id}
          phrase={speakStep.phrase}
          productionPrompt={speakStep.prompt}
          retryHint={lesson.retryHint}
          onSaved={() => setSaved(true)}
        />
      )}

      {saved && (
        <Notice tone="success" className="space-y-3">
          <p>{t("You spoke English and saved a sentence of your own. It comes back in review tomorrow.")}</p>
          {onDone && (
            <Button variant="primary" onClick={onDone}>
              {t("Done")}
            </Button>
          )}
        </Notice>
      )}
    </div>
  );
}
