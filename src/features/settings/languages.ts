/** Languages threaded through card-generation prompts and API routes. */
export interface Language {
  code: string;
  label: string;
}

export const TARGET_LANGUAGES: Language[] = [
  { code: "en", label: "English" },
];

export const NATIVE_LANGUAGES: Language[] = [
  { code: "pt", label: "Portuguese" },
];

export const LANGUAGES: Language[] = [
  ...TARGET_LANGUAGES,
  ...NATIVE_LANGUAGES,
];

export function isLanguageCode(code: unknown): code is string {
  return typeof code === "string" && LANGUAGES.some((l) => l.code === code);
}

export function isNativeLanguageCode(code: unknown): code is string {
  return typeof code === "string" && NATIVE_LANGUAGES.some((l) => l.code === code);
}

export function isTargetLanguageCode(code: unknown): code is string {
  return typeof code === "string" && TARGET_LANGUAGES.some((l) => l.code === code);
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
