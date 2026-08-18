/**
 * Parses the repertoire markup an advanced conversation reply carries: expressions marked
 * inline with `**double asterisks**` plus a `[[repertoire: ...]]` trailer glossing them.
 * See `repertoireInstruction` in `@/lib/cards/shared` for the prompt side of the contract.
 *
 * Every function here degrades silently. Models drop the trailer, gloss with the wrong dash, or
 * mark an expression they forget to list — none of that may break a conversation in progress, so
 * a malformed reply parses as an ordinary one rather than throwing.
 */

import type { Card, PhraseCandidate } from "@/lib/cards/schema";

export interface RepertoireItem {
  /** The expression as it appears in the reply, without the `**` markers. */
  expression: string;
  /** Short definition from the trailer; empty when the model marked but never glossed it. */
  gloss: string;
  /**
   * The partner's own sentence around the expression, markers stripped. A collocation without
   * its frame is barely learnable — this is what makes a card show the expression at work.
   */
  carrier?: string;
  /** When the learner first said it back. Unset until they do; see `detectRepertoireUse`. */
  usedAt?: number;
}

export interface ParsedRepertoire {
  /** Trailer removed, `**` markers kept — what the bubble renders. */
  display: string;
  /** Trailer and markers removed — what gets spoken and what a plain reader sees. */
  plain: string;
  items: RepertoireItem[];
}

/** `[[repertoire: a — b; c — d]]`, tolerant of case, inner whitespace and a missing closer. */
const TRAILER = /\[\[\s*repertoire\s*:([\s\S]*?)(?:\]\]|$)\s*$/i;
const MARKED = /\*\*(.+?)\*\*/g;
/** Em dash, en dash, hyphen or colon — models pick a different one every few replies. */
const GLOSS_SEPARATOR = /\s+[—–-]\s+|\s*:\s+/;

/** Collapse whitespace and shed the punctuation a model leaves clinging to an expression. */
function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/^[*"'“”‘’]+|[*"'“”‘’.,;!?]+$/g, "").trim();
}

/** An expression is a short phrase, not a sentence. */
const MAX_EXPRESSION_WORDS = 7;

/**
 * Reject a marked span that is plainly not an expression. Models sometimes restate the whole
 * trailer as a bolded summary line inside the reply; swallowing that produces a nonsense
 * "expression" and — worse, before this guard — leaked a definition list into the spoken audio.
 */
function isPlausibleExpression(value: string): boolean {
  if (!value) return false;
  if (value.length > 60) return false;
  if (value.split(" ").length > MAX_EXPRESSION_WORDS) return false;
  // Gloss punctuation: a real expression never carries its own definition or a list separator.
  if (/[;]/.test(value) || /\s[—–]\s/.test(value)) return false;
  return true;
}

/** Strip the `**` markers without touching the words between them. */
export function stripRepertoireMarkers(text: string): string {
  return text.replace(MARKED, "$1");
}

/**
 * The partner's sentence around a marked span, so the expression can be shown at work rather
 * than as a bare headword. Falls back to the whole reply when there's no sentence punctuation.
 */
