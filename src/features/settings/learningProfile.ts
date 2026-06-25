import type { EnglishLevel } from "@/features/discover/types";
import { MAX_GOAL, MIN_GOAL, setWeeklyGoal } from "@/features/study/weeklyGoal";

const PROFILE_KEY = "phraseloop.learningProfile.v1";

export interface LearningProfile {
  level: EnglishLevel;
  focus: string;
  goal: number;
  createdAt: number;
  onboardingCompleted: boolean;
}

export const DEFAULT_LEARNING_PROFILE: LearningProfile = {
  level: "B2",
  focus: "",
  goal: 3,
  createdAt: 0,
  onboardingCompleted: false,
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

function levelOrDefault(level: unknown): EnglishLevel {
  return level === "A1" || level === "A2" || level === "B1" || level === "B2" || level === "C1" || level === "C2"
    ? level
    : DEFAULT_LEARNING_PROFILE.level;
}

function normalizeProfile(value: unknown): LearningProfile {
  const raw = value && typeof value === "object" ? (value as Partial<LearningProfile>) : {};
  const createdAt = typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  return {
    level: levelOrDefault(raw.level),
    focus: typeof raw.focus === "string" ? raw.focus.trim() : "",
    goal: clampGoal(raw.goal),
    createdAt,
    onboardingCompleted: raw.onboardingCompleted === true,
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
  const next = normalizeProfile({
    ...current,
    ...profile,
    createdAt: profile.createdAt ?? (current.createdAt || Date.now()),
  });
  const s = storage();
  if (s) s.setItem(PROFILE_KEY, JSON.stringify(next));
  setWeeklyGoal(next.goal);
  return next;
}

export function isOnboardingComplete(): boolean {
  return getLearningProfile().onboardingCompleted;
}

export function completeOnboarding(profile: Partial<LearningProfile>): LearningProfile {
  return saveLearningProfile({
    ...profile,
    onboardingCompleted: true,
    createdAt: profile.createdAt ?? Date.now(),
  });
}
