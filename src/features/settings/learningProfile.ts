import type { EnglishLevel } from "@/features/discover/types";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import {
  isNativeLanguageCode,
  isTargetLanguageCode,
} from "@/features/settings/languages";
import { MAX_GOAL, MIN_GOAL, setWeeklyGoal } from "@/features/study/weeklyGoal";

const PROFILE_KEY = "phraseloop.learningProfile.v1";

export type LearningTrack = "beginner" | "intermediate";

export interface LearningProfile {
  /** CEFR level of the language being learned (`targetLang`). */
  level: EnglishLevel;
  /** Learner's first language (L1) — Portuguese-only in the reduced scope. */
  nativeLang: string;
  /** Language being learned — English-only in the reduced scope. */
  targetLang: string;
  /** Beginner is the product track for the sub-B1 audience. */
  track: LearningTrack;
  focus: string;
  goal: number;
  createdAt: number;
  onboardingCompleted: boolean;
  /** Monotonic disclosure tier for app sections; once raised it never decreases. */
  unlockedTabTier: number;
}

export const DEFAULT_LEARNING_PROFILE: LearningProfile = {
  level: "A1",
  nativeLang: "pt",
  targetLang: "en",
  track: "beginner",
  focus: "",
  goal: 3,
  createdAt: 0,
  onboardingCompleted: false,
  unlockedTabTier: 0,
};

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function clampGoal(goal: unknown): number {
  const n = typeof goal === "number" ? goal : Number(goal);
  if (!Number.isFinite(n)) return DEFAULT_LEARNING_PROFILE.goal;
  return Math.max(MIN_GOAL, Math.min(MAX_GOAL, Math.round(n)));
}

function isEnglishLevel(level: unknown): level is EnglishLevel {
  return ENGLISH_LEVELS.some((option) => option.value === level);
}

function levelOrDefault(level: unknown): EnglishLevel {
  return isEnglishLevel(level) ? level : DEFAULT_LEARNING_PROFILE.level;
}

function nativeLangOrDefault(code: unknown): string {
  return isNativeLanguageCode(code) ? code : DEFAULT_LEARNING_PROFILE.nativeLang;
}

function targetLangOrDefault(code: unknown): string {
  return isTargetLanguageCode(code) ? code : DEFAULT_LEARNING_PROFILE.targetLang;
}

function trackOrDefault(track: unknown): LearningTrack {
  return track === "beginner"
    ? track
    : DEFAULT_LEARNING_PROFILE.track;
}

function unlockedTabTierOrDefault(tier: unknown): number {
  const n = typeof tier === "number" ? tier : Number(tier);
  if (!Number.isFinite(n)) return DEFAULT_LEARNING_PROFILE.unlockedTabTier;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

function normalizeProfile(value: unknown): LearningProfile {
  const raw = value && typeof value === "object" ? (value as Partial<LearningProfile>) : {};
  const createdAt = typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  return {
    level: levelOrDefault(raw.level),
    nativeLang: nativeLangOrDefault(raw.nativeLang),
    targetLang: targetLangOrDefault(raw.targetLang),
    track: trackOrDefault(raw.track),
    focus: typeof raw.focus === "string" ? raw.focus.trim() : "",
    goal: clampGoal(raw.goal),
    createdAt,
    onboardingCompleted: raw.onboardingCompleted === true,
    unlockedTabTier: unlockedTabTierOrDefault(raw.unlockedTabTier),
  };
}

export function getLearningProfile(): LearningProfile {
  const s = storage();
  if (!s) return { ...DEFAULT_LEARNING_PROFILE };
  try {
    const raw = s.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_LEARNING_PROFILE };
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LEARNING_PROFILE };
  }
}

export function saveLearningProfile(profile: Partial<LearningProfile>): LearningProfile {
  const current = getLearningProfile();
  const unlockedTabTier =
    profile.unlockedTabTier == null
      ? current.unlockedTabTier
      : Math.max(current.unlockedTabTier, unlockedTabTierOrDefault(profile.unlockedTabTier));
  const next = normalizeProfile({
    ...current,
    ...profile,
    unlockedTabTier,
    createdAt: profile.createdAt ?? (current.createdAt || Date.now()),
  });
  const s = storage();
  if (s) s.setItem(PROFILE_KEY, JSON.stringify(next));
  setWeeklyGoal(next.goal);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("phraseloop:profile-updated"));
  }
  return next;
}

export function isOnboardingComplete(): boolean {
  return getLearningProfile().onboardingCompleted;
}

/** The native/target language codes + level, threaded into card generation,
 * correction, and conversation requests. */
export function getLearnerLangs(): { nativeLang: string; targetLang: string; level: EnglishLevel } {
  const p = getLearningProfile();
  return { nativeLang: p.nativeLang, targetLang: p.targetLang, level: p.level };
}

export function completeOnboarding(profile: Partial<LearningProfile>): LearningProfile {
  return saveLearningProfile({
    ...profile,
    onboardingCompleted: true,
    createdAt: profile.createdAt ?? Date.now(),
  });
}
