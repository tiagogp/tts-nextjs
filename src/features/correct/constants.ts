import type { ErrorType } from "@/lib/cards/schema";
import type { CorrectionInputMode } from "./types";

/** Max size for an uploaded audio clip handed to Whisper (25 MB). */
export const MAX_CORRECTION_UPLOAD_BYTES = 25 * 1024 * 1024;

export const CORRECTION_INPUT_OPTIONS: { value: CorrectionInputMode; label: string }[] = [
  { value: "ai", label: "AI review" },
  { value: "manual", label: "Manual entry" },
];

export const CORRECTION_ERROR_TYPES: ErrorType[] = [
  "collocation",
  "preposition",
  "tense",
  "article",
  "word-order",
  "idiom",
  "vocabulary",
  "register",
  "missing-information",
  "pronunciation",
  "other",
];
