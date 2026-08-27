import type { EnglishLevel } from "@/features/discover/types";
import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";
import type { ListeningAttempt, ProductionAttempt, ProofAttempt, RetryOutcome } from "@/lib/performance/types";
import { transferMetrics } from "@/features/study/transfer";
import {
  computeDelayedProduction,
  type DelayedProductionStats,
  type UnaidedProductionStats,
} from "@/features/activation/outcomeMetrics";
import { computeProofRetention, type ProofRetention } from "@/features/study/proofQueue";
import {
  activeVocabulary,
  coldListening,
  patternErrorRates,
  productionLatency,
  type ActiveVocabulary,
  type ColdListening,
  type PatternErrorRate,
  type ProductionLatency,
} from "@/features/activation/learningMetrics";

const DAY_MS = 86_400_000;
const CHECKIN_INTERVAL_DAYS = 14;

export type SkillKey =
  | "recall"
  | "grammar"
  | "naturalness"
  | "comprehension"
  | "pronunciation"
  | "fluency"
  | "consistency";

const OUTCOME_SKILL_KEYS = new Set<SkillKey>(["recall", "grammar", "comprehension", "pronunciation"]);

export interface SkillSignal {
  key: SkillKey;
  label: string;
  score: number;
  samples: number;
  delta: number;
  detail: string;
  /** Numbers for `detail` when it is a message template; the screen interpolates. */
  detailVars?: Record<string, string | number>;
}

export interface ProgressMilestone {
  id: string;
  label: string;
  detail: string;
  achieved: boolean;
}

export interface ProgressSnapshot {
  createdAt: number;
  estimatedBand: string;
  averageScore: number;
  confidence: "low" | "medium" | "high";
  skills: SkillSignal[];
  unaidedProduction: UnaidedProductionStats;
  /**
   * Retention read off the review log. Carries a survivorship bias by construction: FSRS
   * chooses the gaps, and it only schedules a month out for cards the learner keeps getting
   * right, so hard items never enter the window. Kept because it is dense and free, but
   * `proofRetention` is the number to trust.
   */
  delayedProduction?: DelayedProductionStats;
  /** Queue C: retention over items sampled independently of how well they are known. */
  proofRetention?: ProofRetention;
  /** Distinct words produced unaided, twice, a week apart. The breadth number. */
  activeVocabulary?: ActiveVocabulary;
  /** Hesitation before producing already-mastered language. */
  productionLatency?: ProductionLatency;
  /** Comprehension of a voice never heard, on one play. Null with a reason by default. */
  coldListening?: ColdListening;
  /** Weaknesses ranked by errors per opportunity to use the pattern, not by raw count. */
  patternWeaknesses?: PatternErrorRate[];
  strengths: string[];
  nextFocus: string;
  milestones: ProgressMilestone[];
  nextCheckpointAt: number;
  checkpointDue: boolean;
  confidenceIndicators: ConfidenceIndicators;
}

export interface ConfidenceIndicators {
  spokenAttempts: number;
  averageRecordingSeconds: number;
  recordingGrowthPercent: number;
  resolvedRetryRate: number;
  unresolvedRetries: number;
  readingWritingAttempts: number;
  transferAttempts: number;
  uniqueTransferSources: number;
  skippedAttempts?: number;
  scaffoldedAttempts?: number;
  listeningAttempts?: number;
  listeningAccuracy?: number;
  averagePreparationSeconds?: number;
  preparationSamples?: number;
  independentAttempts?: number;
  scaffoldRate?: number;
  retryImprovementRate?: number;
  transferSuccessRate?: number;
  cardRecallAttempts?: number;
  openProductionAttempts?: number;
  /**
   * Attempts at a new-situation prompt. Renamed from `crossContextReuse`, which named a
   * success while counting a prompt: `newContext: true` was a literal on the activity
   * object, copied into the saved attempt and reported here as transfer achieved.
   */
  crossContextAttempts?: number;
  /** Attempts the app could actually judge — the items that had a pattern to check. */
  crossContextVerified?: number;
  /** Verified attempts that carried the pattern into genuinely new content. */
  crossContextTransferred?: number;
  /** Percentage over the *verified* attempts, or null when nothing was verifiable. */
  crossContextRate?: number | null;
  retellAttempts?: number;
  correctionRecallAttempts?: number;
  spokenRetrievalAttempts?: number;
  avoidedErrorCount?: number;
  listeningRecognitionAttempts?: number;
  fluencySamples?: number;
  averageWordsPerMinute?: number;
}

