import { applyTransferRules, type TransferRuleHit } from "@/features/learn/transferErrors";
import { contentOverlap, frameLemmas, usesFrame } from "@/lib/language/pattern";

/**
 * Offline verification of a transfer attempt.
 *
 * The app used to set `newContext: true` as a literal on the activity object and copy it
 * straight into the saved attempt, where the progress panel counted it as cross-context
 * reuse. That number therefore counted prompts displayed, not transfers achieved — and on
 * the offline path the success test was `usedPhrase`, so the app asked for a new situation
 * and then rewarded the learner for reusing the memorized sentence.
 *
 * Transfer is checkable without a model. It is three conditions, all necessary:
 *
 *   1. the target frame appears in the response;
 *   2. the content words are mostly not the source example's content words;
 *   3. no transfer rule fires on the response.
 *
 * When there is no frame to check against, the verdict is `unverifiable` — and an
 * unverifiable attempt is reported as an attempt, never as a success.
 */

export type TransferVerdict =
  /** Frame carried into genuinely new content, in valid English. */
  | "transferred"
  /** Frame present, but the learner rebuilt the sentence they were shown. */
  | "reused"
  /** The target structure is not in the response at all. */
  | "off_pattern"
  /** A named PT→EN transfer error in the response. */
  | "form_error"
  /** No pattern data on this item: the app cannot tell, and must not guess. */
  | "unverifiable";

/** Above this share of borrowed content words, the learner rebuilt rather than transferred. */
export const REUSE_THRESHOLD = 0.4;

export interface TransferCheck {
  verdict: TransferVerdict;
  /** True only for `transferred`. Never true for `unverifiable`. */
  transferred: boolean;
  /** Whether the app was able to reach a verdict at all. */
  verified: boolean;
  frameUsed?: boolean;
  /** Share of the response's own content words that came from the source example. */
  sourceOverlap?: number;
  formIssues: TransferRuleHit[];
}

export interface TransferCheckInput {
  response: string;
  /** Target frame with `___` for the slot. Absent on items with no authored pattern. */
  frame?: string;
  /** The sentence the learner originally studied, to measure content reuse against. */
  sourceExample?: string;
}

export function verifyTransfer({ response, frame, sourceExample }: TransferCheckInput): TransferCheck {
  const formIssues = applyTransferRules(response).hits;
  const frameUsed = usesFrame(response, frame);

  if (frameUsed === undefined) {
    // No frame authored for this item. Report the attempt, claim nothing about it.
    return { verdict: "unverifiable", transferred: false, verified: false, formIssues };
  }
  if (!frameUsed) {
    return { verdict: "off_pattern", transferred: false, verified: true, frameUsed, formIssues };
  }
  if (formIssues.length > 0) {
    return { verdict: "form_error", transferred: false, verified: true, frameUsed, formIssues };
  }

  // Frame words are shared by construction, so they are excluded before measuring reuse.
  const sourceOverlap = sourceExample
    ? contentOverlap(response, sourceExample, frameLemmas(frame ?? ""))
    : 0;
  if (sourceExample && sourceOverlap > REUSE_THRESHOLD) {
    return { verdict: "reused", transferred: false, verified: true, frameUsed, sourceOverlap, formIssues };
  }
  return { verdict: "transferred", transferred: true, verified: true, frameUsed, sourceOverlap, formIssues };
}

export interface TransferRate {
  /** Every attempt at a new-context prompt, verifiable or not. */
  attempts: number;
  /** Attempts the app could actually judge. */
  verified: number;
  /** Of the verified ones, those that carried the pattern into new content. */
  transferred: number;
  /**
   * `transferred / verified`, or null when nothing was verifiable. Null rather than zero,
   * for the same reason the unaided-production rate is: "not measured" is not "measured
   * and bad", and this is the number the product's central claim rests on.
   */
  rate: number | null;
}

export function transferRate(checks: Pick<TransferCheck, "verified" | "transferred">[]): TransferRate {
  const verified = checks.filter((check) => check.verified);
  const transferred = verified.filter((check) => check.transferred).length;
  return {
    attempts: checks.length,
    verified: verified.length,
    transferred,
    rate: verified.length === 0 ? null : transferred / verified.length,
  };
}
