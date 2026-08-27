import { applyTransferRules, type TransferRuleHit } from "@/features/learn/transferErrors";
import { contentLemmas, tokenize } from "@/lib/language/pattern";

/**
 * What a device can honestly say about a genuinely open answer.
 *
 * Transfer on a *patterned* item is verifiable offline — `verifyTransfer` does it. An open
 * task ("you arrived late to a meeting; explain") has no target string, no frame, and a
 * prompt the learner may be reading in Portuguese, so there is nothing English to anchor
 * the answer to. The device cannot tell whether the answer means what the task asked for.
 *
 * Before this module the app said so by returning "Connect an evaluator" — and then saved
 * the attempt with `taskCompleted: false` and `transferOutcome: "needs_support"`. A task
 * nobody judged was recorded as a task the learner failed, which is the same category error
 * the audit found in `crossContextReuse`, pointed the other way.
 *
 * So this check answers only what is observable, and refuses the rest:
 *
 *   - is there an answer at all, long enough to be an attempt at the task?
 *   - does it contain a named PT→EN transfer error?
 *   - is it just the prompt's own words handed back?
 *
 * A `form_clear` verdict means "nothing wrong was found", never "correct". `taskCompleted`
 * is `undefined` there, so the attempt counts as an attempt and nothing else.
 */

export type OpenResponseVerdict =
  /** Nothing usable to check. */
  | "empty"
  /** Too short to be an attempt at an open communicative task. */
  | "too_short"
  /** The learner echoed the prompt instead of answering it. */
  | "echoed_prompt"
  /** A named PT→EN transfer error. The one thing the device is confident is wrong. */
  | "form_error"
  /** No observable problem — which is not the same as a correct answer. */
  | "form_clear";

export interface OpenResponseCheck {
  verdict: OpenResponseVerdict;
  formIssues: TransferRuleHit[];
  wordCount: number;
  /**
   * Whether the meaning of the answer was judged. Always false: this is a form check.
   * Kept as a field rather than a comment so callers cannot quietly treat a clear form
   * check as a passed task.
   */
  meaningJudged: false;
  /**
   * What the caller should record. `false` only for the observable failures; `undefined`
   * when the device reached no verdict on the task — the app's standing null-not-zero rule.
   */
  taskCompleted: boolean | undefined;
}

/**
 * An open answer shorter than this is not an attempt at the task — it is a word. The floor
 * is low on purpose: the check exists to catch "ok" and "i dont know", not to impose a
 * length target on a learner who wrote a short, complete sentence.
 */
export const MIN_OPEN_RESPONSE_WORDS = 4;

/** Above this share of borrowed content words, the answer is the prompt handed back. */
const ECHO_THRESHOLD = 0.8;

export interface OpenResponseInput {
  response: string;
  /**
   * The prompt as the learner saw it, when it is available. Used only for the echo check —
   * it may be Portuguese, so it is never treated as evidence about the answer's meaning.
   */
  prompt?: string;
}

export function checkOpenResponse({ response, prompt }: OpenResponseInput): OpenResponseCheck {
  const words = tokenize(response);
  if (words.length === 0) {
    return { verdict: "empty", formIssues: [], wordCount: 0, meaningJudged: false, taskCompleted: false };
  }

  const formIssues = applyTransferRules(response).hits;
  if (formIssues.length > 0) {
    return { verdict: "form_error", formIssues, wordCount: words.length, meaningJudged: false, taskCompleted: false };
  }

  if (words.length < MIN_OPEN_RESPONSE_WORDS) {
    return { verdict: "too_short", formIssues, wordCount: words.length, meaningJudged: false, taskCompleted: false };
  }

  const promptContent = prompt ? contentLemmas(prompt) : new Set<string>();
  const responseContent = contentLemmas(response);
  if (promptContent.size > 0 && responseContent.size > 0) {
    let borrowed = 0;
    for (const token of responseContent) if (promptContent.has(token)) borrowed += 1;
    if (borrowed / responseContent.size >= ECHO_THRESHOLD) {
      return { verdict: "echoed_prompt", formIssues, wordCount: words.length, meaningJudged: false, taskCompleted: false };
    }
  }

  // Nothing observable is wrong. That is all this says.
  return { verdict: "form_clear", formIssues, wordCount: words.length, meaningJudged: false, taskCompleted: undefined };
}
