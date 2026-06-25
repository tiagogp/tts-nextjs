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
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { generateAndSavePlan } from "@/features/plan/generator";
import type { LearningPlan } from "@/features/plan/schema";

const PLAN_DAYS_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
];

const AVAILABILITY_OPTIONS = [
  { value: "10", label: "10 min / day" },
  { value: "20", label: "20 min / day" },
  { value: "30", label: "30 min / day" },
  { value: "45", label: "45 min / day" },
  { value: "60", label: "1 hour / day" },
];

const TARGET_LEVELS = ENGLISH_LEVELS.filter((l) => l.value !== "A1");

type Step = "goal" | "availability" | "generating";

interface PlanOnboardingProps {
  open: boolean;
  onClose: () => void;
  onPlanCreated: (plan: LearningPlan) => void;
  onOpenSettings?: () => void;
}

export function PlanOnboarding({ open, onClose, onPlanCreated, onOpenSettings }: PlanOnboardingProps) {
  const profile = getLearningProfile();
  const { provider, activeProvider, hasEvaluator, selectedModel } = useProviderSelection({
    fallbackToEvaluator: true,
  });

  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState("");
  const [currentLevel, setCurrentLevel] = useState<EnglishLevel>(profile.level);
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>("B2");
  const [planDays, setPlanDays] = useState(90);
  const [availabilityMinutes, setAvailabilityMinutes] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const goalTrimmed = goal.trim();
  const canGenerate = goalTrimmed.length >= 10 && hasEvaluator;

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
          language: "English",
        },
        provider,
        ollamaModel: selectedModel,
      });
      onPlanCreated(plan);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't generate the plan. Try again.");
      setStep("availability");
    }
  };

  const handleClose = () => {
    if (step === "generating") return;
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} labelledBy="plan-onboarding-title" className="w-[min(100%,36rem)]">
      {step !== "generating" && (
        <div className="mb-5 flex gap-1.5" aria-hidden="true">
          {(["goal", "availability"] as const).map((s) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s === "goal" || step === "availability" ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>
      )}

      {step === "goal" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">Learning plan</p>
            <h2 id="plan-onboarding-title" className="mt-1 text-xl font-semibold text-ink">
              What do you want to achieve?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Be specific — the more concrete your goal, the more focused your daily tasks will be.
            </p>
          </div>

          <Field
            label="Your goal"
            hint={`${goalTrimmed.length} / 10 characters minimum`}
          >
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I want to watch Netflix shows in English without subtitles in 90 days"
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Current level">
              <Select
                value={currentLevel}
                onChange={(v) => setCurrentLevel(v as EnglishLevel)}
                options={ENGLISH_LEVELS}
              />
            </Field>
            <Field label="Target level">
              <Select
                value={targetLevel}
                onChange={(v) => setTargetLevel(v as EnglishLevel)}
                options={TARGET_LEVELS}
              />
            </Field>
          </div>

          {!hasEvaluator && (
            <Notice tone="error">
              A model-backed AI provider is required to generate a plan.{" "}
              {onOpenSettings ? (
                <button onClick={onOpenSettings} className="underline hover:no-underline">
                  Open Settings →
                </button>
              ) : (
                "Open Settings to connect one."
              )}
            </Notice>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep("availability")}
              disabled={goalTrimmed.length < 10 || !hasEvaluator}
            >
              Continue →
            </Button>
          </div>
        </div>
      )}

      {step === "availability" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">Learning plan</p>
            <h2 id="plan-onboarding-title" className="mt-1 text-xl font-semibold text-ink">
              How much time can you commit?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Be honest — a consistent 15 min beats an ambitious 1 hour that doesn't happen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily availability">
              <Select
                value={String(availabilityMinutes)}
                onChange={(v) => setAvailabilityMinutes(Number(v))}
                options={AVAILABILITY_OPTIONS}
              />
            </Field>
            <Field label="Plan length">
              <Select
                value={String(planDays)}
                onChange={(v) => setPlanDays(Number(v))}
                options={PLAN_DAYS_OPTIONS}
              />
            </Field>
          </div>

          <div className="rounded border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
            The AI will create a {planDays}-day plan with {availabilityMinutes} min of tasks per day,
            divided into phases that match your progress from {currentLevel} toward {targetLevel}.
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          {hasEvaluator && (
            <p className="text-xs text-ink-muted">
              Generated by {activeProvider?.label ?? provider}.
            </p>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("goal")}>
              Back
            </Button>
            <Button variant="primary" onClick={() => void generate()} disabled={!canGenerate}>
              Generate my plan
            </Button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner className="h-8 w-8 text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Building your {planDays}-day plan…</p>
            <p className="mt-1 text-xs text-ink-muted">
              {activeProvider?.label ?? "The AI"} is designing your phases and daily tasks.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
