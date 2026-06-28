import type { EnglishLevel } from "./types";

export const LEVEL_RANK: Record<EnglishLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

export function isLevelAtLeast(level: EnglishLevel, minimum: EnglishLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minimum];
}
