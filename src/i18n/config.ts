import { isLevelAtLeast } from "@/features/discover/levels";
import type { LearningProfile } from "@/features/settings/learningProfile";

/** Language the interface chrome is rendered in. Defaults to English. */
export type UiLang = string;

export const DEFAULT_UI_LANG: UiLang = "en";

/**
 * Below B1 (A1/A2), Portuguese learners get Portuguese scaffolding. From B1 up,
 * and for any non-Portuguese legacy profile, the app stays in English.
 */
export function resolveInterfaceLang(profile: Pick<LearningProfile, "level" | "nativeLang">): UiLang {
  if (isLevelAtLeast(profile.level, "B1")) return DEFAULT_UI_LANG;
  return profile.nativeLang === "pt" ? "pt" : DEFAULT_UI_LANG;
}