export interface StoredProgressAssessment extends ProgressSnapshot {
  id: string;
  kind: "automatic" | "checkin";
  notes?: string;
  writingSample?: string;
  errorsFound?: number;
}

export interface ProgressInput {
  /** Queue C attempts. Never `reviews` — a proof that reaches the scheduler is not a proof. */
  proofAttempts?: ProofAttempt[];
  /** Patterns the learner has retired, used to scope the latency measure to known language. */
  masteredPatternIds?: Set<string>;
  profileLevel: EnglishLevel;
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  pronunciationAttempts: PronunciationAttempt[];
  listeningAttempts?: ListeningAttempt[];
  productionAttempts?: ProductionAttempt[];
  retryOutcomes?: RetryOutcome[];
  assessments: StoredProgressAssessment[];
  now?: number;
}

function scoreComprehension(attempts: ListeningAttempt[], now: number): SkillSignal {
  const recent = since(attempts, now, 30, (attempt) => attempt.completedAt);
  const older = attempts.filter(
    (attempt) => attempt.completedAt < now - 30 * DAY_MS && attempt.completedAt >= now - 60 * DAY_MS,
  );
  const scoreFor = (attempt: ListeningAttempt) => {
    if (attempt.questionCount <= 0) return 0;
    // Main idea carries more weight than detail recall: missing a detail is not a failed lesson.
    const mainIdea = attempt.mainIdeaCorrect ? 60 : 0;
    const detail = attempt.detailTotal > 0 ? (attempt.detailCorrect / attempt.detailTotal) * 40 : 40;
    return mainIdea + detail;
  };
  const recentScore = avg(recent.map(scoreFor));
  const olderScore = older.length ? avg(older.map(scoreFor)) : recentScore;
  return {
    key: "comprehension",
    label: "Listening comprehension",
    score: clampScore(recentScore),
    samples: recent.length,
    delta: Math.round(recentScore - olderScore),
    detail: recent.length
      ? recent.length === 1
        ? "1 listening attempt; main idea and details measured separately"
        : "{count} listening attempts; main idea and details measured separately"
      : "Complete a listening check to measure comprehension",
    detailVars: { count: recent.length },
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(values: number[]): number {
  return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
}

/** Floor for a duration-derived speaking rate, mirroring the recorder's own clamp. */
const MIN_FLUENCY_DURATION_MS = 1_000;

/**
 * Speaking rate for one attempt, or 0 when the attempt carries no speech evidence.
 *
 * An explicit `fluency` reading is trusted: it comes from a recording clock. The
 * `durationMs` fallback only applies to spoken attempts — a typed or pasted sentence is
 * committed in milliseconds, and dividing by that would report tens of thousands of words
 * per minute as if the learner had said them out loud.
 */
function attemptWordsPerMinute(attempt: ProductionAttempt): number {
  if (attempt.fluency?.wordsPerMinute) return attempt.fluency.wordsPerMinute;
  if (!attempt.spoken || !attempt.durationMs || attempt.durationMs <= 0) return 0;
  return attempt.wordCount / (Math.max(attempt.durationMs, MIN_FLUENCY_DURATION_MS) / 60_000);
}

function since<T>(items: T[], now: number, days: number, getTime: (item: T) => number): T[] {
  const cutoff = now - days * DAY_MS;
  return items.filter((item) => getTime(item) >= cutoff);
}

function activeDayCount(timestamps: number[], now: number, days: number): number {
  const cutoff = now - days * DAY_MS;
  const keys = new Set(
    timestamps
      .filter((ts) => ts >= cutoff)
      .map((ts) => new Date(ts).toISOString().slice(0, 10)),
  );
  return keys.size;
}

function scoreRecall(reviews: ReviewRecord[], now: number): SkillSignal {
  const recent = since(reviews, now, 30, (review) => review.reviewedAt)
    .filter((review) => review.direction === "production" && review.responseCorrect !== undefined);
  const passed = recent.filter((review) => review.responseCorrect === true).length;
  const score = recent.length ? (passed / recent.length) * 100 : 0;
  const older = reviews.filter((review) =>
    review.reviewedAt < now - 30 * DAY_MS &&
    review.reviewedAt >= now - 60 * DAY_MS &&
    review.direction === "production" &&
    review.responseCorrect !== undefined,
  );
  const olderPassed = older.filter((review) => review.responseCorrect === true).length;
  const olderScore = older.length ? (olderPassed / older.length) * 100 : score;
  return {
    key: "recall",
    label: "Recall",
    score: clampScore(score),
    samples: recent.length,
    delta: Math.round(score - olderScore),
    detail: recent.length
      ? "{passed}/{total} observed production answers correct"
      : "Answer production cards before reveal to build a recall signal",
    detailVars: { passed, total: recent.length },
  };
}

function scoreGrammar(events: ErrorEvent[], attempts: ProductionAttempt[], now: number): SkillSignal {
  const recentAttempts = since(attempts, now, 30, (attempt) => attempt.createdAt)
    .filter((attempt) => attempt.finished && attempt.evaluated !== false && attempt.stage !== "repeat");
  const earlierAttempts = attempts.filter((attempt) =>
    attempt.createdAt < now - 30 * DAY_MS &&
    attempt.createdAt >= now - 60 * DAY_MS &&
    attempt.finished &&
    attempt.evaluated !== false &&
    attempt.stage !== "repeat",
  );
  const hasLanguageIssue = (attempt: ProductionAttempt) => attempt.errorTypesFound !== undefined
    ? attempt.errorTypesFound.length > 0
    : attempt.issueCount > 0;
  const rate = (items: ProductionAttempt[]) => items.length
    ? items.filter(hasLanguageIssue).length / items.length
    : 0;
  const recentRate = rate(recentAttempts);
  const earlierRate = earlierAttempts.length ? rate(earlierAttempts) : recentRate;
  const delta = Math.round((earlierRate - recentRate) * 100);
  return {
    key: "grammar",
    label: "Grammar control",
    score: clampScore(recentAttempts.length ? (1 - recentRate) * 100 : 0),
    samples: recentAttempts.length,
    delta,
    detail: recentAttempts.length
      ? "{errors}/{count} evaluated responses contained an issue"
      : events.length
        ? "Corrections exist, but an evaluated response is needed for an error rate"
        : "Correct writing or speech to reveal grammar patterns",
    detailVars: {
      errors: recentAttempts.filter(hasLanguageIssue).length,
      count: recentAttempts.length,
    },
  };
}

function scoreNaturalness(events: ErrorEvent[], now: number): SkillSignal {
  const naturalnessTypes: ErrorType[] = ["collocation", "idiom", "register", "vocabulary"];
  const recent = since(events, now, 28, (event) => event.createdAt);
  const naturalnessEvents = recent.filter((event) =>
    event.errorTypes.some((type) => naturalnessTypes.includes(type)),
  );
  const ratio = recent.length ? naturalnessEvents.length / recent.length : 0;
  return {
    key: "naturalness",
    label: "Naturalness",
    score: clampScore(recent.length ? 82 - ratio * 55 : 50),
    samples: naturalnessEvents.length,
    delta: 0,
    detail: recent.length
      ? naturalnessEvents.length === 1
        ? "1 style or word-choice issue recently"
        : "{count} style or word-choice issues recently"
      : "Run advanced corrections to track native-like phrasing",
    detailVars: { count: naturalnessEvents.length },
  };
}

function scorePronunciation(attempts: PronunciationAttempt[], now: number): SkillSignal {
  const recent = since(attempts, now, 30, (attempt) => attempt.createdAt);
  const older = attempts.filter((attempt) => attempt.createdAt < now - 30 * DAY_MS && attempt.createdAt >= now - 60 * DAY_MS);
  const recentScore = avg(recent.map((attempt) => attempt.scores.overall));
  const olderScore = older.length ? avg(older.map((attempt) => attempt.scores.overall)) : recentScore;
  return {
    key: "pronunciation",
    label: "Pronunciation signal",
    score: clampScore(recentScore),
    samples: recent.length,
    delta: Math.round(recentScore - olderScore),
    detail: recent.length
      ? recent.length === 1
        ? "1 transcript-alignment attempt in 30 days; not phonemic scoring"
        : "{count} transcript-alignment attempts in 30 days; not phonemic scoring"
      : "Record in lessons or Study to add a coarse pronunciation signal",
    detailVars: { count: recent.length },
  };
}

function scoreFluency(
  conversations: Conversation[],
  productionAttempts: ProductionAttempt[],
  retryOutcomes: RetryOutcome[],
  now: number,
): SkillSignal {
  const recent = since(conversations, now, 30, (conversation) => conversation.startedAt);
  const userTurns = recent.reduce(
    (sum, conversation) => sum + conversation.turns.filter((turn) => turn.role === "user").length,
    0,
  );
  const recentProduction = since(productionAttempts, now, 30, (attempt) => attempt.createdAt)
    .filter((attempt) => attempt.stage !== "repeat" && attempt.evaluated !== false);
  const resolvedRetries = new Set(
    since(retryOutcomes, now, 30, (outcome) => outcome.createdAt)
      .filter((outcome) => outcome.resolved)
      .map((outcome) => outcome.retryOf),
  );
  const outputCount = userTurns + recentProduction.length;
  const averageTurns = recent.length ? userTurns / recent.length : 0;
  const fluencyRates = recentProduction.map(attemptWordsPerMinute).filter((value) => value > 0);
  const fluencySamples = fluencyRates.length;
  const averageWordsPerMinute = avg(fluencyRates);
  const stamina = Math.min(35, outputCount * 2 + fluencySamples * 2 + resolvedRetries.size * 2);
  const speedSignal = Math.min(20, averageWordsPerMinute / 8);
  return {
    key: "fluency",
    label: "Fluency",
    score: clampScore(Math.min(100, averageTurns * 10 + Math.min(20, recent.length * 3) + stamina + speedSignal)),
    samples: outputCount,
    delta: 0,
    detail: recent.length
      ? "{count} original production attempts; {samples} fluency samples tracked separately"
      : "Start conversations to measure output stamina",
    detailVars: { count: outputCount, samples: fluencySamples },
  };
}

function scoreConsistency(input: {
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  pronunciationAttempts: PronunciationAttempt[];
  listeningAttempts: ListeningAttempt[];
  productionAttempts: ProductionAttempt[];
  retryOutcomes: RetryOutcome[];
  now: number;
}): SkillSignal {
  const timestamps = [
    ...input.reviews.map((review) => review.reviewedAt),
    ...input.errorEvents.map((event) => event.createdAt),
    ...input.conversations.map((conversation) => conversation.startedAt),
    ...input.pronunciationAttempts.map((attempt) => attempt.createdAt),
    ...input.listeningAttempts.map((attempt) => attempt.completedAt),
    ...input.productionAttempts.map((attempt) => attempt.createdAt),
  ];
  const activeDays = activeDayCount(timestamps, input.now, 14);
  return {
    key: "consistency",
    label: "Consistency",
    score: clampScore((activeDays / 10) * 100),
    samples: activeDays,
    delta: 0,
    detail: activeDays === 1 ? "1/14 active day" : "{count}/14 active days",
    detailVars: { count: activeDays },
  };
}

function confidenceIndicators(input: ProgressInput, now: number): ConfidenceIndicators {
  const recentProduction = since(input.productionAttempts ?? [], now, 30, (attempt) => attempt.createdAt)
    .filter((attempt) => attempt.stage !== "repeat");
  const spoken = recentProduction.filter((attempt) => attempt.spoken);
  const durations = spoken
    .map((attempt) => attempt.durationMs)
    .filter((duration): duration is number => duration !== undefined && Number.isFinite(duration) && duration > 0);
  const olderSpoken = (input.productionAttempts ?? [])
    .filter((attempt) => attempt.stage !== "repeat" && attempt.spoken)
    .filter((attempt) => attempt.createdAt < now - 30 * DAY_MS && attempt.createdAt >= now - 60 * DAY_MS)
    .map((attempt) => attempt.durationMs)
    .filter((duration): duration is number => duration !== undefined && Number.isFinite(duration) && duration > 0);
  const average = durations.length ? avg(durations) / 1000 : 0;
  const olderAverage = olderSpoken.length ? avg(olderSpoken) : 0;
  const recordingGrowthPercent = olderAverage > 0 ? Math.round(((avg(durations) - olderAverage) / olderAverage) * 100) : 0;
  const retries = since(input.retryOutcomes ?? [], now, 30, (outcome) => outcome.createdAt);
  const resolved = retries.filter((outcome) => outcome.resolved).length;
  const readingWriting = recentProduction.filter((attempt) => !attempt.spoken);
  const transfers = recentProduction.filter((attempt) => Boolean(attempt.transferKind));
  const uniqueTransferSources = new Set(transfers.map((attempt) => attempt.transferSourceId).filter(Boolean)).size;
  const listening = since(input.listeningAttempts ?? [], now, 30, (attempt) => attempt.completedAt);
  const listeningAccuracy = listening.length
    ? avg(listening.map((attempt) => {
      if (attempt.questionCount <= 0) return 0;
      const mainIdea = attempt.mainIdeaCorrect ? 60 : 0;
      const detail = attempt.detailTotal > 0 ? (attempt.detailCorrect / attempt.detailTotal) * 40 : 40;
      return mainIdea + detail;
    }))
    : 0;
  const allEvidence = [...recentProduction, ...listening];
  const preparation = recentProduction
    .map((attempt) => attempt.preparationMs)
    .filter((value): value is number => value !== undefined && value > 0);
  const fluencyValues = recentProduction
    .filter((attempt) => attempt.evaluated !== false)
    .map(attemptWordsPerMinute)
    .filter((value) => value > 0);
  const independentAttempts = recentProduction.filter((attempt) => !attempt.scaffoldUsed).length;
  const transferEvaluated = transfers.filter((attempt) => attempt.evaluated !== false && attempt.transferOutcome);
  const successfulTransfers = transferEvaluated.filter((attempt) => attempt.transferOutcome === "clear").length;
  const transfer = transferMetrics(transfers);
  const avoidedErrorCount = recentProduction
    .filter((attempt) => attempt.evaluated !== false)
    .reduce((sum, attempt) => sum + (attempt.avoidedErrorIds?.length ?? 0), 0);
  const retryImprovementRate = retries.length
    ? Math.round((retries.filter((retry) => retry.resolved && retry.issueCount === 0).length / retries.length) * 100)
    : 0;
  return {
    spokenAttempts: spoken.length,
    averageRecordingSeconds: Math.round(average),
    recordingGrowthPercent,
    resolvedRetryRate: retries.length ? Math.round((resolved / retries.length) * 100) : 0,
    unresolvedRetries: retries.filter((outcome) => !outcome.resolved && outcome.resolution !== "dismissed").length,
    readingWritingAttempts: readingWriting.length,
    transferAttempts: transfers.length,
    uniqueTransferSources,
    skippedAttempts: allEvidence.filter((attempt) => attempt.skipped).length,
    scaffoldedAttempts: allEvidence.filter((attempt) => attempt.scaffoldUsed).length,
    listeningAttempts: listening.length,
    listeningAccuracy: Math.round(listeningAccuracy),
    averagePreparationSeconds: preparation.length ? Math.round(avg(preparation) / 100) / 10 : 0,
    preparationSamples: preparation.length,
    independentAttempts,
    scaffoldRate: allEvidence.length ? Math.round((allEvidence.filter((attempt) => attempt.scaffoldUsed).length / allEvidence.length) * 100) : 0,
    retryImprovementRate,
    transferSuccessRate: transferEvaluated.length ? Math.round((successfulTransfers / transferEvaluated.length) * 100) : 0,
    cardRecallAttempts: transfer.cardRecall,
    openProductionAttempts: transfer.openProduction,
    crossContextAttempts: transfer.crossContextAttempts,
    crossContextVerified: transfer.crossContextVerified,
    crossContextTransferred: transfer.crossContextTransferred,
    crossContextRate: transfer.crossContextRate === null
      ? null
      : Math.round(transfer.crossContextRate * 100),
    retellAttempts: transfer.retells,
    correctionRecallAttempts: transfer.correctionRecalls,
    spokenRetrievalAttempts: transfer.spokenRetrieval,
    avoidedErrorCount: Math.max(avoidedErrorCount, transfer.avoidedErrors),
    listeningRecognitionAttempts: transfer.cardRecall,
    fluencySamples: fluencyValues.length,
    averageWordsPerMinute: fluencyValues.length ? Math.round(avg(fluencyValues)) : 0,
  };
}

function confidenceFor(skills: SkillSignal[]): ProgressSnapshot["confidence"] {
  const samples = skills
    .filter((skill) => OUTCOME_SKILL_KEYS.has(skill.key))
    .reduce((sum, skill) => sum + Math.min(skill.samples, 20), 0);
  if (samples >= 45) return "high";
  if (samples >= 15) return "medium";
  return "low";
}

function estimatedBand(profileLevel: EnglishLevel): string {
  // App activity is useful coaching evidence, not a standardized CEFR assessment.
  return `${profileLevel} baseline`;
}

function buildMilestones(
  skills: SkillSignal[],
  averageScore: number,
  unaidedProduction: UnaidedProductionStats,
): ProgressMilestone[] {
  const byKey = new Map(skills.map((skill) => [skill.key, skill]));
  const fluency = byKey.get("fluency");
  const pronunciation = byKey.get("pronunciation");
  const consistency = byKey.get("consistency");
  const grammar = byKey.get("grammar");
  return [
    {
      id: "first-signal",
      label: "First progress signal",
      detail: "Complete reviews, speaking, correction, or pronunciation practice.",
      achieved: skills.some((skill) => skill.samples > 0),
    },
    {
      id: "weekly-rhythm",
      label: "Weekly rhythm",
      detail: "Be active on at least 5 days in a 14-day window.",
      achieved: (consistency?.samples ?? 0) >= 5,
    },
    {
      id: "recall-control",
      label: "Recall control",
      detail: "Pass at least 80% of observed D30 production attempts.",
      achieved:
        unaidedProduction.attempts >= 3 &&
        unaidedProduction.rate !== null &&
        unaidedProduction.rate >= 0.8,
    },
    {
      id: "speaking-stamina",
      label: "Speaking stamina",
      detail: "Average at least 6 learner turns in recent conversations.",
      achieved: (fluency?.samples ?? 0) >= 12 && (fluency?.score ?? 0) >= 72,
    },
    {
      id: "clear-pronunciation",
      label: "Clearer pronunciation signal",
      detail: "Reach 80% average on transcript-alignment attempts.",
      achieved: (pronunciation?.samples ?? 0) >= 3 && (pronunciation?.score ?? 0) >= 80,
    },
    {
      id: "level-readiness",
      label: "Broad learning evidence",
      detail: "Build evaluated evidence across recall, grammar, comprehension, and production.",
      achieved: averageScore >= 80 && (grammar?.score ?? 0) >= 75,
    },
  ];
}

function nextFocus(skills: SkillSignal[]): string {
  if (skills.every((skill) => skill.samples === 0)) {
    return "Do a short check-in so PhraseLoop can find your next focus.";
  }
  const usable = skills.filter((skill) => skill.samples > 0 || skill.score < 60);
  const weakest = (usable.length ? usable : skills).sort((a, b) => a.score - b.score)[0];
  if (!weakest) return "Do a short check-in so PhraseLoop can find your next focus.";
  if (weakest.key === "recall") return "Review due cards until recent recall is above 80%.";
  if (weakest.key === "grammar") return "Correct one short answer and turn recurring mistakes into drills.";
  if (weakest.key === "naturalness") return "Ask for native-sounding rewrites and save useful phrasing.";
  if (weakest.key === "pronunciation") return "Record three short repetitions and compare the transcript-alignment signal over time.";
  if (weakest.key === "fluency") return "Hold one longer conversation and aim for six learner turns.";
  return "Keep the habit alive with one small session today.";
}

function nextCheckpoint(assessments: StoredProgressAssessment[], now: number): { at: number; due: boolean } {
  const latest = assessments
    .filter((assessment) => assessment.kind === "checkin")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!latest) return { at: now, due: true };
  const at = latest.createdAt + CHECKIN_INTERVAL_DAYS * DAY_MS;
  return { at, due: now >= at };
}

export function computeProgressSnapshot(input: ProgressInput): ProgressSnapshot {
  const now = input.now ?? Date.now();
  const delayedProduction = computeDelayedProduction(input.reviews, now);
  const unaidedProduction = delayedProduction.d30;
  const productionAttempts = input.productionAttempts ?? [];
  const proofRetention = computeProofRetention(input.proofAttempts ?? []);
  const activeVocab = activeVocabulary(productionAttempts);
  const latency = productionLatency(productionAttempts, input.masteredPatternIds ?? new Set(), { now });
  const patternWeaknesses = patternErrorRates(productionAttempts, { now });
  const cold = coldListening(input.listeningAttempts ?? []);
  const skills = [
    scoreRecall(input.reviews, now),
    scoreGrammar(input.errorEvents, input.productionAttempts ?? [], now),
    scoreNaturalness(input.errorEvents, now),
    scoreComprehension(input.listeningAttempts ?? [], now),
    scorePronunciation(input.pronunciationAttempts, now),
    scoreFluency(input.conversations, input.productionAttempts ?? [], input.retryOutcomes ?? [], now),
    scoreConsistency({
      ...input,
      listeningAttempts: input.listeningAttempts ?? [],
      productionAttempts: input.productionAttempts ?? [],
      retryOutcomes: input.retryOutcomes ?? [],
      now,
    }),
  ];
  // Consistency is displayed as activity. It must not raise a learning-outcome score.
  const weighted = skills.filter((skill) => skill.samples > 0 && OUTCOME_SKILL_KEYS.has(skill.key));
  const averageScore = weighted.length ? clampScore(avg(weighted.map((skill) => skill.score))) : 0;
  const confidence = confidenceFor(skills);
  const checkpoint = nextCheckpoint(input.assessments, now);
  const strengths = [...skills]
    .filter((skill) => skill.samples > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((skill) => skill.label);

  return {
    createdAt: now,
    estimatedBand: estimatedBand(input.profileLevel),
    averageScore,
    confidence,
    skills,
    unaidedProduction,
    delayedProduction,
    proofRetention,
    activeVocabulary: activeVocab,
    productionLatency: latency,
    patternWeaknesses,
    coldListening: cold,
    strengths,
    nextFocus: nextFocus(skills),
    milestones: buildMilestones(skills, averageScore, unaidedProduction),
    nextCheckpointAt: checkpoint.at,
    checkpointDue: checkpoint.due,
    confidenceIndicators: confidenceIndicators(input, now),
  };
}
