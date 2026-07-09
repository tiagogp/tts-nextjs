"use client";

import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { NATIVE_LANGUAGES } from "@/features/settings/languages";
import {
  completeOnboarding,
  getLearningProfile,
  isOnboardingComplete,
} from "@/features/settings/learningProfile";
import { resolveInterfaceLang } from "@/i18n/config";
import { translate } from "@/i18n/translate";

const subscribe = () => () => {};
type Step = "welcome" | "profile";
const STEPS: Step[] = ["welcome", "profile"];

const GOAL_OPTIONS = [
  { value: "travel", label: "Travel" },
  { value: "work", label: "Work" },
  { value: "conversation", label: "Conversation" },
  { value: "media", label: "Movies & podcasts" },
] as const;

export default function OnboardingDialog({ onOpenSettings: _onOpenSettings }: Readonly<{ onOpenSettings: () => void }>) {
  void _onOpenSettings;
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [profile] = useState(getLearningProfile);
  const [level, setLevel] = useState<EnglishLevel>(profile.level);
  const [nativeLang, setNativeLang] = useState(profile.nativeLang);
  const [focusPreset, setFocusPreset] = useState<(typeof GOAL_OPTIONS)[number]["value"]>("conversation");
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => !isOnboardingComplete(),
    () => false,
  );
  const open = firstVisit && !dismissed;

  // Localize the dialog live so sub-B1 Portuguese learners can read it before
  // the profile is even saved.
  const uiLang = resolveInterfaceLang({ level, nativeLang });
  const t = (en: string, vars?: Record<string, string | number>) => translate(uiLang, en, vars);
  const languageOptions = NATIVE_LANGUAGES.map((l) => ({ value: l.code, label: t(l.label) }));

  const finish = async () => {
    const focus = GOAL_OPTIONS.find((item) => item.value === focusPreset)?.label || "";
    completeOnboarding({
      track: "beginner",
      level,
      nativeLang,
      targetLang: "en",
      focus,
      goal: profile.goal,
    });
    setDismissed(true);
  };

  const currentIndex = STEPS.indexOf(step);
  const canGoBack = currentIndex > 0;
  const canContinue = currentIndex < STEPS.length - 1;

  return (
    <Modal open={open} onClose={() => void finish()} labelledBy="welcome-title" className="w-[min(100%,34rem)]">
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
          <p className="text-xs uppercase tracking-widest text-accent">{t("Welcome")}</p>
          <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
            {t("The audio is real. So are your mistakes.")}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {t(
              "Paste a YouTube video. In 2 minutes, the best phrases become review cards with the original audio — and your own mistakes become tomorrow's practice.",
            )}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MethodTile title={t("Original audio")} text={t("Import a video and each phrase keeps its original audio, cut straight from the source.")} />
            <MethodTile title={t("Daily review")} text={t("Review a few practice phrases each day.")} />
            <MethodTile title={t("Your own mistakes")} text={t("Correct one phrase you wrote — it becomes tomorrow's practice.")} />
          </div>
        </div>
      )}

      {step === "profile" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{t("Your routine")}</p>
            <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
              {t("Calibrate the first week")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {t("Three choices are enough to start. You can tune the rest later.")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Your language")}>
              <Select
                value={nativeLang}
                onChange={setNativeLang}
                options={languageOptions}
              />
            </Field>
            <Field label={t("Learning")}>
              <div className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink-soft">
                {t("English")}
              </div>
            </Field>
          </div>
          <Field label={t("Level")}>
            <Select
              value={level}
              onChange={(value) => setLevel(value as EnglishLevel)}
              options={ENGLISH_LEVELS}
            />
          </Field>
          <Field label={t("Main goal")}>
            <Segmented
              label={t("Main goal")}
              value={focusPreset}
              onChange={setFocusPreset}
              variant="fill"
              options={GOAL_OPTIONS.map((item) => ({ value: item.value, label: t(item.label) }))}
            />
          </Field>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep(STEPS[currentIndex - 1])}
          disabled={!canGoBack}
        >
          {t("Back")}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {canContinue ? (
            <Button variant="primary" onClick={() => setStep(STEPS[currentIndex + 1])}>
              {t("Continue")}
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => void finish()}>
                {t("Start first lesson")}
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
