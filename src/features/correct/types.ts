import type { ErrorType } from "@/lib/cards/schema";

export type CorrectionInputMode = "ai" | "manual" | "json";

export interface CorrectionDraft {
  original: string;
  corrected: string;
  errorTypes: ErrorType[];
  rationale: string;
}
