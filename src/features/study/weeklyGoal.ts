/**
 * The weekly exposure goal (Phase 3). A single, gentle, editable number: how many
 * conversations the learner aims to hold per week. Stored in localStorage — it's a UI
 * preference, not learning data, so it doesn't need the IndexedDB store / a migration.
 */

const KEY = "phraseloop.weeklyGoal";
export const DEFAULT_WEEKLY_GOAL = 3;
export const MIN_GOAL = 1;
export const MAX_GOAL = 30;

export function getWeeklyGoal(): number {
  if (typeof localStorage === "undefined") return DEFAULT_WEEKLY_GOAL;
  const raw = Number(localStorage.getItem(KEY));
  return Number.isFinite(raw) && raw >= MIN_GOAL ? Math.min(raw, MAX_GOAL) : DEFAULT_WEEKLY_GOAL;
}

/** Persist a clamped goal and return the value actually stored. */
export function setWeeklyGoal(n: number): number {
  const clamped = Math.max(MIN_GOAL, Math.min(MAX_GOAL, Math.round(n)));
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, String(clamped));
  return clamped;
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
