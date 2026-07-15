import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";

/** Shared learner-facing categories. Text correctness and pronunciation stay separate. */
export type FeedbackCategory =
  | "messageClarity"
  | "grammar"
  | "vocabulary"
  | "wordOrder"
  | "pronunciation"
  | "naturalness"
  | "missingInformation";

export type FeedbackPriority = "blocking" | "important" | "polish";

export interface FeedbackPriorityOptions {
  /** Counts from the current response plus prior learner errors. */
  recurrenceCounts?: Map<string, number>;
  lessonRelevantIds?: Set<string>;
  lessonRelevance?: number;
}

export interface FeedbackIssueBase {
  id: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  communicationImpact: number;
  recurrenceCount: number;
  lessonRelevance: number;
  evidence: string;
  suggestedRetrySupport: string;
}

export interface FeedbackIssue extends FeedbackIssueBase {
  event: ErrorEvent;
}

export interface LocalFeedbackIssue extends FeedbackIssueBase {
  /** Local lesson feedback has no provider ErrorEvent, but renders identically. */
  event?: ErrorEvent;
}

/** Render contract shared by provider-backed and provider-free feedback surfaces. */
export type RenderableFeedbackIssue = FeedbackIssueBase & { event?: ErrorEvent };

export function renderableFeedbackIssue(issue: FeedbackIssue | LocalFeedbackIssue): RenderableFeedbackIssue {
  return { ...issue };
}

const CATEGORY_BY_ERROR: Record<ErrorType, FeedbackCategory> = {
  collocation: "naturalness",
  preposition: "grammar",
  tense: "grammar",
  article: "grammar",
  "word-order": "wordOrder",
  idiom: "naturalness",
  vocabulary: "vocabulary",
  register: "naturalness",
  "missing-information": "missingInformation",
  pronunciation: "pronunciation",
  other: "messageClarity",
};

const IMPACT_BY_CATEGORY: Record<FeedbackCategory, number> = {
  messageClarity: 5,
  missingInformation: 5,
  grammar: 4,
  wordOrder: 4,
  vocabulary: 3,
  pronunciation: 3,
  naturalness: 1,
};