function carrierSentence(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const opened = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("! "),
    before.lastIndexOf("? "),
    before.lastIndexOf("\n"),
  );
  const after = text.slice(end);
  const closed = after.search(/[.!?](\s|$)|\n/);
  // Not `normalize`: that is tuned for expressions and would strip the sentence's own final
  // punctuation, which the carrier needs — it is shown as a quotation, not as a headword.
  return stripRepertoireMarkers(
    text.slice(opened === -1 ? 0 : opened + 1, closed === -1 ? text.length : end + closed + 1),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Expressions the model marked inline, in order of appearance and de-duplicated. This is the
 * authoritative list: the trailer only supplies glosses for them. A trailer entry that was never
 * marked in the reply is dropped, since we would have nothing to highlight it against.
 */
function markedExpressions(text: string): { expression: string; carrier: string }[] {
  const seen = new Set<string>();
  const found: { expression: string; carrier: string }[] = [];
  for (const match of text.matchAll(MARKED)) {
    const expression = normalize(match[1]);
    if (!isPlausibleExpression(expression)) continue;
    const key = expression.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const start = match.index ?? 0;
    found.push({ expression, carrier: carrierSentence(text, start, start + match[0].length) });
  }
  return found;
}

/** Map of lowercased expression -> gloss, from the trailer body. */
function parseGlosses(body: string): Map<string, string> {
  const glosses = new Map<string, string>();
  for (const entry of body.split(";")) {
    const [rawExpression, ...rest] = entry.split(GLOSS_SEPARATOR);
    const expression = normalize(rawExpression ?? "");
    if (!expression) continue;
    glosses.set(expression.toLowerCase(), normalize(rest.join(" ")));
  }
  return glosses;
}

/**
 * Drop a line that is nothing but one bolded blob which is not a plausible expression — i.e. the
 * model restating its trailer as a bold summary above the trailer. Left in, it would be read
 * aloud as a definition list in the middle of a conversation.
 */
function dropRestatedGlossLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const whole = line.trim().match(/^\*\*([\s\S]+)\*\*$/);
      return !whole || isPlausibleExpression(normalize(whole[1]));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseRepertoire(reply: string): ParsedRepertoire {
  const source = reply ?? "";
  const trailer = source.match(TRAILER);
  const display = dropRestatedGlossLines((trailer ? source.slice(0, trailer.index) : source).trimEnd());
  const plain = stripRepertoireMarkers(display);

  const expressions = markedExpressions(display);
  if (expressions.length === 0) return { display, plain, items: [] };

  const glosses = trailer ? parseGlosses(trailer[1]) : new Map<string, string>();
  const items = expressions.map(({ expression, carrier }) => ({
    expression,
    gloss: glosses.get(expression.toLowerCase()) ?? "",
    carrier: carrier || undefined,
  }));
  return { display, plain, items };
}

export interface RepertoireSegment {
  text: string;
  /** Set when this segment is a marked expression; carries its gloss for the tap target. */
  item?: RepertoireItem;
}

/**
 * Split a `display` string into alternating plain and marked segments so the bubble can render
 * highlights without `dangerouslySetInnerHTML`.
 */
export function segmentRepertoire(display: string, items: RepertoireItem[]): RepertoireSegment[] {
  const byExpression = new Map(items.map((item) => [item.expression.toLowerCase(), item]));
  const segments: RepertoireSegment[] = [];
  let cursor = 0;

  for (const match of display.matchAll(MARKED)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: display.slice(cursor, start) });
    const expression = normalize(match[1]);
    const item = byExpression.get(expression.toLowerCase());
    segments.push(item ? { text: match[1], item } : { text: match[1] });
    cursor = start + match[0].length;
  }
  if (cursor < display.length) segments.push({ text: display.slice(cursor) });
  return segments.length > 0 ? segments : [{ text: display }];
}

/* ─────────────────────────── uptake: did they say it back? ─────────────────────────── */

/**
 * Slots a model writes into an expression rather than a real word, matched by any single token
 * so "**someone's cup of tea**" is credited when the learner says "my cup of tea".
 */
const PLACEHOLDER_TOKENS = new Set(["someone", "someones", "somebody", "somebodys", "sb", "sth", "ones"]);
/** Stands in for a placeholder token; not producible by `tokenize`, so it can't collide. */
const PLACEHOLDER = " ";

/**
 * Letters and digits only; apostrophes are dropped so `one's` → `ones`. Placeholders are marked
 * before stemming, which would otherwise chew `someones` down to `someon` and lose them.
 */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((token) => (PLACEHOLDER_TOKENS.has(token) ? PLACEHOLDER : stem(token)));
}

/**
 * Crude suffix stripping so an inflected reuse still counts — the learner who answers "that
 * turned out to be a false economy" has used "**turn out to be**". This is credit-giving, not
 * grading, so it leans permissive: a near miss the learner plainly earned is worth more than
 * a precise rule that silently withholds it.
 */
function stem(token: string): string {
  let out = token;
  if (out.length > 4 && out.endsWith("ies")) out = `${out.slice(0, -3)}y`;
  else if (out.length > 5 && out.endsWith("ing")) out = out.slice(0, -3);
  else if (out.length > 4 && out.endsWith("ed")) out = out.slice(0, -2);
  else if (out.length > 4 && out.endsWith("es")) out = out.slice(0, -2);
  else if (out.length > 3 && out.endsWith("s") && !out.endsWith("ss")) out = out.slice(0, -1);
  // Drop a silent final -e last, so a base form meets its own inflection: without it "hedge"
  // stems to itself while "hedged" stems to "hedg", and every -e verb fails to match.
  return out.length > 3 && out.endsWith("e") ? out.slice(0, -1) : out;
}

/** Whether `needle` appears as a contiguous run in `haystack`, placeholders matching anything. */
function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      const token = needle[offset];
      if (token === PLACEHOLDER) continue;
      if (haystack[start + offset] !== token) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * The expressions a learner turn actually reuses. Exposure alone does not move an advanced
 * learner — the plateau at C1-C2 is that they perform sophisticated functions with B1-B2 lexis —
 * so the partner feeding expressions is only half the loop. This is the other half: it detects
 * the reuse so the session can show what was taken up and what was only heard.
 */
export function detectRepertoireUse(text: string, items: RepertoireItem[]): RepertoireItem[] {
  const spoken = tokenize(text);
  if (spoken.length === 0) return [];
  return items.filter((item) => !item.usedAt && containsSequence(spoken, tokenize(item.expression)));
}

