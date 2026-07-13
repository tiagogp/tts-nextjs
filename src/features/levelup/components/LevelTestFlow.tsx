"use client";

/**
 * The level-up test: generate → comprehension → fill-in → writing → result.
 * Objective sections grade locally (the test ships with its answer key); only the
 * writing sample goes back to the AI. A pass advances the profile level; a fail
 * persists the writing mistakes as ErrorEvents so the readiness coach and the
 * reinforcement loop pick them up as drills.
 */

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as UiCard } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { saveLearningProfile } from "@/features/settings/learningProfile";
import { saveErrorEvents, saveLevelTestAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import type { EnglishLevel } from "@/features/discover/types";
import { generateLevelTest, gradeLevelWriting } from "../api";
import {
  evaluateAttempt,
  type AttemptEvaluation,
  type LevelTest,
  type LevelTestAnswers,
} from "../testModel";

type Stage = "intro" | "generating" | "comprehension" | "fillIn" | "writing" | "grading" | "result";

interface LevelTestFlowProps {
  currentLevel: EnglishLevel;
  targetLevel: EnglishLevel;
  /** Weak labels to bias the test toward, worst first. */
  focusGaps: string[];
  onClose: () => void;
}

export function LevelTestFlow({ currentLevel, targetLevel, focusGaps, onClose }: LevelTestFlowProps) {
  const { t } = useT();
  const { settings } = useAiSettings();
  const defaultProvider = settings.providers.find(
    (provider) => provider.kind === settings.defaultProvider,
  );

  const [stage, setStage] = useState<Stage>("intro");
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<LevelTest | null>(null);
  const [comprehension, setComprehension] = useState<(number | null)[]>([]);
  const [fillIn, setFillIn] = useState<string[]>([]);
  const [writingText, setWritingText] = useState("");
  const [evaluation, setEvaluation] = useState<AttemptEvaluation | null>(null);

  const providerReady = defaultProvider?.available === true;

  const start = useCallback(async () => {
    if (!providerReady) {
      setError(
        t("{provider} is unavailable. Open Settings to connect it.", {
          provider: defaultProvider?.label ?? t("The selected AI"),
        }),
      );
      return;
    }
    setError(null);
    setStage("generating");
    try {
      const generated = await generateLevelTest({
        provider: settings.defaultProvider,
        selectedModel: settings.ollama.model || undefined,
        focusGaps,
      });
      setTest(generated);
      setComprehension(generated.comprehension.questions.map(() => null));
      setFillIn(generated.fillIn.map(() => ""));
      setWritingText("");
      setStage("comprehension");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't reach IA. Try again."));
      setStage("intro");
    }
  }, [providerReady, defaultProvider?.label, settings.defaultProvider, settings.ollama.model, focusGaps, t]);

  const submit = useCallback(async () => {
    if (!test) return;
    setError(null);
    setStage("grading");
    try {
      const { grade, events } = await gradeLevelWriting({
        provider: settings.defaultProvider,
        selectedModel: settings.ollama.model || undefined,
        targetLevel,
        writingPrompt: test.writing.prompt,
        text: writingText,
      });
      const answers: LevelTestAnswers = { comprehension, fillIn };
      const result = evaluateAttempt(test, answers, grade);
      const attemptId = crypto.randomUUID();
      await saveLevelTestAttempt({
        id: attemptId,
        fromLevel: currentLevel,
        targetLevel,
        createdAt: Date.now(),
        test,
        answers,
        writingSample: writingText,
        evaluation: result,
        passed: result.passed,
      });
      if (result.passed) {
        saveLearningProfile({ level: targetLevel });
      } else if (events.length > 0) {
        // Loop-closer: failed-test mistakes become drill material for the coach.
        await saveErrorEvents(events);
      }
      await emitActivity("level_test_completed", {
        attemptId,
        fromLevel: currentLevel,
        targetLevel,
        passed: result.passed,
        score: result.overall,
      });
      setEvaluation(result);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't reach IA. Try again."));
      setStage("writing");
    }
  }, [test, settings.defaultProvider, settings.ollama.model, targetLevel, writingText, comprehension, fillIn, currentLevel, t]);

  const comprehensionComplete = comprehension.every((answer) => answer !== null);
  const fillInComplete = fillIn.every((answer) => answer.trim().length > 0);
  const writingReady = writingText.trim().length >= 40;

  const sectionCount = useMemo(() => {
    if (stage === "comprehension") return t("Part 1 of 3 · Reading");
    if (stage === "fillIn") return t("Part 2 of 3 · Sentences");
    if (stage === "writing") return t("Part 3 of 3 · Writing");
    return null;
  }, [stage, t]);

  return (
    <UiCard className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">
            {t("Level test: {from} → {to}", { from: currentLevel, to: targetLevel })}
          </p>
          {sectionCount && <p className="text-xs text-ink-muted">{sectionCount}</p>}
        </div>
        {stage !== "grading" && stage !== "generating" && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer text-xs font-medium text-ink-muted transition-opacity hover:opacity-80"
          >
            {stage === "result" ? t("Close") : t("Cancel")}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {stage === "intro" && (
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">
            {t(
              "Three short parts at the {level} level: read a text, complete sentences, and write a few lines. Everything is pitched at the next level — it should feel harder than your reviews.",
              { level: targetLevel },
            )}
          </p>
          <Button size="sm" onClick={() => void start()}>
            {t("Start the test")}
          </Button>
        </div>
      )}

      {(stage === "generating" || stage === "grading") && (
        <p className="text-xs text-ink-muted">
          {stage === "generating" ? t("Preparing your test…") : t("Evaluating your writing…")}
        </p>
      )}

      {stage === "comprehension" && test && (
        <div className="space-y-4">
          <p className="whitespace-pre-wrap rounded border border-line bg-surface px-3 py-3 text-sm text-ink">
            {test.comprehension.passage}
          </p>
          {test.comprehension.questions.map((question, qi) => (
            <div key={qi} className="space-y-1.5">
              <p className="text-sm text-ink">{question.prompt}</p>
              <div className="space-y-1">
                {question.options.map((option, oi) => (
                  <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name={`comprehension-${qi}`}
                      checked={comprehension[qi] === oi}
                      onChange={() =>
                        setComprehension((prev) => prev.map((answer, i) => (i === qi ? oi : answer)))
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" disabled={!comprehensionComplete} onClick={() => setStage("fillIn")}>
            {t("Continue")}
          </Button>
        </div>
      )}

      {stage === "fillIn" && test && (
        <div className="space-y-3">
          <p className="text-xs text-ink-muted">{t("Complete each sentence with the missing word or phrase.")}</p>
          {test.fillIn.map((question, qi) => (
            <div key={qi} className="space-y-1">
              <p className="text-sm text-ink">{question.sentence}</p>
              <input
                type="text"
                value={fillIn[qi]}
                onChange={(event) =>
                  setFillIn((prev) => prev.map((answer, i) => (i === qi ? event.target.value : answer)))
                }
                className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          ))}
          <Button size="sm" disabled={!fillInComplete} onClick={() => setStage("writing")}>
            {t("Continue")}
          </Button>
        </div>
      )}

      {stage === "writing" && test && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{test.writing.prompt}</p>
          <textarea
            value={writingText}
            onChange={(event) => setWritingText(event.target.value)}
            rows={6}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            placeholder={t("Write 3-6 sentences…")}
          />
          <Button size="sm" disabled={!writingReady} onClick={() => void submit()}>
            {t("Submit the test")}
          </Button>
        </div>
      )}

      {stage === "result" && evaluation && (
        <div className="space-y-3">
          {evaluation.passed ? (
            <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {t("You advanced to {level}!", { level: targetLevel })}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {t("Everything you discover, correct, and practice is now pitched at {level}.", {
                  level: targetLevel,
                })}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-ink">{t("Not this time — and that's useful.")}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {t("Your mistakes were saved as practice material. The coach shows what to reinforce before the next attempt.")}
              </p>
            </div>
          )}
          <ul className="space-y-1 text-xs text-ink-soft">
            <li>
              {t("Reading: {correct}/{total}", {
                correct: evaluation.comprehension.correct,
                total: evaluation.comprehension.total,
              })}
            </li>
            <li>
              {t("Sentences: {correct}/{total}", {
                correct: evaluation.fillIn.correct,
                total: evaluation.fillIn.total,
              })}
            </li>
            <li>{t("Writing: {score}/100", { score: evaluation.writing.score })}</li>
          </ul>
          <p className="text-xs text-ink-soft">{evaluation.writing.feedback}</p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("Close")}
          </Button>
        </div>
      )}
    </UiCard>
  );
}
