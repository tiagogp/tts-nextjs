"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeButtons } from "./GradeButtons";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import type { Card as CardModel } from "@/lib/cards/schema";
import { targetTextOfCard } from "@/lib/cards/orientation";
import type { ReviewRecord } from "@/lib/store/repository";
import { PronunciationCoach } from "@/features/pronunciation/components/PronunciationCoach";
import { SessionSummary, type SessionResult, type TomorrowPreview } from "./SessionSummary";
import { useT } from "@/i18n/I18nProvider";
import { errorTypeLabel } from "@/lib/cards/errorTypeLabels";
import {
  SCAFFOLD,
  buildHint,
  isStable,
  recentFailureCount,
  shouldOfferModalityFallback,
} from "../scaffold";
import {
  evaluateRecall,
  isVetoable,
  recordedCorrectness,
  type RecallEvaluation,
  type RecallQuality,
} from "../responseEvaluation";
import { Rating } from "@/lib/srs/fsrs";
import { LOCAL_JUDGE, type JudgeStamp } from "@/lib/evaluation/judge";

export interface DueCard {
  card: CardModel;
  srs: SrsRecord;
}

/** Telemetry the card reports up on grade, merged with latency in StudyTab. */
export interface ScaffoldTelemetry {
  hintUsed: boolean;
  scaffoldLevel: number;
  responseText?: string;
  responseQuality?: RecallQuality;
  responseCorrect?: boolean;
  /** Which checker produced `responseCorrect`, when one did. */
  judge?: JudgeStamp;
}

interface StudyCardProps {
  totalCards: number;
  current?: DueCard;
  queueLength: number;
  flipped: boolean;
  grading: boolean;
  sessionResults: SessionResult[];
  tomorrow: TomorrowPreview | null;
  reviews: ReviewRecord[];
  transferRequired?: boolean;
  transferComplete?: boolean;
  onFlip: (responseText?: string, responseQuality?: RecallQuality) => void;
  onGrade: (grade: Grade, scaffold: ScaffoldTelemetry) => void;
  onDiscover: () => void;
}