/** Stamp the given expressions as used, leaving the rest (and their order) untouched. */
export function markRepertoireUsed(
  items: RepertoireItem[],
  used: RepertoireItem[],
  now = Date.now(),
): RepertoireItem[] {
  if (used.length === 0) return items;
  const keys = new Set(used.map((item) => item.expression.toLowerCase()));
  return items.map((item) =>
    item.usedAt || !keys.has(item.expression.toLowerCase()) ? item : { ...item, usedAt: now },
  );
}

/** How much of what the partner handed over the learner actually reached for. */
export function repertoireUptake(items: RepertoireItem[]): { used: number; total: number } {
  return { used: items.filter((item) => item.usedAt).length, total: items.length };
}

/** Expressions still only heard, newest last — the candidates for a pushed-output retry. */
export function unusedRepertoire(items: RepertoireItem[]): RepertoireItem[] {
  return items.filter((item) => !item.usedAt);
}

/**
 * Expressions already handed over in earlier sessions. Within one conversation the partner can
 * see what it has given from its own history; across conversations it cannot, so without this it
 * reaches for the same handful of high-frequency idioms on day 1 and day 30.
 *
 * Takes conversations newest-first (as the recent list is ordered) and returns the newest `limit`
 * expressions in chronological order, since the prompt keeps the tail when it has to truncate.
 */
export function recentTaughtExpressions(
  conversations: { repertoire?: RepertoireItem[] }[],
  limit = 24,
): string[] {
  const seen = new Set<string>();
  const newestFirst: string[] = [];
  for (const conversation of conversations) {
    for (const item of conversation.repertoire ?? []) {
      const key = item.expression.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      newestFirst.push(item.expression);
      if (newestFirst.length >= limit) return newestFirst.reverse();
    }
  }
  return newestFirst.reverse();
}

export const REPERTOIRE_CARD_PREFIX = "repertoire-";

/**
 * Turn saved expressions into a discovery-path deck: the expression is the answer and its gloss
 * is the prompt, so the card trains *production* — the learner has to reach for the phrase from
 * meaning, which is the whole point of collecting it.
 *
 * Expressions the model never glossed are skipped rather than guessed at: without a meaning there
 * is no prompt that can be answered, only one that can be stared at.
 */
export function buildRepertoireCards(
  items: RepertoireItem[],
  opts: { context: string; conversationId: string; now?: number },
): { cards: Card[]; candidates: PhraseCandidate[]; skipped: RepertoireItem[] } {
  const now = opts.now ?? Date.now();
  const usable = items.filter((item) => item.gloss);
  const cards: Card[] = [];
  const candidates: PhraseCandidate[] = [];

  usable.forEach((item, index) => {
    const id = `${REPERTOIRE_CARD_PREFIX}${opts.conversationId}-${index}`;
    candidates.push({
      id,
      sourceId: opts.conversationId,
      text: item.carrier || item.expression,
      note: `Picked up while talking about ${opts.context}.`,
      status: "accepted",
      createdAt: now,
    });
    cards.push({
      id,
      // The carrier sentence is the prompt when we have it: recalling a collocation from a
      // bare definition is a quiz, recalling it from the situation that needed it is practice.
      front: item.carrier
        ? `${item.gloss} — say it the way your partner did:\n"${item.carrier.replace(item.expression, "…")}"`
        : `${item.gloss} — say it the way your partner did`,
      back: item.expression,
      direction: "production",
      concept: `expression: ${item.expression}`,
      skill: "vocabulary",
      context: opts.context,
      source: { kind: "phrase", id },
      createdAt: now,
    });
  });

  return { cards, candidates, skipped: items.filter((item) => !item.gloss) };
}

/**
 * Merge a turn's items into the session list, keeping first-seen order and the richest detail.
 * An existing entry only ever gains: a gloss or carrier it was missing, never a lost `usedAt`.
 */
export function mergeRepertoire(existing: RepertoireItem[], incoming: RepertoireItem[]): RepertoireItem[] {
  const merged = [...existing];
  const index = new Map(merged.map((item, position) => [item.expression.toLowerCase(), position]));
  for (const item of incoming) {
    const key = item.expression.toLowerCase();
    const position = index.get(key);
    if (position === undefined) {
      index.set(key, merged.length);
      merged.push(item);
      continue;
    }
    const current = merged[position];
    const gloss = current.gloss || item.gloss;
    const carrier = current.carrier || item.carrier;
    const usedAt = current.usedAt ?? item.usedAt;
    if (gloss !== current.gloss || carrier !== current.carrier || usedAt !== current.usedAt) {
      merged[position] = { ...current, gloss, carrier, usedAt };
    }
  }
  return merged;
}
