"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { AiSettingsProvider } from "@/features/settings/context/AiSettingsContext";
import { TtsSettingsProvider } from "@/features/speech/context/TtsSettingsContext";

export default function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <MotionConfig reducedMotion="user">
      <AiSettingsProvider>
        <TtsSettingsProvider>{children}</TtsSettingsProvider>
      </AiSettingsProvider>
    </MotionConfig>
  );
}
