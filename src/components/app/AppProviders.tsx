"use client";

import type { ReactNode } from "react";
import { AiSettingsProvider } from "@/features/settings/context/AiSettingsContext";
import { TtsSettingsProvider } from "@/features/speech/context/TtsSettingsContext";

export default function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AiSettingsProvider>
      <TtsSettingsProvider>{children}</TtsSettingsProvider>
    </AiSettingsProvider>
  );
}
