import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { Conversation } from "@/lib/store/repository";
import { meaningTextOfCard, targetTextOfCard } from "@/lib/cards/orientation";

export type TransferActivityKind = "phrase_to_situation" | "open_cloze" | "correction_recall" | "topic_retell" | "reading_to_meaning" | "listening_recognition" | "error_reconstruction";

export interface TransferActivity {
  id: string;
  kind: TransferActivityKind;
  /**
   * Message template, not finished prose. The learner's own phrase arrives in
   * `promptVars`, so the surface can translate the sentence and then interpolate —
   * a prompt built here with the phrase already spliced in could never match a key.
   */
  prompt: string;
  promptVars?: Record<string, string>;
  expected?: string;
  sourceId: string;
  audioUrl?: string;
  /** Device speech fallback when a correction has no licensed source clip. */
  speechText?: string;
  /** Error-driven activities carry the provenance needed to measure avoidance. */
  errorIds?: string[];
  recurring?: boolean;
  /**
   * The prompt *asks* for a new situation. It is not evidence that one was produced — that
   * comes from `verifyTransfer` against the learner's actual response. Naming this
   * `newContext` and copying it into the saved attempt is how the progress panel came to
   * count prompts shown as transfers achieved.
   */
  newContextRequested?: boolean;
  /** True when the activity requires speaking rather than recognition or copying. */
  spoken?: boolean;
  concept?: string;
  patternId?: string;
  /** Target frame with `___`, when the card carries a pattern. Enables offline verification. */
  patternFrame?: string;
  /** The sentence the learner studied, to measure content reuse against. */
  sourceExample?: string;
}

export interface TransferMetrics {
  cardRecall: number;
  openProduction: number;
  /**
   * Attempts at a new-situation prompt. This counts prompts the learner engaged with, and
   * is deliberately no longer called "crossContext" — the old name claimed transfer while
   * measuring display.
   */
  crossContextAttempts: number;
  /** Of those, the ones the app could actually judge (the item had a pattern to check). */
  crossContextVerified: number;
  /** Of the verified ones, the ones that carried the pattern into new content. */
  crossContextTransferred: number;
  /**
   * `crossContextTransferred / crossContextVerified`, or null when nothing was verifiable.
   * Null rather than zero: this is the number the product's central claim rests on, and an
   * unmeasured claim reported as 0% is as wrong as one reported as 100%.
   */
  crossContextRate: number | null;
  retells: number;
  correctionRecalls: number;
  spokenRetrieval: number;
  avoidedErrors: number;
}

/**
 * Keep card recognition separate from the evidence that the method actually cares
 * about: carrying useful language into a new situation and avoiding an old error.
 */
export function transferMetrics(
  attempts: Array<{
    transferKind?: TransferActivityKind;
    newContext?: boolean;
    transferVerified?: boolean;
    retold?: boolean;
    spoken?: boolean;
    avoidedErrorIds?: string[];
  }>,
): TransferMetrics {
  const metrics: TransferMetrics = {
    cardRecall: 0,
    openProduction: 0,
    crossContextAttempts: 0,
    crossContextVerified: 0,
    crossContextTransferred: 0,
    crossContextRate: null,
    retells: 0,
    correctionRecalls: 0,
    spokenRetrieval: 0,
    avoidedErrors: 0,
  };
  for (const attempt of attempts) {
    if (attempt.transferKind === "listening_recognition") metrics.cardRecall += 1;
    if (attempt.transferKind && attempt.transferKind !== "listening_recognition") metrics.openProduction += 1;
    // An attempt counts once it was asked for; verification is a separate, stricter fact.
    if (attempt.newContext !== undefined || attempt.transferVerified !== undefined) {
      metrics.crossContextAttempts += 1;
      if (attempt.transferVerified) {
        metrics.crossContextVerified += 1;
        if (attempt.newContext) metrics.crossContextTransferred += 1;
      }
    }
    if (attempt.retold || attempt.transferKind === "topic_retell") metrics.retells += 1;
    if (attempt.transferKind === "correction_recall") metrics.correctionRecalls += 1;
    if (attempt.spoken && attempt.transferKind && attempt.transferKind !== "listening_recognition") metrics.spokenRetrieval += 1;
    metrics.avoidedErrors += attempt.avoidedErrorIds?.length ?? 0;
  }
  metrics.crossContextRate = metrics.crossContextVerified === 0
    ? null
    : metrics.crossContextTransferred / metrics.crossContextVerified;
  return metrics;
}

