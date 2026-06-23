import type { DiscoverSourceKind, EnglishLevel } from "@/features/discover/types";
import { DECK_GENERATION_TIMEOUT_MS } from "@/features/cards/constants";

export const SOURCE_KINDS: { kind: DiscoverSourceKind; label: string }[] = [
  { kind: "youtube", label: "YouTube" },
  { kind: "article", label: "Article / URL" },
  { kind: "pdf", label: "PDF" },
];

export const ENGLISH_LEVELS: { value: EnglishLevel; label: string }[] = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
];

export const GENERATION_TIMEOUT_MS = DECK_GENERATION_TIMEOUT_MS;
