/**
 * A language pattern is the reusable half of a saved phrase: the frame stays, the slot
 * changes. "I ended up ___" is the frame; "staying home", "buying it", "leaving early"
 * are fillings.
 *
 * Why this module exists: without it the app can only ever ask a learner to reproduce the
 * exact sentence it taught. Every check here is deterministic and offline — a drill that
 * needs a provider is not part of the method, because the provider-free path is the
 * product's differentiator.
 *
 * The one rule that matters: every predicate returns `undefined` (not `false`) when the
 * pattern data needed to judge is missing. "Not verifiable" and "verified false" are
 * different facts, and this is the module where collapsing them would start a lie that the
 * progress panel then reports as transfer.
 */

/** Slot marker in an authored frame. Three or more underscores, so "well_known" is safe. */
export const SLOT_MARKER = /_{3,}/;
/** Global twin, for the replaces — a frame may legitimately have two slots. */
const SLOT_MARKER_ALL = /_{3,}/g;

export interface LanguagePattern {
  /** Stable family id, shared by every phrase built on this frame. */
  id: string;
  /** The invariant part, with `___` marking the slot: "I ended up ___". */
  frame: string;
  /** What kind of thing fills the slot, e.g. "-ing verb phrase". Learner-facing. */
  slot: string;
  /** Grounded fillings, including the one from the source phrase. At least two. */
  examples: string[];
  /** A near neighbour that is wrong, for minimal-pair discrimination. Optional. */
  contrast?: string;
}

/** Words that carry no meaning on their own, so they never count as "new content". */
const FUNCTION_WORDS = new Set([
  "a", "about", "after", "all", "am", "an", "and", "any", "are", "as", "at", "be", "been",
  "before", "but", "by", "can", "could", "did", "do", "does", "during", "for", "from", "get", "got",
  "had", "has", "have", "he", "her", "here", "him", "his", "how", "i", "if", "in", "into",
  "is", "it", "its", "just", "me", "might", "more", "most", "much", "must", "my", "no",
  "not", "of", "off", "on", "one", "or", "our", "out", "over", "own", "s", "she", "should",
  "so", "some", "still", "such", "t", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "too", "up", "us", "very", "was", "we",
  "were", "what", "when", "where", "which", "while", "who", "will", "with", "would", "you",
  "your",
]);

/**
 * Contractions with exactly one expansion, and the irregular stems that go with them.
 *
 * Expanding these before any comparison settles a whole class of false negatives in one
 * rule instead of one authored alternative per phrase: a learner who types "I do not eat
 * meat" for a card that reads "I don't eat meat" wrote that card's sentence, and the frame
 * "I don't ___" is the frame they used. It cuts the other way too \u2014 the C1 lessons spell
 * their negatives out, and a learner who contracts them is equally right.
 *
 * `'s` (is / has / possessive) and `'d` (would / had) are deliberately absent. Picking an
 * expansion for them would mean guessing which one a card meant, and a wrong guess makes
 * the app call wrong English right \u2014 the one direction it must never fail in. Those are
 * resolved per phrase by `accept` in lessons.json, where a human decided.
 */
const NEGATIVE_STEMS: Record<string, string> = {
  wo: "will",
  ca: "can",
  sha: "shall",
};
const CLITICS: Record<string, string> = {
  m: "am",
  re: "are",
  ve: "have",
  ll: "will",
};

function expandContraction(token: string): string[] {
  if (token === "cannot") return ["can", "not"];
  // "let's" is the one `'s` with a single reading, and it is the frame of 16 lessons.
  if (token === "let's") return ["let", "us"];
  if (token.endsWith("n't")) {
    const stem = token.slice(0, -3);
    return [NEGATIVE_STEMS[stem] ?? stem, "not"];
  }
  const [stem, clitic] = token.split("'");
  if (stem && clitic && CLITICS[clitic]) return [stem, CLITICS[clitic]];
  return [token];
}

/** Lowercase, strip accents and punctuation, expand contractions, collapse whitespace. */
export function tokenize(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // A phone keyboard types \u2019, an authored file types '. Without this they tokenize
    // differently and every contraction a learner speaks or types misses its own card.
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(expandContraction);
}

/**
 * Crude suffix stripping, deliberately not a real lemmatizer. It exists so that "buying"
 * and "buy" count as one word in the active-vocabulary metric and as an overlap in the
 * transfer check. A real lemmatizer costs a dictionary download, which the offline path
 * cannot have.
 *
 * It over-stems a minority of words, and that direction is the safe one: merging two
 * distinct words under-counts vocabulary and over-counts reuse, so both errors make the
 * app's claims smaller rather than larger. What it must never do is stem inconsistently —
 * every form of a word has to land on the same string, which suffix stripping guarantees.
 */
