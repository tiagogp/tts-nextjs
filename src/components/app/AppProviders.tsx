"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { AiSettingsProvider } from "@/features/settings/context/AiSettingsContext";
import { TtsSettingsProvider } from "@/features/speech/context/TtsSettingsContext";
import { I18nProvider } from "@/i18n/I18nProvider";

export default function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <AiSettingsProvider>
          <TtsSettingsProvider>{children}</TtsSettingsProvider>
        </AiSettingsProvider>
      </I18nProvider>
    </MotionConfig>
  );
}
