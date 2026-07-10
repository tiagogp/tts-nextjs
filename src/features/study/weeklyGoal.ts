/**
 * The weekly exposure goal (Phase 3). A single, gentle, editable number: how many
 * conversations the learner aims to hold per week. Stored in localStorage — it's a UI
 * preference, not learning data, so it doesn't need the IndexedDB store / a migration.
 */

const KEY = "phraseloop.weeklyGoal";
const CHANGE_EVENT = "phraseloop:weekly-goal";
export const DEFAULT_WEEKLY_GOAL = 3;
export const MIN_GOAL = 1;
export const MAX_GOAL = 30;
let fallbackGoal = DEFAULT_WEEKLY_GOAL;
let shouldUseFallbackGoal = false;

export function getWeeklyGoal(): number {
  if (typeof localStorage === "undefined") return DEFAULT_WEEKLY_GOAL;
  if (shouldUseFallbackGoal) return fallbackGoal;
  try {
    const raw = Number(localStorage.getItem(KEY));
    return Number.isFinite(raw) && raw >= MIN_GOAL ? Math.min(raw, MAX_GOAL) : DEFAULT_WEEKLY_GOAL;
  } catch {
    return fallbackGoal;
  }
}

/** Persist a clamped goal and return the value actually stored. */
export function setWeeklyGoal(n: number): number {
  const clamped = Math.max(MIN_GOAL, Math.min(MAX_GOAL, Math.round(n)));
  fallbackGoal = clamped;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, String(clamped));
    shouldUseFallbackGoal = false;
  } catch {
    shouldUseFallbackGoal = true;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
  return clamped;
}

export function subscribeWeeklyGoal(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onWeeklyGoalChange = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onStoreChange();
  };
  window.addEventListener(CHANGE_EVENT, onWeeklyGoalChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onWeeklyGoalChange);
    window.removeEventListener("storage", onStorage);
  };
}

export type ExposureZone = "building" | "in-zone" | "strong";

/**
 * Calibration band, framed gently (the goal is "right amount of challenge", not a quota):
 * below goal = building up, at/above = in the zone, well past (>2×) = a big week.
 */
export function exposureZone(conversations: number, goal: number): ExposureZone {
  if (conversations < goal) return "building";
  if (conversations <= goal * 2) return "in-zone";
  return "strong";
}