export function StudyCard({
  totalCards,
  current,
  queueLength,
  flipped,
  grading,
  sessionResults,
  tomorrow,
  reviews,
  transferRequired = false,
  transferComplete = false,
  onFlip,
  onGrade,
  onDiscover,
}: StudyCardProps) {
  const { t } = useT();
  // Highest scaffold tier used on the current card — reported up on grade.
  const [scaffoldLevel, setScaffoldLevel] = useState<number>(SCAFFOLD.none);
  const [responseText, setResponseText] = useState("");
  const [evaluation, setEvaluation] = useState<RecallEvaluation | undefined>();
  const responseQuality: RecallQuality | undefined = evaluation?.quality;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cardId = current?.card.id;
  // Reset scaffold state whenever the card changes (render-phase reset on key change).
  const [prevCardId, setPrevCardId] = useState(cardId);
  if (cardId !== prevCardId) {
    setPrevCardId(cardId);
    setScaffoldLevel(SCAFFOLD.none);
    setResponseText("");
    setEvaluation(undefined);
  }

  // The card's own accepted wordings and target frame. Without them the check can only
  // compare strings, and it says so (`literalOnly`) rather than calling good English wrong.
  const recallOptions = {
    acceptedAnswers: current?.card.acceptedAnswers,
    frame: current?.card.patternFrame,
  };

  const nativeClip =
    current?.card.audioClipPath?.startsWith("/") ? current.card.audioClipPath : undefined;
  // On a production card the clip *is* the answer. Playing it pre-flip would turn "produce
  // the English" into "repeat what you just heard", so audio waits for the reveal and the
  // pre-flip scaffold controls that replay it are withheld.
  const producing = current?.card.direction === "production";
  const failures = useMemo(
    () => (cardId ? recentFailureCount(cardId, reviews) : 0),
    [cardId, reviews],
  );
  const stable = current ? isStable(current.srs) : false;
  const offerModality = !!nativeClip && shouldOfferModalityFallback(failures);

  const markScaffold = (level: number) => setScaffoldLevel((prev) => Math.max(prev, level));

  // Autoplay side: the prompt for a recognition card, the reveal for a production one.
  const autoplayNow = !!nativeClip && (producing ? flipped : !flipped);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !autoplayNow) return;

    el.pause();
    el.playbackRate = 1;
    el.currentTime = 0;
    void el.play().catch(() => {});

    return () => {
      el.pause();
    };
  }, [cardId, autoplayNow]);

  const playClip = (rate: number, level: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = rate;
    el.currentTime = 0;
    void el.play();
    markScaffold(level);
  };

  // When a queue finishes after real work, the honest session summary replaces the
  // bare "all caught up" note — it carries its own card chrome.
  if (totalCards > 0 && !current && sessionResults.length > 0) {
    if (transferRequired && !transferComplete) {
      return (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-ink">{t("Reviews complete")}</p>
          <p className="mt-1 text-xs text-ink-muted">{t("Complete the evaluated transfer check below to finish this session.")}</p>
        </Card>
      );
    }
    return <SessionSummary results={sessionResults} tomorrow={tomorrow} />;
  }

  return (
    <Card className="p-6 sm:p-8">
      {totalCards === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">{t("No practice phrases yet")}</p>
          <p className="text-xs text-ink-muted">
            {t("Start from Home with the first lesson. If you already have a source, bring it in Phrases.")}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onDiscover}>
            {t("Open Phrases")}
          </Button>
        </div>
      ) : !current ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">{t("You're all caught up")}</p>
          <p className="text-xs text-ink-muted">
            {t("Tomorrow you review these phrases. Add more only when you want fresh material.")}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onDiscover}>
            {t("Find new phrases")}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
              {current.card.concept || t("Practice phrase")}
            </span>
            <span className="text-xs tabular-nums text-ink-muted">
              {t("{count} in today's queue", { count: queueLength })}
            </span>
          </div>

          <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg leading-relaxed text-ink">{current.card.front}</p>
            {producing && !flipped && (
              <div className="w-full space-y-2">
                <p className="text-xs text-ink-muted">{t("Produce it in English before checking.")}</p>
                <label className="sr-only" htmlFor={`recall-${cardId}`}>{t("Your answer")}</label>
                <input
                  id={`recall-${cardId}`}
                  value={responseText}
                  onChange={(event) => setResponseText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && responseText.trim()) {
                      const result = evaluateRecall(current.card.back, responseText, recallOptions);
                      setEvaluation(result);
                      onFlip(responseText.trim(), result.quality);
                    }
                  }}
                  autoComplete="off"
                  placeholder={t("Type what you would say in English")}
                  className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            )}

            {!flipped && scaffoldLevel >= SCAFFOLD.partial && (
              <p className="font-mono text-sm tracking-wide text-ink-soft transition-opacity">
                {buildHint(current.card.back)}
              </p>
            )}

            {flipped && (
              <>
                <div className="w-full border-t border-line" />
                <p className="text-base leading-relaxed text-ink-soft">{current.card.back}</p>
                {producing && evaluation && (
                  <p className={
                    evaluation.quality === "correct"
                      ? "text-xs text-success"
                      : evaluation.formIssues.length > 0 || evaluation.patternUsed === false
                        ? "text-xs text-danger"
                        : "text-xs text-ink-muted"
                  }>
                    {/* Named errors first: a specific correction teaches more than a score. */}
                    {evaluation.formIssues.length > 0
                      ? t(evaluation.formIssues[0].note)
                      : evaluation.quality === "correct"
                        ? t("That works. Your wording does not have to match the example.")
                        : evaluation.patternUsed === false
                          ? t("Correct English, but this card practises “{frame}”. Try it with that structure.", {
                              frame: current.card.patternFrame ?? "",
                            })
                          // No frame and no named error: the app genuinely cannot tell a good
                          // paraphrase from a wrong answer, so it must not pretend to.
                          : t("Compare your answer with the example and grade yourself honestly.")}
                  </p>
                )}
                {current.card.errorType && (
                  <span className="text-xs text-ink-muted">{t(errorTypeLabel(current.card.errorType))}</span>
                )}
                <div className="w-full">
                  <PronunciationCoach
                    source="study"
                    cardId={current.card.id}
                    targetText={targetTextOfCard(current.card)}
                    referenceAudioUrl={nativeClip}
                    compact
                  />
                </div>
              </>
            )}
          </div>

          {!flipped && (
            <ScaffoldControls
              stable={stable}
              hasHint={scaffoldLevel < SCAFFOLD.partial}
              // Replaying the clip before the reveal is only a nudge when the clip is the
              // prompt. On a production card it hands over the answer, so the light control
              // is withheld and only the post-failure fallback (recorded at its true
              // scaffold level) can reach the audio.
              nativeClip={producing ? undefined : nativeClip}
              offerModality={offerModality}
              onHint={() => markScaffold(SCAFFOLD.partial)}
              onSlowAudio={() => playClip(0.75, SCAFFOLD.hint)}
              onModality={() => playClip(1, SCAFFOLD.modality)}
            />
          )}

          {nativeClip && (
            // Hidden player the scaffold controls drive (slow replay / listen-and-repeat).
            <audio ref={audioRef} src={nativeClip} preload="none" className="hidden" />
          )}

          {!flipped ? (
            <Button
              variant="primary"
              size="lg"
              className="py-2.5"
              disabled={producing && !responseText.trim()}
              onClick={() => {
                const result = producing
                  ? evaluateRecall(current.card.back, responseText, recallOptions)
                  : undefined;
                setEvaluation(result);
                onFlip(responseText.trim() || undefined, result?.quality);
              }}
            >
              {t("Show answer")}
            </Button>
          ) : (
            <GradeButtons
              srs={current.srs}
              disabled={grading}
              // Restrict the grade only on observed evidence — a named transfer error, a
              // missing target frame, an empty answer. Vetoing on string distance alone
              // punished correct English and taught the learner to reproduce the authored
              // wording, which is the opposite of what a production card is for.
              allowedGrades={evaluation && isVetoable(evaluation)
                ? (evaluation.quality === "close" ? [Rating.Again, Rating.Hard] : [Rating.Again])
                : undefined}
              onGrade={(g) => onGrade(g, {
                hintUsed: scaffoldLevel > SCAFFOLD.none,
                scaffoldLevel,
                responseText: responseText.trim() || undefined,
                responseQuality,
                responseCorrect: recordedCorrectness(evaluation),
                // Stamped only when there is a verdict to attribute: an unjudged answer
                // must not look like one a local check passed.
                judge: evaluation ? LOCAL_JUDGE : undefined,
              })}
            />
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Opt-in support shown pre-flip. For a stable card the affordance shrinks to a quiet text
 * link (withdrawal rule); for a fragile one it's a proper button. The listen-and-repeat
 * fallback only appears after a real run of failures on a card with native audio.
 */
function ScaffoldControls({
  stable,
  hasHint,
  nativeClip,
  offerModality,
  onHint,
  onSlowAudio,
  onModality,
}: {
  stable: boolean;
  hasHint: boolean;
  nativeClip?: string;
  offerModality: boolean;
  onHint: () => void;
  onSlowAudio: () => void;
  onModality: () => void;
}) {
  const { t } = useT();
  if (offerModality) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button variant="secondary" size="sm" onClick={onModality}>
          {t("Listen & repeat")}
        </Button>
        <p className="text-[11px] text-ink-muted">
          {t("You've struggled with this one — hear it first, then say it back.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 text-xs">
      {hasHint &&
        (stable ? (
          <button
            type="button"
            onClick={onHint}
            className="cursor-pointer text-ink-muted underline-offset-2 transition-opacity hover:opacity-70 hover:underline"
          >
            {t("Need a hint?")}
          </button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onHint}>
            {t("Hint")}
          </Button>
        ))}
      {nativeClip && (
        <button
          type="button"
          onClick={onSlowAudio}
          className="cursor-pointer text-ink-muted underline-offset-2 transition-opacity hover:opacity-70 hover:underline"
        >
          {t("Replay 0.75×")}
        </button>
      )}
    </div>
  );
}
