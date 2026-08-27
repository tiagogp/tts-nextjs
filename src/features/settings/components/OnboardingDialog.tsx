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
  type MethodObjective,
} from "@/features/settings/learningProfile";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { useT } from "@/i18n/I18nProvider";
import { nextLevelOf } from "@/features/levelup/model";
import { LevelTestFlow } from "@/features/levelup/components/LevelTestFlow";
import { LocalPlacementCheck } from "@/features/levelup/components/LocalPlacementCheck";

const subscribe = () => () => {};
type Step = "level" | "welcome" | "profile" | "ai";
/**
 * The AI step is last so that "Connect an AI" can save the profile and hand the learner
 * straight to Settings, and so the choice is made after they know what the app is for.
 */
const STEPS: Step[] = ["level", "welcome", "profile", "ai"];

/** `objective` drives the method's study distribution; `label` is display/prompt text
 * only. Keep them separate — a translated label must never change the distribution. */
const GOAL_OPTIONS: readonly { objective: MethodObjective; label: string }[] = [
  { objective: "conversation", label: "Conversation" },
  { objective: "travel", label: "Travel" },
  { objective: "professional", label: "Work" },
  { objective: "academic", label: "Study & exams" },
  { objective: "media", label: "Movies & podcasts" },
];

export default function OnboardingDialog({ onOpenSettings }: Readonly<{ onOpenSettings: () => void }>) {
  const { t } = useT();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("level");
  const [levelCheckOpen, setLevelCheckOpen] = useState<"local" | "ai" | null>(null);
  const [profile] = useState(getLearningProfile);
  const [level, setLevel] = useState<EnglishLevel>(profile.level);
  const [nativeLang, setNativeLang] = useState(profile.nativeLang);
  const [objective, setObjective] = useState<MethodObjective>(profile.objective);
  const { settings } = useAiSettings();
  const defaultProvider = settings.providers.find((provider) => provider.kind === settings.defaultProvider);
  // Any usable provider, not just the default one: the question here is whether the method
  // can run whole, not which model happens to be preferred.
  const aiReady = settings.providers.some((provider) => provider.available);
  const levelCheckTarget = nextLevelOf(level);
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => !isOnboardingComplete(),
    () => false,
  );
  const open = firstVisit && !dismissed;

  const languageOptions = NATIVE_LANGUAGES.map((l) => ({ value: l.code, label: t(l.label) }));

  const finish = async () => {
    const focus = GOAL_OPTIONS.find((item) => item.objective === objective)?.label ?? "";
    completeOnboarding({
      track: "beginner",
      level,
      nativeLang,
      targetLang: "en",
      objective,
      focus,
      goal: profile.goal,
    });
    setDismissed(true);
  };

  const currentIndex = STEPS.indexOf(step);
  const canGoBack = currentIndex > 0;
  const canContinue = currentIndex < STEPS.length - 1;

  if (levelCheckOpen === "local") {
    return (
      <Modal open={open} onClose={() => void finish()} labelledBy="welcome-title" className="w-[min(100%,34rem)]">
        <LocalPlacementCheck
          translate={t}
          onAccept={(suggested) => {
            setLevel(suggested);
            setLevelCheckOpen(null);
          }}
          onClose={() => setLevelCheckOpen(null)}
        />
      </Modal>
    );
  }

  if (levelCheckOpen === "ai" && levelCheckTarget) {
    return (
      <Modal open={open} onClose={() => void finish()} labelledBy="welcome-title" className="w-[min(100%,34rem)]">
        <LevelTestFlow
          currentLevel={level}
          targetLevel={levelCheckTarget}
          focusGaps={[]}
          onClose={() => {
            // The test may have advanced the profile level (on a pass) — re-sync the
            // onboarding form so "Start first lesson" saves the level the test confirmed.
            setLevel(getLearningProfile().level);
            setLevelCheckOpen(null);
          }}
        />
      </Modal>
    );
  }

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

      {step === "level" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{t("Your level")}</p>
            <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
              {t("Choose your English level first")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {t("This helps PhraseLoop start with phrases that are useful without being too easy.")}
            </p>
          </div>
          <Field label={t("Level")}>
            <Select
              value={level}
              onChange={(value) => setLevel(value as EnglishLevel)}
              options={ENGLISH_LEVELS}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* The local check needs no provider, so "not sure" is never a dead end. */}
              <button
                type="button"
                onClick={() => setLevelCheckOpen("local")}
                className="cursor-pointer text-xs font-medium text-accent hover:opacity-80"
              >
                {t("Not sure? Take a 5-minute check")}
              </button>
              {levelCheckTarget && defaultProvider?.available === true && (
                <button
                  type="button"
                  onClick={() => setLevelCheckOpen("ai")}
                  className="cursor-pointer text-xs font-medium text-ink-muted hover:opacity-80"
                >
                  {t("Or take the full {level} test with AI", { level: levelCheckTarget })}
                </button>
              )}
            </div>
          </Field>
        </div>
      )}

      {step === "welcome" && (
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{t("Welcome")}</p>
          <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
            {t("Start with one short lesson")}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {t("Listen, save one useful phrase, and use it in a sentence of your own.")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MethodTile title={t("Listen")} text={t("Hear a phrase in context.")} />
            <MethodTile title={t("Save")} text={t("Keep a phrase you want to review.")} />
            <MethodTile title={t("Speak")} text={t("Say the phrase in your own voice.")} />
            <MethodTile title={t("Write")} text={t("Use the phrase in an English sentence.")} />
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
          <Field label={t("Main goal")}>
            <Segmented
              label={t("Main goal")}
              value={objective}
              onChange={setObjective}
              variant="fill"
              options={GOAL_OPTIONS.map((item) => ({
                value: item.objective,
                label: t(item.label),
              }))}
            />
          </Field>
        </div>
      )}

      {step === "ai" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{t("AI")}</p>
            <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
              {aiReady ? t("An AI is connected") : t("Connect an AI to get the whole method")}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {aiReady
                ? t("PhraseLoop will use it to judge open answers, build listening checks from what you import, and give focused feedback.")
                : t("PhraseLoop was built to work with an AI, not around one. It is what judges an open answer, writes a listening check from a video you import, and tells you which two mistakes matter.")}
            </p>
          </div>

          {/* Naming what still works without AI is the honest half of asking for one — and
              naming what does not is the other half. Neither list is marketing. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodTile
              title={t("Works without AI")}
              text={t("Guided lessons, spaced review, pattern drills, transfer checks and the retention proof all run on your device.")}
            />
            <MethodTile
              title={t("Needs an AI")}
              text={t("Open answers judged for meaning, free conversation, mining phrases from your own content, and listening checks on unfamiliar voices.")}
            />
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">
            {t("A cloud AI receives the practice content you send it — phrases, mistakes, conversations. A local AI (Ollama) keeps everything on this machine. You choose which, and you can change it later.")}
          </p>
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
              {!aiReady && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void finish();
                    onOpenSettings();
                  }}
                >
                  {t("Connect an AI")}
                </Button>
              )}
              <Button variant="primary" onClick={() => void finish()}>
                {aiReady ? t("Start first lesson") : t("Start without AI for now")}
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
