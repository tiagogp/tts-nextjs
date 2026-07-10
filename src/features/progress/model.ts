import type { EnglishLevel } from "@/features/discover/types";
import type { ErrorEvent, ErrorType } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";
import { Rating } from "@/lib/srs/fsrs";

const DAY_MS = 86_400_000;
const CHECKIN_INTERVAL_DAYS = 14;
const LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type SkillKey =
  | "recall"
  | "grammar"
  | "naturalness"
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
  assessments: StoredProgressAssessment[];
  now?: number;
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

function scoreFluency(conversations: Conversation[], now: number): SkillSignal {
  const recent = since(conversations, now, 30, (conversation) => conversation.startedAt);
  const userTurns = recent.reduce(
    (sum, conversation) => sum + conversation.turns.filter((turn) => turn.role === "user").length,
    0,
  );
  const averageTurns = recent.length ? userTurns / recent.length : 0;
  return {
    key: "fluency",
    label: "Fluency",
    score: clampScore(Math.min(100, averageTurns * 12 + Math.min(25, recent.length * 4))),
    samples: userTurns,
    delta: 0,
    detail: recent.length
      ? `${Math.round(averageTurns)} learner turn${Math.round(averageTurns) === 1 ? "" : "s"} per conversation`
      : "Start conversations to measure output stamina",
  };
}

function scoreConsistency(input: {
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  pronunciationAttempts: PronunciationAttempt[];
  now: number;
}): SkillSignal {
  const timestamps = [
    ...input.reviews.map((review) => review.reviewedAt),
    ...input.errorEvents.map((event) => event.createdAt),
    ...input.conversations.map((conversation) => conversation.startedAt),
    ...input.pronunciationAttempts.map((attempt) => attempt.createdAt),
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
    scorePronunciation(input.pronunciationAttempts, now),
    scoreFluency(input.conversations, now),
    scoreConsistency({ ...input, now }),
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
  };
}
