"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { AiSettingsProvider } from "@/features/settings/context/AiSettingsContext";
import { TtsSettingsProvider } from "@/features/speech/context/TtsSettingsContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { UiLang } from "@/i18n/config";

export default function AppProviders({
  children,
  lang,
}: Readonly<{ children: ReactNode; lang?: UiLang }>) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <I18nProvider lang={lang}>
          <AiSettingsProvider>
            <TtsSettingsProvider>{children}</TtsSettingsProvider>
          </AiSettingsProvider>
        </I18nProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
