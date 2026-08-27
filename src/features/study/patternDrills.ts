import type { Card } from "@/lib/cards/schema";
import type { LanguagePattern } from "@/lib/language/pattern";
import { isDrillablePattern, isNovelFilling, slotFilling, usesFrame } from "@/lib/language/pattern";
import { applyTransferRules } from "@/features/learn/transferErrors";
import { placeAnswer, stableNumber } from "@/features/learn/lessonFlow";
import { verifyTransfer, type TransferCheck } from "./transferVerification";

/**
 * The exercises that sit between "I remember this sentence" and "I can use this structure".
 *
 * The app could already ask a learner to retrieve a phrase and to write in a new situation,
 * but nothing in between: no step where the frame is held constant and the content changes.
 * That missing rung is why a learner could run the whole loop for months without ever
 * leaving the sentence they were taught.
 *
 * Every drill here is checkable offline, because the provider-free path is the method — an
 * exercise that needs an API key is a feature, not a rung on the ladder.
 */

export type PatternDrillKind =
  /** Keep the frame, change the content. The first step out of the sentence. */
  | "slot_substitution"
  /** Same frame, constrained by a situation, still not the source context. */
  | "constrained_cloze"
  /** Tell the target structure apart from a plausible wrong neighbour. */
  | "minimal_pair"
  /** Full situational prompt with no frame shown. The last rung before spontaneous use. */
  | "new_situation";

export interface PatternDrill {
  id: string;
  kind: PatternDrillKind;
  patternId: string;
  /** i18n message template; the surface interpolates `promptVars`. */
  prompt: string;
  promptVars?: Record<string, string>;
  frame: string;
  slot: string;
  /** Fillings already taught, shown for substitution, withheld for new_situation. */
  taught: string[];
  /** The sentence the learner originally studied. Reuse of its content is what we detect. */
  sourceExample: string;
  /** minimal_pair only: the two options, one right. */
  options?: string[];
  answer?: string;
  cardId: string;
}

function patternOf(card: Card): LanguagePattern | undefined {
  const candidate = {
    id: card.patternId ?? "",
    frame: card.patternFrame ?? "",
    slot: card.patternSlot ?? "",
    examples: card.examples ?? [],
    contrast: card.patternContrast,
  };
  return isDrillablePattern(candidate) ? candidate : undefined;
}

/** Cards whose pattern is complete enough to drill. Everything else is skipped silently. */
export function drillablePatterns(cards: Card[]): { card: Card; pattern: LanguagePattern }[] {
  const seen = new Set<string>();
  const result: { card: Card; pattern: LanguagePattern }[] = [];
  for (const card of cards) {
    const pattern = patternOf(card);
    if (!pattern || seen.has(pattern.id)) continue;
    seen.add(pattern.id);
    result.push({ card, pattern });
  }
  return result;
}

export interface DrillOptions {
  /** Which rung the learner has reached on this pattern. See `patternLadder.ts`. */
  stageOf?: (patternId: string) => PatternDrillKind;
  limit?: number;
}

export function buildPatternDrills(cards: Card[], options: DrillOptions = {}): PatternDrill[] {
  const limit = options.limit ?? 5;
  const drills: PatternDrill[] = [];
  for (const { card, pattern } of drillablePatterns(cards)) {
    if (drills.length >= limit) break;
    const kind = options.stageOf?.(pattern.id) ?? "slot_substitution";
    const sourceExample = pattern.examples[0];
    const base = {
      patternId: pattern.id,
      frame: pattern.frame,
      slot: pattern.slot,
      taught: pattern.examples,
      sourceExample,
      cardId: card.id,
    };

    if (kind === "minimal_pair" && pattern.contrast) {
      drills.push({
        ...base,
        id: `pair-${pattern.id}`,
        kind: "minimal_pair",
        prompt: "Which one is correct English?",
        // The correct member is placed by seed, never fixed in slot one: a learner who
        // notices the answer is always first stops reading the options. Same helper the
        // listening challenge uses, so the convention holds across the app.
        options: placeAnswer(sourceExample, [pattern.contrast], stableNumber(pattern.id), 2),
        answer: sourceExample,
      });
      continue;
    }

    if (kind === "new_situation") {
      drills.push({
        ...base,
        id: `situation-${pattern.id}`,
        kind: "new_situation",
        // No frame in the prompt: at this rung the learner has to reach for it themselves.
        prompt: "Write about a situation from your own week where you would say something like “{example}”. Do not reuse its words.",
        promptVars: { example: sourceExample },
      });
      continue;
    }

    if (kind === "constrained_cloze") {
      drills.push({
        ...base,
        id: `cloze-${pattern.id}`,
        kind: "constrained_cloze",
        prompt: "Complete “{frame}” for something that happened to you this week. The blank takes {slot}.",
        promptVars: { frame: pattern.frame, slot: pattern.slot },
      });
      continue;
    }

    drills.push({
      ...base,
      id: `slot-${pattern.id}`,
      kind: "slot_substitution",
      prompt: "Keep “{frame}” and change the rest. You have already used: {taught}. Write a different one.",
      promptVars: { frame: pattern.frame, taught: pattern.examples.slice(0, 3).join(" · "), slot: pattern.slot },
    });
  }
  return drills;
}

export interface DrillResult extends TransferCheck {
  /** True when the frame survived. */
  frameKept: boolean;
  /** True when the learner's filling is not one the app taught them. */
  novelFilling: boolean;
  /** The content words the learner supplied. Feeds the active-vocabulary metric. */
  filling: string[];
  /** Passed the drill's own bar, which differs per rung. */
  passed: boolean;
}

/**
 * Grade one drill offline.
 *
 * The bar rises with the rung: substitution asks only for a different filling in valid
 * English; a new situation additionally requires that the learner's content is not the
 * source sentence's content. That last condition is the one the app used to assert without
 * checking.
 */
export function gradeDrill(drill: PatternDrill, response: string): DrillResult {
  if (drill.kind === "minimal_pair") {
    const passed = response.trim().toLowerCase() === (drill.answer ?? "").trim().toLowerCase();
    return {
      verdict: passed ? "transferred" : "form_error",
      transferred: passed,
      verified: true,
      frameKept: passed,
      novelFilling: false,
      filling: [],
      formIssues: [],
      passed,
    };
  }

  const check = verifyTransfer({
    response,
    frame: drill.frame,
    // Substitution is not asked to leave the source's subject matter — only to change the
    // slot — so its content-reuse test is the novelty of the filling, checked below.
    sourceExample: drill.kind === "new_situation" ? drill.sourceExample : undefined,
  });
  const frameKept = usesFrame(response, drill.frame) === true;
  const pattern: LanguagePattern = {
    id: drill.patternId,
    frame: drill.frame,
    slot: drill.slot,
    examples: drill.taught,
  };
  const novelFilling = frameKept && isNovelFilling(response, pattern);
  const filling = frameKept ? slotFilling(response, drill.frame) : [];
  const clean = applyTransferRules(response).hits.length === 0;

  const passed = drill.kind === "new_situation"
    ? check.transferred && novelFilling
    : frameKept && novelFilling && clean;

  return { ...check, frameKept, novelFilling, filling, passed };
}
