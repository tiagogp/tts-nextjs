import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";

/**
 * Deterministic, on-device correction for the guided first lesson's "write one
 * sentence" step. It only fixes what can be verified without a model — spelling
 * of the lesson phrase, capitalization of "I", sentence casing and terminal
 * punctuation — so the first loop never depends on an AI provider.
 */

export interface LocalCorrectionIssue {
  type: ErrorType;
  category: "messageClarity" | "lessonLanguage" | "mechanics";
  priority: "blocking" | "important" | "polish";
  /** English source string for the learner-facing note; render through t(). */
  note: string;
}

export interface LocalCorrectionResult {
  /** The learner's sentence with every locally verifiable fix applied. */
  corrected: string;
  issues: LocalCorrectionIssue[];
  /** Whether the lesson phrase was found (exactly or with small typos). */
  usedPhrase: boolean;
}

export const PHRASE_SPELLING_NOTE = "Check the spelling of the lesson phrase.";
export const CAPITAL_I_NOTE = 'In English, "I" is always capitalized.';
export const SENTENCE_START_NOTE = "Start the sentence with a capital letter.";
export const PUNCTUATION_NOTE = "End the sentence with punctuation (like . or ?).";
export const MISSING_LESSON_LANGUAGE_NOTE = "Use the lesson phrase or its reusable pattern.";
export const OWN_DETAIL_NOTE = "Add one detail of your own instead of repeating only the model phrase.";

const PRIORITY_RANK: Record<LocalCorrectionIssue["priority"], number> = {
  blocking: 0,
  important: 1,
  polish: 2,
};

function feedbackIssue(
  type: ErrorType,
  category: LocalCorrectionIssue["category"],
  priority: LocalCorrectionIssue["priority"],
  note: string,
): LocalCorrectionIssue {
  return { type, category, priority, note };
}

function categoryForModelError(errorTypes: ErrorType[]): LocalCorrectionIssue["category"] {
  return errorTypes.some((type) =>
    ["collocation", "idiom", "register", "vocabulary"].includes(type),
  )
    ? "messageClarity"
    : "lessonLanguage";
}