export function lemma(token: string): string {
  const word = token.replace(/'s$/, "");
  if (word.length <= 3) return word;
  for (const suffix of ["ingly", "edly", "ing", "ies", "ied", "es", "ed", "s"]) {
    if (!word.endsWith(suffix)) continue;
    let stem = word.slice(0, -suffix.length);
    if (suffix === "ies" || suffix === "ied") stem = `${stem}y`;
    // "running" -> "runn" -> "run": undo the doubled consonant English adds before -ing/-ed.
    else if ((suffix === "ing" || suffix === "ed") && /([bdfglmnprt])\1$/.test(stem)) stem = stem.slice(0, -1);
    // Guard against stemming a word that merely ends in these letters: "thing" is not
    // "th" + ing, "bus" is not "bu" + s. A real stem is at least three letters.
    return stem.length >= 3 ? stem : word;
  }
  return word;
}

/** Meaning-bearing lemmas only. This is the set every overlap comparison runs on. */
export function contentLemmas(value: string): Set<string> {
  return new Set(
    tokenize(value)
      .filter((token) => !FUNCTION_WORDS.has(token))
      .map(lemma)
      .filter((token) => token.length > 1),
  );
}

/**
 * Fraction of the response's content that also appears in the source example.
 * 0 means the learner reused none of the original words; 1 means they reused all of them.
 * Directional on purpose: a learner who writes a longer sentence containing the whole
 * original has still reused it, and a symmetric measure (Jaccard) would hide that behind
 * the added length.
 *
 * `ignore` exists because the frame's own words are shared by definition — "ended" is in
 * every sentence built on "I ended up ___". Counting them as reuse would make a perfect
 * transfer look like a copy, so a frame-aware caller passes the frame's content words here.
 */
export function contentOverlap(response: string, source: string, ignore: Iterable<string> = []): number {
  const excluded = new Set(ignore);
  const responseLemmas = [...contentLemmas(response)].filter((token) => !excluded.has(token));
  const sourceLemmas = contentLemmas(source);
  if (responseLemmas.length === 0) return 0;
  let shared = 0;
  for (const token of responseLemmas) if (sourceLemmas.has(token)) shared += 1;
  return shared / responseLemmas.length;
}

/** The frame's own content words, which never count as the learner's content. */
export function frameLemmas(frame: string): Set<string> {
  return contentLemmas(frame.replace(SLOT_MARKER_ALL, " "));
}

/** Turn an authored frame into a matcher: fixed words in order, anything in the slot. */
function frameRegex(frame: string): RegExp | null {
  const parts = frame.split(SLOT_MARKER).map((part) => tokenize(part));
  if (parts.every((part) => part.length === 0)) return null;
  const source = parts
    .map((part) => part.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"))
    // The slot must actually be filled with something, and the fixed parts must stay in
    // order — but a learner may add words around them ("I think I ended up staying").
    .join("\\s+\\S[\\s\\S]*?\\s*");
  return new RegExp(`(?:^|\\s)${source}(?:\\s|$)`);
}

/**
 * Did the learner build on the target frame?
 *
 * `undefined` when there is no frame to check against — the caller must then report the
 * attempt as unverified rather than as a failure.
 */
export function usesFrame(response: string, frame: string | undefined): boolean | undefined {
  if (!frame?.trim()) return undefined;
  const matcher = frameRegex(frame);
  if (!matcher) return undefined;
  return matcher.test(` ${tokenize(response).join(" ")} `);
}

/** The learner's own filling of the slot: whatever content words the frame did not supply. */
export function slotFilling(response: string, frame: string): string[] {
  const framed = frameLemmas(frame);
  return [...contentLemmas(response)].filter((token) => !framed.has(token));
}

/**
 * Is this filling genuinely the learner's, rather than one of the fillings the app showed
 * them? Compares against every taught example of the same pattern.
 */
export function isNovelFilling(response: string, pattern: LanguagePattern, threshold = 0.5): boolean {
  const filling = new Set(slotFilling(response, pattern.frame));
  if (filling.size === 0) return false;
  return pattern.examples.every((example) => {
    const exampleFilling = new Set(slotFilling(example, pattern.frame));
    if (exampleFilling.size === 0) return true;
    let shared = 0;
    for (const token of filling) if (exampleFilling.has(token)) shared += 1;
    return shared / filling.size < threshold;
  });
}

/** A pattern is only drillable once it has a frame with a slot and two or more examples. */
export function isDrillablePattern(pattern: Partial<LanguagePattern> | undefined): pattern is LanguagePattern {
  return Boolean(
    pattern?.id &&
    pattern.frame &&
    SLOT_MARKER.test(pattern.frame) &&
    pattern.examples &&
    pattern.examples.length >= 2,
  );
}
