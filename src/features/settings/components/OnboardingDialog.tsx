"use client";

import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { completeOnboarding, getLearningProfile, isOnboardingComplete } from "@/features/settings/learningProfile";
import { MAX_GOAL, MIN_GOAL } from "@/features/study/weeklyGoal";

const subscribe = () => () => {};
type Step = "welcome" | "profile" | "method";
const STEPS: Step[] = ["welcome", "profile", "method"];

const GOAL_OPTIONS = [
  { value: "travel", label: "Travel" },
  { value: "work", label: "Work" },
  { value: "conversation", label: "Conversation" },
  { value: "media", label: "Movies & podcasts" },
] as const;

export default function OnboardingDialog({ onOpenSettings }: Readonly<{ onOpenSettings: () => void }>) {
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [profile] = useState(getLearningProfile);
  const [level, setLevel] = useState<EnglishLevel>(profile.level);
  const [goal, setGoal] = useState(profile.goal);
  const [focusPreset, setFocusPreset] = useState<(typeof GOAL_OPTIONS)[number]["value"]>("conversation");
  const [customFocus, setCustomFocus] = useState(profile.focus);
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => !isOnboardingComplete(),
    () => false,
  );
  const open = firstVisit && !dismissed;

  const finish = (openSettings: boolean) => {
    const focus = customFocus.trim() || GOAL_OPTIONS.find((item) => item.value === focusPreset)?.label || "";
    completeOnboarding({ level, focus, goal });
    setDismissed(true);
    if (openSettings) onOpenSettings();
  };

  const currentIndex = STEPS.indexOf(step);
  const canGoBack = currentIndex > 0;
  const canContinue = currentIndex < STEPS.length - 1;
  const updateGoal = (next: number) => setGoal(Math.max(MIN_GOAL, Math.min(MAX_GOAL, next)));

  return (
    <Modal open={open} onClose={() => finish(false)} labelledBy="welcome-title" className="w-[min(100%,34rem)]">
      <div className="mb-5 flex gap-1.5" aria-hidden="true">
        {STEPS.map((item) => (
          <span
            key={item}
            className={`h-1.5 flex-1 rounded-full ${STEPS.indexOf(item) <= currentIndex ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      {step === "welcome" && (
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Welcome</p>
          <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
            Learn with a loop, not a pile of cards
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            PhraseLoop turns real English, your writing, and your speaking into one daily routine: capture,
            remember, produce, then reinforce what is still weak.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MethodTile title="Real input" text="Mine useful language from videos, articles, and PDFs." />
            <MethodTile title="Active recall" text="Generate focused cards that test understanding." />
            <MethodTile title="Output" text="Practice speaking or correct what you wrote." />
            <MethodTile title="Reinforcement" text="Let weak spots decide the next drill." />
          </div>
        </div>
      )}

      {step === "profile" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">Your routine</p>
            <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
              Calibrate the first week
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              These choices only guide defaults. You can change them while working.
            </p>
          </div>
          <Field label="English level">
            <Select
              value={level}
              onChange={(value) => setLevel(value as EnglishLevel)}
              options={ENGLISH_LEVELS}
            />
          </Field>
          <Field label="Main goal">
            <Segmented
              label="Main learning goal"
              value={focusPreset}
              onChange={setFocusPreset}
              variant="fill"
              options={GOAL_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Field>
          <Field label="Focus" hint="Used to prefill Discover curation.">
            <Input
              value={customFocus}
              onChange={(event) => setCustomFocus(event.target.value)}
              placeholder="phrasal verbs, meetings, travel situations..."
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Weekly conversation goal</p>
            <div className="flex items-center gap-3 rounded border border-line bg-surface px-3 py-2">
              <button
                type="button"
                onClick={() => updateGoal(goal - 1)}
                disabled={goal <= MIN_GOAL}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-line text-ink-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease weekly goal"
              >
                -
              </button>
              <span className="flex-1 text-center text-sm tabular-nums text-ink">
                {goal} conversation{goal === 1 ? "" : "s"} per week
              </span>
              <button
                type="button"
                onClick={() => updateGoal(goal + 1)}
                disabled={goal >= MAX_GOAL}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-line text-ink-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Increase weekly goal"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "method" && (
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">The method</p>
          <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
            Your dashboard will pick the next move
          </h2>
          <ol className="mt-5 space-y-4 text-sm">
            <MethodStep n="1" title="Capture one source" text="Keep a small batch from real material instead of collecting everything." />
            <MethodStep n="2" title="Review what is due" text="Spaced repetition protects yesterday's work before adding more." />
            <MethodStep n="3" title="Produce language" text="Conversation and corrections reveal what you cannot use yet." />
            <MethodStep n="4" title="Reinforce weak spots" text="The app turns repeated struggles into focused drills and fresh variants." />
          </ol>
          <p className="mt-5 text-xs text-ink-muted">
            Local providers keep content on your machine. Cloud providers are only used when you choose them.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep(STEPS[currentIndex - 1])}
          disabled={!canGoBack}
        >
          Back
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {canContinue ? (
            <Button variant="primary" onClick={() => setStep(STEPS[currentIndex + 1])}>
              Continue
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => finish(false)}>
                Start with Discover
              </Button>
              <Button variant="primary" onClick={() => finish(true)}>
                Set up AI first →
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MethodTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-line bg-surface px-3 py-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{text}</p>
    </div>
  );
}

function MethodStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
        {n}
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-ink-soft">{text}</p>
      </div>
    </li>
  );
}
