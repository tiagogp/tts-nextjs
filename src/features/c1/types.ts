import type { ErrorEvent, RefinementEvent } from "@/lib/cards/schema";

/**
 * One writing-sample check: the C1 diagnosis instrument from docs/product.md.
 * `errors`/`refinements` come straight from provider.review() (AdvancedReview) — this record
 * just preserves the evidence (original -> corrected/suggested) alongside the domain it was
 * written for, so a later session can show "what's still weak" instead of a bare score.
 */
export interface C1Diagnosis {
  id: string;
  domain: string;
  sampleText: string;
  errors: ErrorEvent[];
  refinements: RefinementEvent[];
  createdAt: number;
}
