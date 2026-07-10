"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Notice";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { languageLabel } from "@/features/settings/languages";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { generateAndSavePlan } from "@/features/plan/generator";
import type { LearningPlan } from "@/features/plan/schema";
import {
  AVAILABILITY_OPTIONS,
  PLAN_DAYS_OPTIONS,
  TARGET_LEVELS,
} from "@/features/plan/constants";
import type { PlanOnboardingStep } from "@/features/plan/types";
import { useT } from "@/i18n/I18nProvider";

interface PlanOnboardingProps {
  open: boolean;
  onClose: () => void;
  onPlanCreated: (plan: LearningPlan) => void;
  onOpenSettings?: () => void;
}

function levelIndex(level: EnglishLevel): number {
  return ENGLISH_LEVELS.findIndex((option) => option.value === level);
}

function defaultTargetLevel(currentLevel: EnglishLevel): EnglishLevel {
  const index = levelIndex(currentLevel);
  return ENGLISH_LEVELS[Math.min(index + 1, ENGLISH_LEVELS.length - 1)]?.value ?? "B1";
}

export function PlanOnboarding({
  open,
  onClose,
  onPlanCreated,
  onOpenSettings,
}: PlanOnboardingProps) {
  const { t } = useT();
  const profile = getLearningProfile();
  const { provider, activeProvider, hasEvaluator, selectedModel } =
    useProviderSelection({
      fallbackToEvaluator: true,
    });

  const [step, setStep] = useState<PlanOnboardingStep>("goal");
  const [goal, setGoal] = useState("");
  const [currentLevel, setCurrentLevel] = useState<EnglishLevel>(profile.level);
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>(() => defaultTargetLevel(profile.level));
  const [planDays, setPlanDays] = useState(90);
  const [availabilityMinutes, setAvailabilityMinutes] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const goalTrimmed = goal.trim();
  const canGenerate = goalTrimmed.length >= 10 && hasEvaluator;
  const updateCurrentLevel = (nextLevel: EnglishLevel) => {
    setCurrentLevel(nextLevel);
    setTargetLevel((currentTarget) =>
      levelIndex(currentTarget) < levelIndex(nextLevel)
        ? defaultTargetLevel(nextLevel)
        : currentTarget,
    );
  };

  const generate = async () => {
    if (!canGenerate) return;
    setStep("generating");
    setError(null);
    try {
      const plan = await generateAndSavePlan({
        meta: {
          goal: goalTrimmed,
          currentLevel,
          targetLevel,
          availabilityMinutes,
          planDays,
          language: languageLabel(profile.targetLang),
        },
        provider,
        ollamaModel: selectedModel,
      });
      onPlanCreated(plan);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t("Couldn't generate the plan. Try again."),
      );
      setStep("availability");
    }
  };

  const handleClose = () => {
    if (step === "generating") return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      labelledBy="plan-onboarding-title"
      className="w-[min(100%,36rem)]"
    >
      {step !== "generating" && (
        <div className="mb-5 flex gap-1.5" aria-hidden="true">
          {(["goal", "availability"] as const).map((s) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s === "goal" || step === "availability"
                  ? "bg-accent"
                  : "bg-line"
              }`}
            />
          ))}
        </div>
      )}

      {step === "goal" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">
              {t("Learning plan")}
            </p>
            <h2
              id="plan-onboarding-title"
              className="mt-1 text-xl font-semibold text-ink"
            >
              {t("What do you want to achieve?")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {t("Be specific — the more concrete your goal, the more focused your daily tasks will be.")}
            </p>
          </div>

          <Field
            label={t("Your goal")}
            hint={t("{count} / 10 characters minimum", { count: goalTrimmed.length })}
          >
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("e.g. I want to watch Netflix shows in English without subtitles in 90 days")}
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Current level")}>
              <Select
                value={currentLevel}
                onChange={(v) => updateCurrentLevel(v as EnglishLevel)}
                options={ENGLISH_LEVELS}
              />
            </Field>
            <Field label={t("Target level")}>
              <Select
                value={targetLevel}
                onChange={(v) => setTargetLevel(v as EnglishLevel)}
                options={TARGET_LEVELS}
              />
            </Field>
          </div>

          {!hasEvaluator && (
            <Notice tone="error">
              {t("A model-backed AI provider is required to generate a plan.")}{" "}
              {onOpenSettings ? (
                <button
                  onClick={onOpenSettings}
                  className="underline hover:no-underline"
                >
                  {t("Open Settings →")}
                </button>
              ) : (
                t("Open Settings to connect one.")
              )}
            </Notice>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep("availability")}
              disabled={goalTrimmed.length < 10 || !hasEvaluator}
            >
              {t("Continue →")}
            </Button>
          </div>
        </div>
      )}

      {step === "availability" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">
              {t("Learning plan")}
            </p>
            <h2
              id="plan-onboarding-title"
              className="mt-1 text-xl font-semibold text-ink"
            >
              {t("How much time can you commit?")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {t("Be honest — a consistent 15 min beats an ambitious 1 hour that doesn't happen.")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Daily availability")}>
              <Select
                value={String(availabilityMinutes)}
                onChange={(v) => setAvailabilityMinutes(Number(v))}
                options={AVAILABILITY_OPTIONS.map((item) => ({ ...item, label: t(item.label) }))}
              />
            </Field>
            <Field label={t("Plan length")}>
              <Select
                value={String(planDays)}
                onChange={(v) => setPlanDays(Number(v))}
                options={PLAN_DAYS_OPTIONS.map((item) => ({ ...item, label: t(item.label) }))}
              />
            </Field>
          </div>

          <div className="rounded border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
            {t("The AI will create a {days}-day plan with {minutes} min of tasks per day, divided into phases that match your progress from {currentLevel} toward {targetLevel}.", {
              days: planDays,
              minutes: availabilityMinutes,
              currentLevel,
              targetLevel,
            })}
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          {hasEvaluator && (
            <p className="text-xs text-ink-muted">
              {t("Generated by {provider}.", { provider: activeProvider?.label ?? provider })}
            </p>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("goal")}>
              {t("Back")}
            </Button>
            <Button
              variant="primary"
              onClick={() => void generate()}
              disabled={!canGenerate}
            >
              {t("Generate my plan")}
            </Button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner className="h-8 w-8 text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">
              {t("Building your {days}-day plan…", { days: planDays })}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t("{provider} is designing your phases and daily tasks.", { provider: activeProvider?.label ?? t("The AI") })}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
