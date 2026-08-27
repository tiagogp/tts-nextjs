/**
 * Who judged this outcome, and with what.
 *
 * The app's central claim is that it does not tell a learner they have learned something
 * it never measured. Moving evaluation onto a model does not weaken that claim — but it
 * changes what "measured" means, in two ways that have to be recorded or the claim quietly
 * stops being true:
 *
 *   1. **A model verdict is a different kind of evidence.** `verifyTransfer` is a
 *      deterministic property of the text: same answer, same verdict, forever. A model
 *      saying "the task was met" is a judgement — useful, often better at meaning, and not
 *      reproducible. Averaging the two into one rate produces a number that means neither.
 *
 *   2. **The judge drifts.** A D60 window compares an attempt from two months ago with one
 *      from today. If the model or the prompt changed in between, the instrument changed
 *      mid-measurement, and the comparison is between two different tests. Deterministic
 *      checks drift too — `evaluateRecall` was rewritten the day the audit landed — so the
 *      local path carries a version as well.
 *
 * So every judged outcome carries a stamp, and any metric that spans time or mixes sources
 * reports the mix instead of hiding it. Absence of a stamp means "not judged", never
 * "judged and passed".
 */

export type JudgeKind = "local" | "model";

export interface JudgeStamp {
  by: JudgeKind;
  /** Provider kind, when a model judged: "claude", "openai", "ollama", "openrouter". */
  provider?: string;
  /** Model id as resolved at call time — not the one configured later. */
  model?: string;
  /** Version of the prompt that produced the verdict. */
  promptVersion?: string;
  /** Version of the deterministic checker, when local. */
  rulesVersion?: string;
}

/**
 * Bump when a change to the offline checkers would move a verdict: `evaluateRecall`,
 * `verifyTransfer`, `checkOpenResponse`, or the transfer-rule table. Attempts stamped with
 * different versions were produced by different instruments.
 */
export const LOCAL_RULES_VERSION = "2026-08-27";

/**
 * Bump when a change to an evaluation prompt would move a verdict. Separate from the model
 * id: the same model with a rewritten rubric is a different judge.
 */
export const CORRECTION_PROMPT_VERSION = "2026-08-27";

export const LOCAL_JUDGE: JudgeStamp = Object.freeze({
  by: "local",
  rulesVersion: LOCAL_RULES_VERSION,
});

export function modelJudge(input: {
  provider?: string;
  model?: string;
  promptVersion?: string;
}): JudgeStamp {
  return {
    by: "model",
    provider: input.provider,
    // Undefined rather than a guess: an unnamed model is honest, a wrong name is not.
    model: input.model,
    promptVersion: input.promptVersion ?? CORRECTION_PROMPT_VERSION,
  };
}

/** A stable key for "the same instrument": provider, model and prompt/rules version. */
export function instrumentKey(stamp: JudgeStamp | undefined): string {
  if (!stamp) return "unjudged";
  if (stamp.by === "local") return `local:${stamp.rulesVersion ?? "unversioned"}`;
  return `model:${stamp.provider ?? "?"}:${stamp.model ?? "?"}:${stamp.promptVersion ?? "?"}`;
}

/**
 * Were these two outcomes produced by the same instrument? A rate that spans instruments
 * is not wrong, but it is not a like-for-like comparison, and the UI has to say so.
 */
export function sameInstrument(left: JudgeStamp | undefined, right: JudgeStamp | undefined): boolean {
  return instrumentKey(left) === instrumentKey(right);
}

export interface JudgeMix {
  /** Outcomes decided by a deterministic check on the device. */
  local: number;
  /** Outcomes decided by a model. */
  model: number;
  /** Outcomes with no stamp at all — including everything recorded before stamping existed. */
  unstamped: number;
  /** Distinct instruments behind the stamped outcomes. */
  instruments: string[];
}

/**
 * The provenance summary for a set of judged outcomes.
 *
 * `instruments.length > 1` is the signal that matters: it means the number below the label
 * was not produced by one test. The UI shows that rather than a footnote nobody reads.
 */
export function judgeMix(stamps: readonly (JudgeStamp | undefined)[]): JudgeMix {
  const instruments = new Set<string>();
  let local = 0;
  let model = 0;
  let unstamped = 0;
  for (const stamp of stamps) {
    if (!stamp) {
      unstamped += 1;
      continue;
    }
    instruments.add(instrumentKey(stamp));
    if (stamp.by === "model") model += 1;
    else local += 1;
  }
  return { local, model, unstamped, instruments: [...instruments].sort() };
}

/** True when any part of this set was judged by a model. */
export function hasModelVerdict(mix: JudgeMix): boolean {
  return mix.model > 0;
}

/** True when the set mixes instruments, so its rate is not a like-for-like comparison. */
export function isMixedInstrument(mix: JudgeMix): boolean {
  return mix.instruments.length > 1;
}
