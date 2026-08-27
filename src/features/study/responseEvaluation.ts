import { applyTransferRules, type TransferRuleHit } from "@/features/learn/transferErrors";
import { contentLemmas, tokenize, usesFrame } from "@/lib/language/pattern";

export type RecallQuality = "correct" | "close" | "incorrect";

/**
 * The same tokenizer the frame check runs on, contraction expansion included. Keeping a
 * private copy here is how "I do not eat meat" came to score 0.79 against "I don't eat
 * meat" while `usesFrame` counted it as the same frame \u2014 one answer, two verdicts.
 */
const normalize = tokenize;

function levenshtein(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export interface RecallEvaluation {
  quality: RecallQuality;
  /** Best literal similarity across the expected answer and any accepted alternative. */
  similarity: number;
  /** Which accepted answer the response scored closest to. */
  matchedAnswer: string;
  /** Whether the target frame was produced. `undefined` when the card has no frame. */
  patternUsed?: boolean;
  /** Transfer-rule violations found in the response. Non-empty means real, named error. */
  formIssues: TransferRuleHit[];
  /**
   * True when the verdict rests on literal string distance alone — no frame to check and no
   * named error found. The response may be perfectly good English the card never listed.
   * Callers must not veto the learner's own grade, and must not record `responseCorrect`,
   * on a verdict flagged this way.
   */
  literalOnly: boolean;
}

export interface RecallOptions {
  /**
   * Other answers that are correct for this prompt. A card that means "it depends" should
   * not fail a learner who wrote "It depends" because the author typed a longer sentence.
   */
  acceptedAnswers?: string[];
  /** Target pattern frame with `___` for the slot, when the card carries one. */
  frame?: string;
}

const CORRECT_AT = 0.9;
const CLOSE_AT = 0.68;
/**
 * A shorter answer counts as the same answer when almost everything it says is on target
 * (precision) and it keeps at least half of what was expected (recall). Both are needed:
 * precision alone would pass a one-word echo, recall alone would pass a padded answer.
 *
 * This path can only ever promote a verdict to `correct`, never demote one, so its failure
 * mode is a slightly generous D7/D30/D60 window rather than a learner punished for good
 * English. The floor on word count keeps the cheapest echo ("time") out.
 */
const MEANING_PRECISION = 0.8;
const MEANING_RECALL = 0.5;
const MEANING_MIN_WORDS = 2;

function similarityOf(expected: string, response: string): number {
  const expectedTokens = normalize(expected);
  const responseTokens = normalize(response);
  if (expectedTokens.length === 0 || responseTokens.length === 0) return 0;
  const expectedText = expectedTokens.join(" ");
  const responseText = responseTokens.join(" ");
  const characterScore = 1 - levenshtein(expectedText, responseText) /
    Math.max(expectedText.length, responseText.length, 1);
  const expectedSet = new Set(expectedTokens);
  const responseSet = new Set(responseTokens);
  const overlap = [...expectedSet].filter((token) => responseSet.has(token)).length;
  const precision = overlap / responseSet.size;
  const recall = overlap / expectedSet.size;
  const tokenScore = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return Math.max(0, Math.min(1, characterScore * 0.65 + tokenScore * 0.35));
}

/**
 * Local check for fixed-phrase retrieval.
 *
 * It answers two questions that used to be collapsed into one, and collapsing them is how
 * the app came to punish correct English:
 *
 *   (a) is this correct English that expresses the meaning?  — `formIssues`, `similarity`
 *   (b) does it use the pattern the card is teaching?         — `patternUsed`
 *
 * A learner who answers "It depends" to a card whose authored answer is "It depends on the
 * situation" has done (a). Under the old single Levenshtein score they scored 0.54 and were
 * forced to grade themselves Again. Repeated over months, that does not teach English — it
 * teaches the learner to reproduce the authored string, and then reports the result as
 * production in the D7/D30/D60 windows.
 *
 * Keeping (a) and (b) apart gives three verdicts rather than two: the pattern produced in
 * valid English is `correct`; the meaning carried in valid English without the pattern is
 * `close`, gradeable as Hard; only a response that is neither is `incorrect`.
 *
 * So: string distance can promote a response to `correct`, but it may no longer be the sole
 * grounds for calling one wrong. When there is no frame to check and no named error to
 * point at, the verdict is marked `literalOnly` and the caller must leave the judgement to
 * the learner rather than veto their grade or record the attempt as a failure.
 */
export function evaluateRecall(
  expected: string,
  response: string,
  options: RecallOptions = {},
): RecallEvaluation {
  const candidates = [expected, ...(options.acceptedAnswers ?? [])].filter((value) => value?.trim());
  const empty = normalize(response).length === 0 || candidates.length === 0;
  if (empty) {
    return {
      quality: "incorrect",
      similarity: 0,
      matchedAnswer: expected,
      formIssues: [],
      // An empty answer is a real, observed non-answer, not an unjudgeable one.
      literalOnly: false,
    };
  }

  let matchedAnswer = candidates[0];
  let similarity = 0;
  for (const candidate of candidates) {
    const score = similarityOf(candidate, response);
    if (score > similarity) {
      similarity = score;
      matchedAnswer = candidate;
    }
  }

  const formIssues = applyTransferRules(response).hits;
  const patternUsed = usesFrame(response, options.frame);

  // A shorter answer that keeps the meaning-bearing words is the same answer. This is the
  // "It depends" case: full precision against the expected content, partial recall.
  const expectedContent = contentLemmas(matchedAnswer);
  const responseContent = contentLemmas(response);
  let sharedContent = 0;
  for (const token of responseContent) if (expectedContent.has(token)) sharedContent += 1;
  const coversMeaning = responseContent.size > 0 &&
    expectedContent.size > 0 &&
    normalize(response).length >= MEANING_MIN_WORDS &&
    sharedContent / responseContent.size >= MEANING_PRECISION &&
    sharedContent / expectedContent.size >= MEANING_RECALL;

  if (formIssues.length > 0) {
    // A named transfer error is the one thing we can be confident is wrong.
    return {
      quality: similarity >= CORRECT_AT ? "close" : "incorrect",
      similarity,
      matchedAnswer,
      patternUsed,
      formIssues,
      literalOnly: false,
    };
  }

  if (similarity >= CORRECT_AT) {
    return { quality: "correct", similarity, matchedAnswer, patternUsed, formIssues, literalOnly: false };
  }

  // Frame produced, no named error: the learner used the target structure in valid English.
  // That is what a production card is for, whatever words they chose to put in the slot.
  if (patternUsed === true) {
    return { quality: "correct", similarity, matchedAnswer, patternUsed, formIssues, literalOnly: false };
  }
  if (patternUsed === false) {
    // The target structure is absent. That is a real observation, not a string-distance
    // guess — but "wrong shape" and "wrong answer" are different verdicts, and now that
    // almost every card carries a frame, collapsing them would re-create the problem the
    // frame check was added to solve. A learner who answers "It depends" to a card built
    // on "It depends on ___" produced valid English carrying the meaning; they just did
    // not produce the pattern. That is a Hard, not a forced Again.
    return {
      quality: coversMeaning ? "close" : "incorrect",
      similarity,
      matchedAnswer,
      patternUsed,
      formIssues,
      literalOnly: false,
    };
  }

  if (coversMeaning) {
    return { quality: "correct", similarity, matchedAnswer, patternUsed, formIssues, literalOnly: false };
  }

  // No frame, no named error, not a literal match. We genuinely cannot tell a valid
  // paraphrase from a wrong answer here, and must say so rather than guess.
  return {
    quality: similarity >= CLOSE_AT ? "close" : "incorrect",
    similarity,
    matchedAnswer,
    patternUsed,
    formIssues,
    literalOnly: true,
  };
}

/**
 * Does this verdict justify restricting the grades the learner may give themselves?
 *
 * Only when the app observed something specific: a named transfer error, a missing target
 * frame, or an empty answer. Vetoing on string distance alone is what trained recitation.
 */
export function isVetoable(evaluation: RecallEvaluation): boolean {
  return !evaluation.literalOnly && evaluation.quality !== "correct";
}

/**
 * What to record in `ReviewRecord.responseCorrect`, which feeds the D7/D30/D60 windows.
 * `undefined` when the check could not judge — the app's standing rule that an unmeasured
 * outcome is null, never a zero.
 */
export function recordedCorrectness(evaluation: RecallEvaluation | undefined): boolean | undefined {
  if (!evaluation) return undefined;
  if (evaluation.quality === "correct") return true;
  return evaluation.literalOnly ? undefined : false;
}
