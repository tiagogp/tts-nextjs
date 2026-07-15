import type { EnglishLevel } from "@/features/discover/types";
import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";
import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import { transferMetrics } from "@/features/study/transfer";
import { Rating } from "@/lib/srs/fsrs";

const DAY_MS = 86_400_000;
const CHECKIN_INTERVAL_DAYS = 14;
const LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type SkillKey =
  | "recall"
  | "grammar"
  | "naturalness"
  | "comprehension"
  | "pronunciation"
  | "fluency"
  | "consistency";

export interface SkillSignal {
  key: SkillKey;
  label: string;
  score: number;
  samples: number;
  delta: number;
  detail: string;
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
  crossContextReuse?: number;
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
      ? `${recent.length} listening attempt${recent.length === 1 ? "" : "s"}; main idea and details measured separately`
      : "Complete a listening check to measure comprehension",
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(values: number[]): number {
  return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
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

function errorTrend(events: ErrorEvent[], now: number): { delta: number; recent: number; earlier: number } {
  const recent = since(events, now, 14, (event) => event.createdAt).length;
  const earlierStart = now - 28 * DAY_MS;
  const earlierEnd = now - 14 * DAY_MS;
  const earlier = events.filter((event) => event.createdAt >= earlierStart && event.createdAt < earlierEnd).length;
  const denominator = Math.max(1, recent + earlier);
  return { delta: Math.round(((earlier - recent) / denominator) * 100), recent, earlier };
}

function scoreRecall(reviews: ReviewRecord[], now: number): SkillSignal {
  const recent = since(reviews, now, 30, (review) => review.reviewedAt);
  const passed = recent.filter((review) => review.grade >= Rating.Good).length;
  const score = recent.length ? (passed / recent.length) * 100 : 0;
  const older = reviews.filter((review) => review.reviewedAt < now - 30 * DAY_MS && review.reviewedAt >= now - 60 * DAY_MS);
  const olderPassed = older.filter((review) => review.grade >= Rating.Good).length;
  const olderScore = older.length ? (olderPassed / older.length) * 100 : score;
  return {
    key: "recall",
    label: "Recall",
    score: clampScore(score),
    samples: recent.length,
    delta: Math.round(score - olderScore),
    detail: recent.length
      ? `${passed}/${recent.length} recent reviews passed`
      : "Review cards to build a recall signal",
  };
}

function scoreGrammar(events: ErrorEvent[], now: number): SkillSignal {
  const trend = errorTrend(events, now);
  const recentTypes = new Set(
    since(events, now, 14, (event) => event.createdAt).flatMap((event) => event.errorTypes),
  ).size;
  const score = 78 + trend.delta - recentTypes * 4;
  return {
    key: "grammar",
    label: "Grammar control",
    score: clampScore(events.length ? score : 50),
    samples: events.length,
    delta: trend.delta,
    detail: events.length
      ? `${trend.recent} recent correction${trend.recent === 1 ? "" : "s"} vs ${trend.earlier} before`
      : "Correct writing or speech to reveal grammar patterns",
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
      ? `${naturalnessEvents.length} style or word-choice issue${naturalnessEvents.length === 1 ? "" : "s"} recently`
      : "Run advanced corrections to track native-like phrasing",
  };
}

function scorePronunciation(attempts: PronunciationAttempt[], now: number): SkillSignal {
  const recent = since(attempts, now, 30, (attempt) => attempt.createdAt);
  const older = attempts.filter((attempt) => attempt.createdAt < now - 30 * DAY_MS && attempt.createdAt >= now - 60 * DAY_MS);
  const recentScore = avg(recent.map((attempt) => attempt.scores.overall));
  const olderScore = older.length ? avg(older.map((attempt) => attempt.scores.overall)) : recentScore;
  return {
    key: "pronunciation",
    label: "Pronunciation",
    score: clampScore(recentScore),
    samples: recent.length,
    delta: Math.round(recentScore - olderScore),
    detail: recent.length
      ? `${recent.length} pronunciation attempt${recent.length === 1 ? "" : "s"} in 30 days`
      : "Record in lessons or Study to add pronunciation evidence",
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
  const fluencySamples = recentProduction.filter((attempt) => attempt.fluency || attempt.durationMs).length;
  const averageWordsPerMinute = avg(
    recentProduction
      .map((attempt) => attempt.fluency?.wordsPerMinute ?? (attempt.durationMs && attempt.durationMs > 0 ? attempt.wordCount / (attempt.durationMs / 60000) : 0))
      .filter((value) => value > 0),
  );
  const stamina = Math.min(35, outputCount * 2 + fluencySamples * 2 + resolvedRetries.size * 2);
  const speedSignal = Math.min(20, averageWordsPerMinute / 8);
  return {
    key: "fluency",
    label: "Fluency",
    score: clampScore(Math.min(100, averageTurns * 10 + Math.min(20, recent.length * 3) + stamina + speedSignal)),
    samples: outputCount,
    delta: 0,
    detail: recent.length
      ? `${outputCount} original production attempt${outputCount === 1 ? "" : "s"}; ${fluencySamples} fluency sample${fluencySamples === 1 ? "" : "s"} tracked separately`
      : "Start conversations to measure output stamina",
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
    detail: `${activeDays}/14 active day${activeDays === 1 ? "" : "s"}`,
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
    .map((attempt) => attempt.fluency?.wordsPerMinute ?? (attempt.durationMs && attempt.durationMs > 0 ? attempt.wordCount / (attempt.durationMs / 60000) : 0))
    .filter((value) => value > 0);
  const independentAttempts = recentProduction.filter((attempt) => !attempt.scaffoldUsed).length;
  const transferEvaluated = transfers.filter((attempt) => attempt.transferOutcome);
  const successfulTransfers = transferEvaluated.filter((attempt) => attempt.transferOutcome === "clear").length;
  const transfer = transferMetrics(transfers);
  const avoidedErrorCount = recentProduction.reduce((sum, attempt) => sum + (attempt.avoidedErrorIds?.length ?? 0), 0);
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
    crossContextReuse: transfer.crossContext,
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
  const samples = skills.reduce((sum, skill) => sum + Math.min(skill.samples, 20), 0);
  if (samples >= 45) return "high";
  if (samples >= 15) return "medium";
  return "low";
}

function nextLevel(level: EnglishLevel): EnglishLevel {
  const index = LEVELS.indexOf(level);
  return LEVELS[Math.min(LEVELS.length - 1, index + 1)] ?? level;
}

function estimatedBand(profileLevel: EnglishLevel, averageScore: number, confidence: ProgressSnapshot["confidence"]): string {
  if (confidence === "low") return `${profileLevel} baseline`;
  if (averageScore >= 88 && profileLevel !== "C2") return `${nextLevel(profileLevel)} readiness`;
  if (averageScore >= 72) return `${profileLevel}+`;
  if (averageScore <= 42) return `${profileLevel}-`;
  return profileLevel;
}

function buildMilestones(skills: SkillSignal[], averageScore: number): ProgressMilestone[] {
  const byKey = new Map(skills.map((skill) => [skill.key, skill]));
  const fluency = byKey.get("fluency");
  const pronunciation = byKey.get("pronunciation");
  const recall = byKey.get("recall");
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
      detail: "Pass at least 80% of recent card reviews.",
      achieved: (recall?.samples ?? 0) >= 10 && (recall?.score ?? 0) >= 80,
    },
    {
      id: "speaking-stamina",
      label: "Speaking stamina",
      detail: "Average at least 6 learner turns in recent conversations.",
      achieved: (fluency?.samples ?? 0) >= 12 && (fluency?.score ?? 0) >= 72,
    },
    {
      id: "clear-pronunciation",
      label: "Clear pronunciation",
      detail: "Reach 80% average on recent pronunciation attempts.",
      achieved: (pronunciation?.samples ?? 0) >= 3 && (pronunciation?.score ?? 0) >= 80,
    },
    {
      id: "level-readiness",
      label: "Next-level readiness",
      detail: "Reach an 80+ overall signal with grammar under control.",
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
  if (weakest.key === "pronunciation") return "Record three short repetitions and work from word-level feedback.";
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
  const skills = [
    scoreRecall(input.reviews, now),
    scoreGrammar(input.errorEvents, now),
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
  const weighted = skills.filter((skill) => skill.samples > 0);
  const averageScore = clampScore(avg((weighted.length ? weighted : skills).map((skill) => skill.score)));
  const confidence = confidenceFor(skills);
  const checkpoint = nextCheckpoint(input.assessments, now);
  const strengths = [...skills]
    .filter((skill) => skill.samples > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((skill) => skill.label);

  return {
    createdAt: now,
    estimatedBand: estimatedBand(input.profileLevel, averageScore, confidence),
    averageScore,
    confidence,
    skills,
    strengths,
    nextFocus: nextFocus(skills),
    milestones: buildMilestones(skills, averageScore),
    nextCheckpointAt: checkpoint.at,
    checkpointDue: checkpoint.due,
    confidenceIndicators: confidenceIndicators(input, now),
  };
}