function uniqueSortedIssues(issues: LocalCorrectionIssue[]): LocalCorrectionIssue[] {
  const unique = new Map<string, LocalCorrectionIssue>();
  for (const issue of issues) {
    const key = `${issue.type}:${issue.category}:${issue.note}`;
    if (!unique.has(key)) unique.set(key, issue);
  }
  return [...unique.values()].sort(
    (left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority],
  );
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const curr = [i];
    for (let j = 1; j < cols; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[cols - 1];
}

/** Comparable core of a token: no surrounding punctuation, straight apostrophes, lowercase. */
function core(token: string): string {
  return token
    .replace(/’/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "")
    .toLowerCase();
}

function expandCore(token: string): string[] {
  const value = core(token);
  const contractions: Record<string, string[]> = {
    "i'm": ["i", "am"],
    "you're": ["you", "are"],
    "we're": ["we", "are"],
    "they're": ["they", "are"],
    "he's": ["he", "is"],
    "she's": ["she", "is"],
    "it's": ["it", "is"],
    "what's": ["what", "is"],
    "that's": ["that", "is"],
    "i've": ["i", "have"],
    "we've": ["we", "have"],
    "i'll": ["i", "will"],
    "we'll": ["we", "will"],
  };
  return contractions[value] ?? (value ? [value] : []);
}

function expandedCores(tokens: string[]): string[] {
  return tokens.flatMap(expandCore);
}

/** Trailing punctuation of a token (e.g. the "!" of "morning!"). */
function trailing(token: string): string {
  const match = /[^\p{L}\p{N}']+$/u.exec(token.replace(/’/g, "'"));
  return match ? match[0] : "";
}

/** Distance small enough to count as "the same word, misspelled". */
function wordMatches(a: string, b: string): number | null {
  const dist = levenshtein(a, b);
  if (dist === 0) return 0;
  const len = Math.max(a.length, b.length);
  if (len >= 8 && dist <= 2) return dist;
  if (len >= 4 && dist <= 1) return dist;
  return null;
}

/** "I" and its contractions keep their capital even mid-sentence. */
function isAlwaysCapital(word: string): boolean {
  return word === "I" || word.startsWith("I'");
}

interface PhraseWindow {
  start: number;
  distance: number;
}

function findPhraseWindow(tokenCores: string[], phraseCores: string[]): PhraseWindow | null {
  if (phraseCores.length === 0 || tokenCores.length < phraseCores.length) return null;
  let best: PhraseWindow | null = null;
  for (let start = 0; start + phraseCores.length <= tokenCores.length; start++) {
    let total = 0;
    let ok = true;
    for (let i = 0; i < phraseCores.length; i++) {
      const dist = wordMatches(tokenCores[start + i], phraseCores[i]);
      if (dist === null) {
        ok = false;
        break;
      }
      total += dist;
    }
    if (ok && (best === null || total < best.distance)) best = { start, distance: total };
    if (best?.distance === 0) break;
  }
  return best;
}

function reusablePrefixWindow(
  inputCores: string[],
  modelCores: string[],
): { window: PhraseWindow; length: number } | null {
  // A model with at least three normalized words can expose its leading frame:
  // “I am …”, “My name is …”, “I live in …”. The learner must add something
  // after the frame, so a two-word fixed phrase such as “Good morning” is not
  // weakened into the meaningless pattern “Good …”.
  for (let length = modelCores.length - 1; length >= 2; length--) {
    const window = findPhraseWindow(inputCores, modelCores.slice(0, length));
    if (window?.distance === 0) return { window, length };
  }
  return null;
}

export function correctSentenceLocally(
  input: string,
  targetPhrase: string,
  targetPattern?: string,
): LocalCorrectionResult {
  const issues: LocalCorrectionIssue[] = [];
  const sentence = input.trim().replace(/\s+/g, " ");
  if (!sentence) return { corrected: "", issues: [], usedPhrase: false };

  const phrase = targetPhrase.trim();
  const phraseTerminal = /[.!?]+$/.exec(phrase)?.[0] ?? "";
  const phraseBody = phrase.slice(0, phrase.length - phraseTerminal.length).trim();
  const phraseWords = phraseBody
    .split(/\s+/)
    .filter((word) => core(word).length > 0);
  const phraseCores = phraseWords.map(core);

  let tokens = sentence.split(" ");
  const window = findPhraseWindow(tokens.map(core), phraseCores);
  const inputExpandedCores = expandedCores(tokens);
  const modelExpandedCores = expandedCores(phraseWords);
  const patternCores = expandedCores((targetPattern ?? "").trim().split(/\s+/));
  const patternAppearsInModel = findPhraseWindow(modelExpandedCores, patternCores)?.distance === 0;
  const patternWindow = patternAppearsInModel
    ? findPhraseWindow(inputExpandedCores, patternCores)
    : null;
  const inferredPattern = reusablePrefixWindow(inputExpandedCores, modelExpandedCores);
  const usedPhrase =
    window !== null || patternWindow?.distance === 0 || inferredPattern !== null;
  const phraseAtEnd = window !== null && window.start + phraseCores.length === tokens.length;
  const matchedLanguageLength = window
    ? modelExpandedCores.length
    : patternWindow?.distance === 0
      ? patternCores.length
      : inferredPattern?.length ?? 0;

  // Misspelled phrase → substitute the canonical wording, keeping the learner's
  // surrounding words and the trailing punctuation they typed after it.
  if (window && window.distance > 0) {
    const trail = trailing(tokens[window.start + phraseCores.length - 1]);
    const replacement = phraseWords.map((word, i) =>
      i === 0 && window.start > 0 && !isAlwaysCapital(word)
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word,
    );
    replacement[replacement.length - 1] += trail;
    tokens = [
      ...tokens.slice(0, window.start),
      ...replacement,
      ...tokens.slice(window.start + phraseCores.length),
    ];
    issues.push(feedbackIssue("vocabulary", "lessonLanguage", "important", PHRASE_SPELLING_NOTE));
  }

  // "i" / "i'm" / "i've" … → capital I.
  let fixedCapitalI = false;
  tokens = tokens.map((token) => {
    if (/^i($|')/.test(token.replace(/’/g, "'"))) {
      fixedCapitalI = true;
      return "I" + token.slice(1);
    }
    return token;
  });
  if (fixedCapitalI) issues.push(feedbackIssue("other", "mechanics", "polish", CAPITAL_I_NOTE));

  let corrected = tokens.join(" ");

  // Sentence starts with a capital letter.
  const firstLetter = /\p{L}/u.exec(corrected);
  if (firstLetter && firstLetter[0] !== firstLetter[0].toUpperCase()) {
    corrected =
      corrected.slice(0, firstLetter.index) +
      firstLetter[0].toUpperCase() +
      corrected.slice(firstLetter.index + 1);
    issues.push(feedbackIssue("other", "mechanics", "polish", SENTENCE_START_NOTE));
  }

  // Terminal punctuation; when the sentence ends with the lesson phrase, reuse
  // the phrase's own mark (e.g. "How are you?" keeps the question mark).
  if (!/[.!?…]$/.test(corrected)) {
    corrected += phraseAtEnd && phraseTerminal ? phraseTerminal : ".";
    issues.push(feedbackIssue("other", "mechanics", "polish", PUNCTUATION_NOTE));
  }

  if (!usedPhrase) {
    issues.push(
      feedbackIssue("vocabulary", "lessonLanguage", "blocking", MISSING_LESSON_LANGUAGE_NOTE),
    );
  } else if (inputExpandedCores.length <= matchedLanguageLength) {
    issues.push(feedbackIssue("other", "messageClarity", "blocking", OWN_DETAIL_NOTE));
  }

  return { corrected, issues: uniqueSortedIssues(issues), usedPhrase };
}

/**
 * Add configured model feedback to the provider-free lesson check. Model
 * corrections are exact-fragment replacements, matching the correction API's
 * contract; the resulting sentence then passes through the deterministic check
 * again so punctuation and lesson-pattern validation remain consistent.
 */
export function mergeEvaluatedCorrection(
  input: string,
  targetPhrase: string,
  targetPattern: string | undefined,
  events: ErrorEvent[],
): LocalCorrectionResult {
  const local = correctSentenceLocally(input, targetPhrase, targetPattern);
  let evaluated = input.trim().replace(/\s+/g, " ");
  const modelIssues: LocalCorrectionIssue[] = [];

  for (const event of events) {
    const original = event.original.trim();
    const corrected = event.corrected.trim();
    if (!original || !corrected || original === corrected) continue;

    const index = evaluated.indexOf(original);
    if (index >= 0) {
      evaluated =
        evaluated.slice(0, index) + corrected + evaluated.slice(index + original.length);
    }
    modelIssues.push(
      feedbackIssue(
        event.errorTypes[0] ?? "other",
        categoryForModelError(event.errorTypes),
        "blocking",
        event.rationale?.trim() || `Change “${original}” to “${corrected}”.`,
      ),
    );
  }

  const final = correctSentenceLocally(evaluated, targetPhrase, targetPattern);
  return {
    corrected: final.corrected,
    issues: uniqueSortedIssues([...modelIssues, ...local.issues, ...final.issues]),
    usedPhrase: final.usedPhrase,
  };
}
