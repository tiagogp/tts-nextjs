import { DEFAULT_UI_LANG, type UiLang } from "./config";
import { messages } from "./messages";

export type TranslateVars = Record<string, string | number>;
const TRANSLATABLE_UI_LANGS = new Set<UiLang>(["pt"]);

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Translate an English source string into `lang`; falls back to the source. */
export function translate(lang: UiLang, en: string, vars?: TranslateVars): string {
  const resolved =
    lang === DEFAULT_UI_LANG || !TRANSLATABLE_UI_LANGS.has(lang)
      ? en
      : messages[en]?.[lang] ?? en;
  return interpolate(resolved, vars);
}