const PRIORITY_RANK: Record<FeedbackPriority, number> = {
  polish: 0,
  important: 1,
  blocking: 2,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Stable identity used to recognize the same weakness across separate attempts. */
export function feedbackKey(event: Pick<ErrorEvent, "original" | "corrected" | "errorTypes">): string {
  return [
    [...event.errorTypes].sort().join(","),
    normalize(event.original),
    normalize(event.corrected),
  ].join("|");
}

/** Build recurrence counts once and reuse them across lesson, correction, and progress UI. */
export function recurrenceCounts(events: ErrorEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = feedbackKey(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function recurrenceFor(event: ErrorEvent, options: FeedbackPriorityOptions): number {
  return options.recurrenceCounts?.get(event.id)
    ?? options.recurrenceCounts?.get(feedbackKey(event))
    ?? 0;
}

function inferredPriority(
  category: FeedbackCategory,
  recurrenceCount: number,
  lessonRelevance: number,
): FeedbackPriority {
  const communicationImpact = IMPACT_BY_CATEGORY[category];
  return communicationImpact >= 5 || recurrenceCount >= 2
    ? "blocking"
    : communicationImpact >= 3 || lessonRelevance > 0
      ? "important"
      : "polish";
}

export function feedbackIssue(
  event: ErrorEvent,
  options: FeedbackPriorityOptions & { recurrenceCount?: number } = {},
): FeedbackIssue {
  const category = CATEGORY_BY_ERROR[event.errorTypes[0] ?? "other"];
  const recurrenceCount = options.recurrenceCount ?? recurrenceFor(event, options);
  const lessonRelevance = options.lessonRelevance ?? 0;
  const priority = inferredPriority(category, recurrenceCount, lessonRelevance);
  return {
    id: event.id,
    event,
    category,
    priority,
    communicationImpact: IMPACT_BY_CATEGORY[category],
    recurrenceCount,
    lessonRelevance,
    evidence: event.rationale ?? `${event.original} → ${event.corrected}`,
    suggestedRetrySupport: priority === "blocking"
      ? "Say or write the same idea again with this correction."
      : "Try the same idea once more if it is useful now.",
  };
}

/** Normalize provider-free guided-lesson feedback into the shared contract. */
export function localFeedbackIssue(
  issue: {
    type: ErrorType;
    category: "messageClarity" | "lessonLanguage" | "mechanics";
    priority: FeedbackPriority;
    note: string;
  },
  index: number,
  options: FeedbackPriorityOptions = {},
): LocalFeedbackIssue {
  const category: FeedbackCategory =
    issue.category === "lessonLanguage" ? "vocabulary" : issue.category === "mechanics" ? "grammar" : "messageClarity";
  const recurrenceCount = options.recurrenceCounts?.get(`${issue.type}|${normalize(issue.note)}`) ?? 0;
  const inferred = inferredPriority(category, recurrenceCount, issue.category === "lessonLanguage" ? 1 : 0);
  const priority: FeedbackPriority = PRIORITY_RANK[issue.priority] > PRIORITY_RANK[inferred]
    ? issue.priority
    : inferred;
  return {
    id: `local-${issue.type}-${index}`,
    category,
    priority,
    communicationImpact: IMPACT_BY_CATEGORY[category],
    recurrenceCount,
    lessonRelevance: issue.category === "lessonLanguage" ? 1 : 0,
    evidence: issue.note,
    suggestedRetrySupport: priority === "blocking"
      ? "Say or write the same idea again with this correction."
      : "Try the same idea once more if it is useful now.",
  };
}

export function prioritizeLocalFeedback(
  issues: Array<{
    type: ErrorType;
    category: "messageClarity" | "lessonLanguage" | "mechanics";
    priority: FeedbackPriority;
    note: string;
  }>,
  options: FeedbackPriorityOptions = {},
): LocalFeedbackIssue[] {
  return issues
    .map((issue, index) => localFeedbackIssue(issue, index, options))
    .sort((left, right) =>
      PRIORITY_RANK[right.priority] * 100 + right.communicationImpact + right.recurrenceCount * 4 + right.lessonRelevance -
      (PRIORITY_RANK[left.priority] * 100 + left.communicationImpact + left.recurrenceCount * 4 + left.lessonRelevance),
    );
}

/** Keep retry feedback focused: communication-blocking and recurring issues first. */
export function prioritizeFeedback(
  events: ErrorEvent[],
  options: FeedbackPriorityOptions = {},
): FeedbackIssue[] {
  const effectiveOptions = options.recurrenceCounts
    ? options
    : { ...options, recurrenceCounts: recurrenceCounts(events) };
  return events
    .map((event) => feedbackIssue(event, {
      recurrenceCount: recurrenceFor(event, effectiveOptions),
      lessonRelevance: effectiveOptions.lessonRelevantIds?.has(event.id) ? 1 : 0,
    }))
    .sort((left, right) =>
      PRIORITY_RANK[right.priority] * 100 + right.communicationImpact + right.recurrenceCount * 4 + right.lessonRelevance -
      (PRIORITY_RANK[left.priority] * 100 + left.communicationImpact + left.recurrenceCount * 4 + left.lessonRelevance),
    );
}

/** The learner retries at most two high-signal issues; polish remains available but never blocks. */
export function focusFeedback<T extends { priority: FeedbackPriority }>(issues: T[], limit = 2): T[] {
  const focused = issues.filter((issue) => issue.priority !== "polish").slice(0, limit);
  return focused.length > 0 ? focused : issues.slice(0, limit);
}

export function countPolishFeedback(issues: Array<{ priority: FeedbackPriority }>): number {
  return issues.filter((issue) => issue.priority === "polish").length;
}
