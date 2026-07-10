"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  readLandingLanguage,
  saveLandingLanguage,
  subscribeLandingLanguage,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";

const LANDING_METADATA = {
  pt: {
    language: "pt-BR",
    title: "PhraseLoop — inglês real vira prática",
    description:
      "Transforme vídeos em cards com o áudio original e os seus próprios erros no treino de amanhã.",
  },
  en: {
    language: "en",
    title: "PhraseLoop — turn real English into practice",
    description:
      "Turn videos into cards with the original audio and your own mistakes into tomorrow's practice.",
  },
} as const;

export function useLandingLanguage() {
  const language = useSyncExternalStore(
    subscribeLandingLanguage,
    readLandingLanguage,
    (): LandingLanguage => "pt",
  );

  useEffect(() => {
    const metadata = LANDING_METADATA[language];
    document.documentElement.lang = metadata.language;
    document.title = metadata.title;

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) description.content = metadata.description;
  }, [language]);

  const changeLanguage = useCallback((next: LandingLanguage) => {
    saveLandingLanguage(next);
  }, []);

  return { language, changeLanguage };
}
