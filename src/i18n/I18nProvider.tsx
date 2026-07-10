"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { DEFAULT_UI_LANG, resolveInterfaceLang, type UiLang } from "./config";
import { interpolate, translate, type TranslateVars } from "./translate";

export type { TranslateVars };

interface I18nValue {
  lang: UiLang;
  /** Translate an English source string; falls back to the source when untranslated. */
  t: (en: string, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("phraseloop:profile-updated", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("phraseloop:profile-updated", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useInterfaceLang(): UiLang {
  return useSyncExternalStore(
    subscribe,
    () => resolveInterfaceLang(getLearningProfile()),
    () => DEFAULT_UI_LANG,
  );
}

export function I18nProvider({
  children,
  lang: forcedLang,
}: {
  children: ReactNode;
  lang?: UiLang;
}) {
  const profileLang = useInterfaceLang();
  const lang = forcedLang ?? profileLang;

  const t = useCallback(
    (en: string, vars?: TranslateVars): string => translate(lang, en, vars),
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback for components rendered outside the provider (tests, isolated mounts).
  return {
    lang: DEFAULT_UI_LANG,
    t: (en, vars) => interpolate(en, vars),
  };
}
