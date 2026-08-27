"use client";

/**
 * The no-AI starting-level check, offered at onboarding: listen → complete → write.
 *
 * Everything here runs from bundled lesson audio and text, so a learner who never configures
 * a provider still gets a starting point instead of guessing from a dropdown. The writing
 * step is self-assessed and says so on screen — it is kept as the learner's own before/after
 * evidence and never moves the suggested level (see `placement.ts`).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";
import { LESSONS } from "@/features/learn/lessonDeck";
import type { EnglishLevel } from "@/features/discover/types";
import {
  buildPlacementCheck,
  gradePlacement,
  type PlacementResult,
  type PlacementSelfRating,
} from "../placement";

type Stage = "intro" | "items" | "writing" | "result";

const SELF_RATINGS: readonly PlacementSelfRating[] = ["struggled", "managed", "comfortable"];

interface LocalPlacementCheckProps {
  /** Applies the suggested level. Not called when the result is "insufficient". */
  onAccept: (level: EnglishLevel) => void;
  onClose: () => void;
  /**
   * Onboarding localizes from the level/language still being picked in the form, not from the
   * saved profile the provider reads. It passes its own translator so this panel does not
   * flip to English mid-dialog.
   */
  translate?: (en: string, vars?: Record<string, string | number>) => string;
}

export function LocalPlacementCheck({ onAccept, onClose, translate }: LocalPlacementCheckProps) {
  const { t: contextT } = useT();
  const t = translate ?? contextT;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [seed] = useState(() => Date.now());
  const check = useMemo(() => buildPlacementCheck(LESSONS, seed), [seed]);

  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<(string | null)[]>(() => check.items.map(() => null));
  const [writingSample, setWritingSample] = useState("");
  const [selfRating, setSelfRating] = useState<PlacementSelfRating | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const play = useCallback((clip: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = clip;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // A blocked or missing clip must not strand the learner mid-check — the item can be
      // skipped, and a skipped item is scored as unanswered rather than wrong.
    });
  }, []);

  const setAnswer = useCallback((index: number, value: string) => {
    setAnswers((previous) => previous.map((answer, position) => (position === index ? value : answer)));
  }, []);

  const finish = useCallback(() => {
    setResult(gradePlacement(check, { items: answers, writingSample, selfRating }));
    setStage("result");
  }, [check, answers, writingSample, selfRating]);

  const answeredCount = answers.filter((answer) => answer !== null && answer !== "").length;

  const ratingLabel = (rating: PlacementSelfRating) => {
    if (rating === "struggled") return t("I struggled");
    if (rating === "managed") return t("I managed");
    return t("I was comfortable");
  };

  return (
    <UiCard className="space-y-4 p-5">
      <audio ref={audioRef} preload="none" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Find your starting level")}</p>
          <p className="text-xs text-ink-muted">{t("Works offline · no AI needed")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer text-xs font-medium text-ink-muted transition-opacity hover:opacity-80"
        >
          {stage === "result" ? t("Close") : t("Cancel")}
        </button>
      </div>

      {stage === "intro" && (
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">
            {t(
              "A few short clips to understand, a few sentences to complete, and one thing to write. It picks where to start you — it is not an official level test.",
            )}
          </p>
          <Button size="sm" onClick={() => setStage("items")}>
            {t("Start the check")}
          </Button>
        </div>
      )}

      {stage === "items" && (
        <div className="space-y-4">
          <p className="text-xs text-ink-muted">
            {t("Skip anything you don't know — a skipped answer counts as no evidence, not a mistake.")}
          </p>

          {check.items.map((item, index) =>
            item.kind === "listening" ? (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => play(item.clip)}>
                    {t("Play")}
                  </Button>
                  <p className="text-xs text-ink-muted">{t("What did you hear?")}</p>
                </div>
                <div className="space-y-1">
                  {item.options.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="radio"
                        name={item.id}
                        checked={answers[index] === option}
                        onChange={() => setAnswer(index, option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div key={item.id} className="space-y-1">
                <p className="text-sm text-ink">{item.sentence}</p>
                <p className="text-xs text-ink-muted">{item.meaning}</p>
                <input
                  type="text"
                  value={answers[index] ?? ""}
                  onChange={(event) => setAnswer(index, event.target.value)}
                  className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  placeholder={t("Missing word")}
                />
              </div>
            ),
          )}

          <Button size="sm" onClick={() => setStage("writing")}>
            {t("Continue")}
          </Button>
        </div>
      )}

      {stage === "writing" && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{check.writing.prompt}</p>
          <textarea
            value={writingSample}
            onChange={(event) => setWritingSample(event.target.value)}
            rows={5}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            placeholder={t("Write 2-4 sentences…")}
          />
          <div className="space-y-1.5">
            <p className="text-xs text-ink-muted">{t("How did that feel?")}</p>
            <div className="flex flex-wrap gap-2">
              {SELF_RATINGS.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setSelfRating(rating)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                    selfRating === rating
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line text-ink-soft hover:border-accent/50"
                  }`}
                >
                  {ratingLabel(rating)}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              {t("Your own rating is kept as a before/after note. It does not change the suggested level.")}
            </p>
          </div>
          <Button size="sm" onClick={finish}>
            {t("See my starting level")}
          </Button>
        </div>
      )}

      {stage === "result" && result && (
        <div className="space-y-3">
          {result.outcome === "insufficient" ? (
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-ink">{t("Not enough answers to suggest a level")}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {t("You answered {answered} of {total}. Pick a level yourself for now — a few lessons will say more than this check can.", {
                  answered: result.answered,
                  total: result.total,
                })}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {t("Suggested starting level: {level}", { level: result.suggestedLevel ?? "A1" })}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {t("Based on {correct} of {total} understood. It is a starting point, not a diagnosis — change it any time in Settings.", {
                  correct: result.correct,
                  total: result.total,
                })}
              </p>
            </div>
          )}

          <ul className="space-y-1 text-xs text-ink-soft">
            {result.bands.map((band) => (
              <li key={band.band}>
                {t("{level}: {correct}/{total} understood", {
                  level: band.band,
                  correct: band.correct,
                  total: band.total,
                })}
              </li>
            ))}
          </ul>

          {result.selfRating && (
            <p className="text-xs text-ink-muted">
              {t("Your writing, self-rated \"{rating}\", was saved as a note, not as a score.", {
                rating: ratingLabel(result.selfRating),
              })}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {result.suggestedLevel && (
              <Button size="sm" onClick={() => onAccept(result.suggestedLevel as EnglishLevel)}>
                {t("Start at {level}", { level: result.suggestedLevel })}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("Choose myself")}
            </Button>
          </div>
        </div>
      )}

      {stage === "items" && (
        <p className="text-xs text-ink-muted">
          {t("{answered} of {total} answered", { answered: answeredCount, total: check.items.length })}
        </p>
      )}
    </UiCard>
  );
}
