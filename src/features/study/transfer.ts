import type { Card, ErrorEvent } from "@/lib/cards/schema";
import type { Conversation } from "@/lib/store/repository";

export type TransferActivityKind = "phrase_to_situation" | "open_cloze" | "correction_recall" | "topic_retell" | "reading_to_meaning" | "listening_recognition" | "error_reconstruction";

export interface TransferActivity {
  id: string;
  kind: TransferActivityKind;
  prompt: string;
  expected?: string;
  sourceId: string;
  audioUrl?: string;
  /** Device speech fallback when a correction has no licensed source clip. */
  speechText?: string;
  /** Error-driven activities carry the provenance needed to measure avoidance. */
  errorIds?: string[];
  recurring?: boolean;
  /** Transfer is only real when the learner must carry the language somewhere new. */
  newContext?: boolean;
  /** True when the activity requires speaking rather than recognition or copying. */
  spoken?: boolean;
}

export interface TransferMetrics {
  cardRecall: number;
  openProduction: number;
  crossContext: number;
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
    retold?: boolean;
    spoken?: boolean;
    avoidedErrorIds?: string[];
  }>,
): TransferMetrics {
  const metrics: TransferMetrics = {
    cardRecall: 0,
    openProduction: 0,
    crossContext: 0,
    retells: 0,
    correctionRecalls: 0,
    spokenRetrieval: 0,
    avoidedErrors: 0,
  };
  for (const attempt of attempts) {
    if (attempt.transferKind === "listening_recognition") metrics.cardRecall += 1;
    if (attempt.transferKind && attempt.transferKind !== "listening_recognition") metrics.openProduction += 1;
    if (attempt.newContext) metrics.crossContext += 1;
    if (attempt.retold || attempt.transferKind === "topic_retell") metrics.retells += 1;
    if (attempt.transferKind === "correction_recall") metrics.correctionRecalls += 1;
    if (attempt.spoken && attempt.transferKind && attempt.transferKind !== "listening_recognition") metrics.spokenRetrieval += 1;
    metrics.avoidedErrors += attempt.avoidedErrorIds?.length ?? 0;
  }
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
      newContext: true,
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
        prompt: `Say the corrected idea in a new situation: “${recurringError.original}”`,
        expected: recurringError.corrected,
        spoken: true,
        ...base,
      },
      {
        id: `recurring-error-retell-${recurringError.id}`,
        kind: "topic_retell",
        prompt: `Retell a short familiar situation while avoiding this earlier error: “${recurringError.original}”.`,
        expected: recurringError.corrected,
        spoken: true,
        ...base,
      },
      {
        id: `recurring-error-reconstruction-${recurringError.id}`,
        kind: "error_reconstruction",
        prompt: `Rebuild the clearer sentence from memory for this earlier error: “${recurringError.original}”.`,
        expected: recurringError.corrected,
        ...base,
      },
    );
  }
  for (const error of orderedErrors.slice(0, Math.max(0, errorLimit - activities.length))) {
    activities.push({
      id: `transfer-error-${error.id}`,
      kind: "correction_recall",
      prompt: `Say the corrected idea in a new situation: “${error.original}”`,
      expected: error.corrected,
      sourceId: error.id,
      errorIds: [error.id],
      recurring: (errorTypeCounts.get(error.errorTypes[0] ?? "other") ?? 0) > 1,
      newContext: true,
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
      prompt: `Retell one useful point from your ${conversation.context} conversation in a new way.`,
      expected: userTurn?.text,
      sourceId: conversation.id,
      newContext: true,
      spoken: true,
    });
  }
  for (const card of cards) {
    if (activities.length >= limit) break;
    appendSource({
      id: `transfer-phrase-${card.id}`,
      kind: "phrase_to_situation",
      prompt: `Use “${card.front}” in a new situation from your life.`,
      expected: card.front,
      sourceId: card.id,
      newContext: true,
      spoken: true,
    });
    if (card.audioClipPath) {
      appendSource({
        id: `transfer-listening-${card.id}`,
        kind: "listening_recognition",
        prompt: "Listen first. Explain what you recognized before checking the phrase.",
        expected: card.front,
        sourceId: card.id,
        audioUrl: card.audioClipPath,
      });
    }
    if (activities.length >= limit) break;
    appendSource({
      id: `transfer-reading-${card.id}`,
      kind: "reading_to_meaning",
      prompt: `Read “${card.front}” and explain its meaning in your own words.`,
      expected: card.back,
      sourceId: card.id,
    });
    if (activities.length >= limit) break;
    appendSource({
      id: `transfer-cloze-${card.id}`,
      kind: "open_cloze",
      prompt: `Say a new sentence that means the same as “${card.back}”.`,
      expected: card.front,
      sourceId: card.id,
      newContext: true,
      spoken: true,
    });
  }
  return activities;
}