/** Build open-production prompts from durable language evidence, not completion flags. */
export function buildTransferActivities(
  cards: Card[],
  errors: ErrorEvent[],
  conversations: Conversation[] = [],
  limit = 6,
): TransferActivity[] {
  const activities: TransferActivity[] = [];
  // Reserve capacity for both learner memory sources. Without this reservation a
  // learner with many recurring errors never gets phrase transfer at all.
  const errorLimit = Math.min(errors.length, Math.max(1, Math.ceil(limit / 2)));

  // Error-driven and conversational transfer comes first. A card-only queue could
  // otherwise fill the entire session and leave recurring production problems in FSRS
  // without ever returning to the learner's own output.
  const errorTypeCounts = new Map<string, number>();
  for (const error of errors) {
    for (const type of error.errorTypes) errorTypeCounts.set(type, (errorTypeCounts.get(type) ?? 0) + 1);
  }
  const orderedErrors = [...errors].sort((left, right) => {
    const leftCount = left.errorTypes.reduce((sum, type) => sum + (errorTypeCounts.get(type) ?? 0), 0);
    const rightCount = right.errorTypes.reduce((sum, type) => sum + (errorTypeCounts.get(type) ?? 0), 0);
    return rightCount - leftCount || right.createdAt - left.createdAt;
  });
  const recurringError = orderedErrors.find((error) =>
    error.errorTypes.some((type) => (errorTypeCounts.get(type) ?? 0) > 1),
  );

  // A recurring correction must reappear as listening, speaking, retelling, and
  // reconstruction — not merely as a card. Reserve one slot for phrase transfer.
  if (recurringError && limit >= 5) {
    const base = {
      sourceId: recurringError.id,
      errorIds: [recurringError.id],
      recurring: true,
      newContextRequested: true,
    };
    activities.push(
      {
        id: `recurring-error-listening-${recurringError.id}`,
        kind: "listening_recognition",
        prompt: "Listen to the clearer form. What did you hear before revealing the text?",
        expected: recurringError.corrected,
        speechText: recurringError.corrected,
        ...base,
      },
      {
        id: `recurring-error-speaking-${recurringError.id}`,
        kind: "correction_recall",
        prompt: "Say the corrected idea in a new situation: “{phrase}”",
        promptVars: { phrase: recurringError.original },
        expected: recurringError.corrected,
        spoken: true,
        ...base,
      },
      {
        id: `recurring-error-retell-${recurringError.id}`,
        kind: "topic_retell",
        prompt: "Retell a short familiar situation while avoiding this earlier error: “{phrase}”.",
        promptVars: { phrase: recurringError.original },
        expected: recurringError.corrected,
        spoken: true,
        ...base,
      },
      {
        id: `recurring-error-reconstruction-${recurringError.id}`,
        kind: "error_reconstruction",
        prompt: "Rebuild the clearer sentence from memory for this earlier error: “{phrase}”.",
        promptVars: { phrase: recurringError.original },
        expected: recurringError.corrected,
        ...base,
      },
    );
  }
  for (const error of orderedErrors.slice(0, Math.max(0, errorLimit - activities.length))) {
    activities.push({
      id: `transfer-error-${error.id}`,
      kind: "correction_recall",
      prompt: "Say the corrected idea in a new situation: “{phrase}”",
      promptVars: { phrase: error.original },
      expected: error.corrected,
      sourceId: error.id,
      errorIds: [error.id],
      recurring: (errorTypeCounts.get(error.errorTypes[0] ?? "other") ?? 0) > 1,
      newContextRequested: true,
      spoken: true,
    });
  }
  const appendSource = (activity: TransferActivity) => {
    if (activities.length >= limit) return;
    activities.push(activity);
  };
  for (const conversation of conversations) {
    if (activities.length >= limit) break;
    const userTurn = conversation.turns.find((turn) => turn.role === "user");
    appendSource({
      id: `transfer-topic-${conversation.id}`,
      kind: "topic_retell",
      prompt: "Retell one useful point from your {context} conversation in a new way.",
      promptVars: { context: conversation.context },
      expected: userTurn?.text,
      sourceId: conversation.id,
      newContextRequested: true,
      spoken: true,
    });
  }
  // Recognition and production siblings represent one item, not two transfer wins.
  const uniqueCards = [...new Map(cards.map((card) => [card.patternId || card.source.id, card])).values()];
  for (const card of uniqueCards) {
    if (activities.length >= limit) break;
    const target = targetTextOfCard(card);
    const meaning = meaningTextOfCard(card);
    appendSource({
      id: `transfer-phrase-${card.id}`,
      kind: "phrase_to_situation",
      prompt: "Express this idea in English in a new situation from your life: “{phrase}”",
      promptVars: { phrase: meaning },
      expected: target,
      sourceId: card.id,
      newContextRequested: true,
      spoken: true,
      concept: card.concept,
      patternId: card.patternId,
      patternFrame: card.patternFrame,
      sourceExample: card.examples?.[0] ?? target,
    });
    if (card.audioClipPath) {
      appendSource({
        id: `transfer-listening-${card.id}`,
        kind: "listening_recognition",
        prompt: "Listen first. Explain what you recognized before checking the phrase.",
        expected: target,
        sourceId: card.id,
        audioUrl: card.audioClipPath,
      });
    }
    if (activities.length >= limit) break;
    appendSource({
      id: `transfer-reading-${card.id}`,
      kind: "reading_to_meaning",
      prompt: "Read “{phrase}” and explain its meaning in your own words.",
      promptVars: { phrase: target },
      expected: meaning,
      sourceId: card.id,
    });
    if (activities.length >= limit) break;
    appendSource({
      id: `transfer-cloze-${card.id}`,
      kind: "open_cloze",
      prompt: "Say a new sentence that means the same as “{phrase}”.",
      promptVars: { phrase: meaning },
      expected: target,
      sourceId: card.id,
      newContextRequested: true,
      spoken: true,
      concept: card.concept,
      patternId: card.patternId,
      patternFrame: card.patternFrame,
      sourceExample: card.examples?.[0] ?? target,
    });
  }
  return activities;
}
