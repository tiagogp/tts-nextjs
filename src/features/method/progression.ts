import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";

export type ListeningStage =
  | "sound_familiarity"
  | "word_recognition"
  | "main_idea"
  | "functional_comprehension"
  | "natural_comprehension";

export type SpeakingStage =
  | "fixed_phrases"
  | "variation"
  | "guided_description"
  | "timed_monologue"
  | "simulated_conversation"
  | "real_world_production";

export type ReadingWritingStage = "guided_reading" | "open_writing" | "revision" | "independent_transfer";

export interface ProgressionDecision<T extends string> {
  stage: T;
  score: number;
  samples: number;
  reason: string;
  regressed: boolean;
}

/** Durable snapshot of the current support level; history remains in attempts. */
export interface MethodProgressionState {
  id: "current";
  listeningStage: ListeningStage;
  speakingStage: SpeakingStage;
  listeningScore: number;
  speakingScore: number;
  readingWritingScore?: number;
  listeningSamples: number;
  speakingSamples: number;
  listeningReason?: string;
  speakingReason?: string;
  readingWritingReason?: string;
  /** Optional for migration compatibility with snapshots written before this stage existed. */
  readingWritingStage?: ReadingWritingStage;
  readingWritingSamples?: number;
  updatedAt: number;
}

export interface MethodSupport {
  listening: {
    stage: ListeningStage;
    playbackRate: number;
    transcriptCondition: "after_attempt" | "after_replay";
    speakerFamiliarity: "familiar" | "mixed" | "unfamiliar";
    subtitles: "hidden" | "after_attempt" | "after_replay";
    connectedSpeech: boolean;
    guidance: string;
    promotionEvidence: string;
  };
  speaking: {
    stage: SpeakingStage;
    targetSeconds: number;
    prompt: string;
    guidance: string;
    promotionEvidence: string;
  };
  conversation: {
    maxTurns: number;
    followUpDepth: "single" | "layered" | "counterpoint";
    promptStyle: string;
    familiarTopicCadenceDays: number;
  };
  readingWriting: {
    stage: ReadingWritingStage;
    guidance: string;
  };
}

export interface ProgressionExplanation {
  listening?: string;
  speaking?: string;
  readingWriting?: string;
}

export const LISTENING_STAGES: readonly ListeningStage[] = [
  "sound_familiarity",
  "word_recognition",
  "main_idea",
  "functional_comprehension",
  "natural_comprehension",
];

export const SPEAKING_STAGES: readonly SpeakingStage[] = [
  "fixed_phrases",
  "variation",
  "guided_description",
  "timed_monologue",
  "simulated_conversation",
  "real_world_production",
];

export const READING_WRITING_STAGES: readonly ReadingWritingStage[] = [
  "guided_reading",
  "open_writing",
  "revision",
  "independent_transfer",
];

export interface StageCriteria {
  minSamples: number;
  minScore: number;
  evidence: string;
  /** Longer speaking stages require demonstrated time-on-task, not a typed claim. */
  minDurationSeconds?: number;
}

export interface FamiliarTopic {
  id: string;
  label: string;
  prompt: string;
  context: string;
}

export const FAMILIAR_TOPICS: readonly FamiliarTopic[] = [
  { id: "week", label: "your week", context: "personal update", prompt: "Describe one thing that happened this week and one thing you plan to do next." },
  { id: "home", label: "your home", context: "familiar life", prompt: "Describe something ordinary at home and explain why it matters to you." },
  { id: "work-study", label: "your work or studies", context: "work or studies", prompt: "Explain one task from your work or studies and what made it easy or difficult." },
  { id: "hobbies", label: "your interests", context: "hobbies", prompt: "Tell a short story about an interest or hobby you return to regularly." },
];

export interface FamiliarTopicHistoryItem {
  context?: string;
  topicId?: string;
  createdAt: number;
}

/**
 * Familiar topics are a deliberate recurrence loop, not a fixed prompt that happens
 * to remain selected in the UI. The least-recently used topic returns first, while a
 * topic used inside the recurrence window is left alone when another topic is ready.
 */
export function selectFamiliarTopic(
  history: FamiliarTopicHistoryItem[] = [],
  now = Date.now(),
  recurrenceDays = 7,
): FamiliarTopic {
  const cutoff = now - recurrenceDays * 86_400_000;
  const lastSeen = new Map<string, number>();
  for (const item of history) {
    const topic = item.topicId ?? FAMILIAR_TOPICS.find((candidate) => candidate.context === item.context)?.id;
    if (!topic) continue;
    lastSeen.set(topic, Math.max(lastSeen.get(topic) ?? 0, item.createdAt));
  }
  return [...FAMILIAR_TOPICS].sort((left, right) => {
    const leftSeen = lastSeen.get(left.id) ?? 0;
    const rightSeen = lastSeen.get(right.id) ?? 0;
    const leftReady = leftSeen === 0 || leftSeen <= cutoff;
    const rightReady = rightSeen === 0 || rightSeen <= cutoff;
    return Number(rightReady) - Number(leftReady) || leftSeen - rightSeen;
  })[0];
}

export const READING_WRITING_STAGE_CRITERIA: Record<ReadingWritingStage, StageCriteria> = {
  guided_reading: { minSamples: 2, minScore: 70, evidence: "2 meaning checks at 70% or better" },
  open_writing: { minSamples: 2, minScore: 70, evidence: "2 original written messages at 70% or better" },
  revision: { minSamples: 2, minScore: 75, evidence: "2 focused revisions that resolve the target issue" },
  independent_transfer: { minSamples: 5, minScore: 80, evidence: "5 clear transfers across new contexts" },
};

/** Observable evidence required before one scaffold is withdrawn. */
export const LISTENING_STAGE_CRITERIA: Record<ListeningStage, StageCriteria> = {
  sound_familiarity: { minSamples: 2, minScore: 72, evidence: "2 complete checks with at least 72% comprehension" },
  word_recognition: { minSamples: 3, minScore: 78, evidence: "3 checks with at least 78% comprehension" },
  main_idea: { minSamples: 3, minScore: 82, evidence: "3 checks with the main idea and details holding at 82%" },
  functional_comprehension: { minSamples: 4, minScore: 85, evidence: "4 checks at 85% while using less transcript support" },
  natural_comprehension: { minSamples: 5, minScore: 88, evidence: "5 checks at 88% with natural-speed, mixed-speaker input" },
};

export const SPEAKING_STAGE_CRITERIA: Record<SpeakingStage, StageCriteria> = {
  fixed_phrases: { minSamples: 2, minScore: 72, evidence: "2 evaluated productions at 72% or better" },
  variation: { minSamples: 3, minScore: 78, evidence: "3 evaluated productions at 78% or better" },
  guided_description: { minSamples: 3, minScore: 82, evidence: "3 evaluated descriptions at 82% or better" },
  timed_monologue: { minSamples: 4, minScore: 84, minDurationSeconds: 120, evidence: "4 evaluated productions holding for 2 minutes at 84% or better" },
  simulated_conversation: { minSamples: 5, minScore: 86, minDurationSeconds: 300, evidence: "5 evaluated productions holding for 5 minutes at 86% or better" },
  real_world_production: { minSamples: 5, minScore: 88, minDurationSeconds: 300, evidence: "5 evaluated real-world productions holding for 5 minutes at 88% or better" },
};

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function listeningScore(attempt: ListeningAttempt): number {
  const details = attempt.detailTotal > 0 ? (attempt.detailCorrect / attempt.detailTotal) * 100 : 100;
  return (attempt.mainIdeaCorrect ? 60 : 0) + details * 0.4;
}

function usableListeningAttempts(attempts: ListeningAttempt[]): ListeningAttempt[] {
  return attempts.filter((attempt) => attempt.finished !== false && !attempt.skipped && attempt.completedAt > 0);
}

function usableProductionAttempts(attempts: ProductionAttempt[]): ProductionAttempt[] {
  return attempts.filter((attempt) => attempt.finished !== false && !attempt.skipped && attempt.createdAt > 0);
}

function productionScore(attempt: ProductionAttempt, retry?: RetryOutcome): number {
  const base = attempt.issueCount === 0 ? 100 : Math.max(20, 100 - attempt.issueCount * 20);
  const retryBonus = retry?.resolved ? 10 : 0;
  return Math.min(100, base + retryBonus);
}

/** Promotion requires repeated evidence; one lucky answer cannot remove scaffolding. */
export function deriveListeningStage(
  attempts: ListeningAttempt[],
  current: ListeningStage = "sound_familiarity",
): ProgressionDecision<ListeningStage> {
  const recent = [...usableListeningAttempts(attempts)].sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
  const score = Math.round(average(recent.map(listeningScore)));
  const currentIndex = LISTENING_STAGES.indexOf(current);
  const criteria = LISTENING_STAGE_CRITERIA[current];
  const promotionReady = recent.length >= criteria.minSamples && score >= criteria.minScore;
  const next = promotionReady && currentIndex < LISTENING_STAGES.length - 1
    ? LISTENING_STAGES[currentIndex + 1]
    : current;
  const regressed = recent.length >= 3 && score < 45 && currentIndex > 0;
  const stage = regressed ? LISTENING_STAGES[currentIndex - 1] : next;
  return {
    stage,
    score,
    samples: recent.length,
    regressed,
    reason: regressed
      ? "Recent comprehension is struggling, so transcript and speed support should return."
      : stage !== current
        ? `Repeated listening evidence met the stage requirement: ${criteria.evidence}.`
        : `Keep the current support until this evidence is available: ${criteria.evidence}.`,
  };
}

export function deriveSpeakingStage(
  attempts: ProductionAttempt[],
  retries: RetryOutcome[] = [],
  current: SpeakingStage = "fixed_phrases",
): ProgressionDecision<SpeakingStage> {
  // Open-production transfer attempts prove output practice, but not correctness.
  // They must not promote or regress the support ladder until feedback exists.
  const recent = [...usableProductionAttempts(attempts)]
    .filter((attempt) => attempt.stage !== "repeat")
    .filter((attempt) => attempt.evaluated !== false)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  const retryByAttempt = new Map(retries.map((retry) => [retry.retryOf, retry]));
  const score = Math.round(average(recent.map((attempt) => productionScore(attempt, retryByAttempt.get(attempt.id)))));
  const currentIndex = SPEAKING_STAGES.indexOf(current);
  const criteria = SPEAKING_STAGE_CRITERIA[current];
  const durationReady = criteria.minDurationSeconds === undefined || recent.filter((attempt) =>
    (attempt.durationMs ?? 0) >= criteria.minDurationSeconds! * 1000,
  ).length >= criteria.minSamples;
  const promotionReady = recent.length >= criteria.minSamples && score >= criteria.minScore && durationReady;
  const next = promotionReady && currentIndex < SPEAKING_STAGES.length - 1
    ? SPEAKING_STAGES[currentIndex + 1]
    : current;
  const regressed = recent.length >= 3 && score < 45 && currentIndex > 0;
  const stage = regressed ? SPEAKING_STAGES[currentIndex - 1] : next;
  return {
    stage,
    score,
    samples: recent.length,
    regressed,
    reason: regressed
      ? "Recent production is struggling, so prompts and scaffolds should become more supported."
      : stage !== current
        ? `Repeated production met the stage requirement: ${criteria.evidence}.`
        : `Complete more evaluated production evidence before increasing independence: ${criteria.evidence}.`,
  };
}

export function deriveReadingWritingStage(
  attempts: ProductionAttempt[],
  current: ReadingWritingStage = "guided_reading",
): ProgressionDecision<ReadingWritingStage> {
  const recent = [...usableProductionAttempts(attempts)]
    .filter((attempt) => !attempt.spoken && attempt.transferKind)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  const readingAttempts = recent.filter((attempt) => attempt.transferKind === "reading_to_meaning");
  const writingAttempts = recent.filter((attempt) => attempt.transferKind !== "reading_to_meaning" && attempt.transferKind !== "listening_recognition");
  const reading = readingAttempts.filter((attempt) => (attempt.comprehensionScore ?? (attempt.evaluated !== false && attempt.issueCount === 0 ? 100 : 0)) >= 70).length;
  const writing = writingAttempts.filter((attempt) => (attempt.writingScore ?? (attempt.evaluated !== false && attempt.issueCount === 0 ? 100 : 0)) >= 70).length;
  const revised = recent.filter((attempt) => attempt.stage === "retry" && attempt.transferOutcome === "clear").length;
  const transfer = recent.filter((attempt) => attempt.newContext && attempt.transferOutcome === "clear").length;
  const score = Math.min(100, reading * 20 + writing * 20 + revised * 15 + transfer * 10);
  const currentIndex = READING_WRITING_STAGES.indexOf(current);
  const criteria = READING_WRITING_STAGE_CRITERIA[current];
  const evidenceCount = [reading, writing, revised, transfer][currentIndex] ?? 0;
  // Each stage has its own evidence dimension. The former aggregate score could
  // never promote guided_reading: two perfect reading checks contributed only 40
  // points. Score the evidence that is actually required at the current stage.
  const stageScore = current === "guided_reading"
    ? (readingAttempts.length ? (reading / readingAttempts.length) * 100 : 0)
    : current === "open_writing"
      ? (writingAttempts.length ? (writing / writingAttempts.length) * 100 : 0)
      : current === "revision"
        ? (recent.filter((attempt) => attempt.stage === "retry").length
          ? (revised / recent.filter((attempt) => attempt.stage === "retry").length) * 100
          : 0)
        : (recent.filter((attempt) => attempt.newContext).length
          ? (transfer / recent.filter((attempt) => attempt.newContext).length) * 100
          : 0);
  const canPromote = evidenceCount >= criteria.minSamples && stageScore >= criteria.minScore;
  const next = canPromote && currentIndex < 3
    ? READING_WRITING_STAGES[currentIndex + 1]
    : current;
  const regressed = recent.length >= 3 && stageScore < 45 && currentIndex > 0;
  const stage = regressed ? READING_WRITING_STAGES[currentIndex - 1] : next;
  return {
    stage,
    score: Math.round(Math.max(score, stageScore)),
    samples: recent.length,
    regressed,
    reason: regressed
      ? "Recent reading or writing evidence is struggling, so the next task restores more guidance."
      : stage !== current
      ? "Repeated reading, writing, and transfer evidence supports the next scaffold."
      : `Keep building evidence before withdrawing support: ${criteria.evidence}.`,
  };
}

export function monologueSeconds(stage: SpeakingStage): number {
  switch (stage) {
    case "fixed_phrases":
      return 15;
    case "variation":
      return 30;
    case "guided_description":
      return 60;
    case "timed_monologue":
      return 120;
    case "simulated_conversation":
      return 300;
    case "real_world_production":
      return 300;
  }
}

export function explainProgressionChange(
  previous: Pick<MethodProgressionState, "listeningStage" | "speakingStage" | "readingWritingStage"> | undefined,
  current: Pick<MethodProgressionState, "listeningStage" | "speakingStage" | "readingWritingStage">,
): ProgressionExplanation {
  const explanation: ProgressionExplanation = {};
  if (previous?.listeningStage !== current.listeningStage) {
    explanation.listening = current.listeningStage === "sound_familiarity" || current.listeningStage === "word_recognition"
      ? "Recent listening was harder, so slower audio or transcript support is back."
      : "Repeated listening evidence supports less transcript help and more natural input.";
  }
  if (previous?.speakingStage !== current.speakingStage) {
    explanation.speaking = current.speakingStage === "fixed_phrases" || current.speakingStage === "variation"
      ? "Recent production needs more support, so the next prompt is shorter and more guided."
      : "Your recent production is holding up, so the prompt now asks for more independent speaking.";
  }
  if (previous?.readingWritingStage !== current.readingWritingStage) {
    explanation.readingWriting = "Your reading and writing evidence supports a new level of independent transfer.";
  }
  return explanation;
}

/** Convert evidence-based stages into concrete support used by practice surfaces. */
export function supportForProgression(
  progression?: Pick<MethodProgressionState, "listeningStage" | "speakingStage" | "readingWritingStage">,
): MethodSupport {
  const listeningStage = progression?.listeningStage ?? "sound_familiarity";
  const speakingStage = progression?.speakingStage ?? "fixed_phrases";
  const readingWritingStage = progression?.readingWritingStage ?? "guided_reading";
  const listeningSupport: Record<ListeningStage, { playbackRate: number; guidance: string }> = {
    sound_familiarity: { playbackRate: 0.8, guidance: "Start with slower supported input and replay freely." },
    word_recognition: { playbackRate: 0.9, guidance: "Listen for familiar words before checking the main idea." },
    main_idea: { playbackRate: 1, guidance: "Catch the situation first; details can wait." },
    functional_comprehension: { playbackRate: 1.1, guidance: "Try natural speed and use the transcript after the check." },
    natural_comprehension: { playbackRate: 1.2, guidance: "Stay with natural speed and unfamiliar connected speech." },
  };
  const speakingSupport: Record<SpeakingStage, { prompt: string; guidance: string }> = {
    fixed_phrases: { prompt: "Use the kept phrase in one clear sentence.", guidance: "Keep the model phrase as your scaffold." },
    variation: { prompt: "Keep the phrase frame, but change one detail about your situation.", guidance: "Withdraw one piece of support by changing a detail." },
    guided_description: { prompt: "Describe this situation in two or three connected sentences.", guidance: "Use the situation as a guide, not a script." },
    timed_monologue: { prompt: "Speak about this situation until the timer ends.", guidance: "Keep speaking until the timer ends; pauses are allowed." },
    simulated_conversation: { prompt: "Answer the prompt and add one natural follow-up detail.", guidance: "Respond without relying on a fixed script." },
    real_world_production: { prompt: "Deliver this message as you would outside the app.", guidance: "Use the language for a real communicative purpose." },
  };
  const readingWritingGuidance: Record<ReadingWritingStage, string> = {
    guided_reading: "Read one useful sentence, then explain its meaning before writing.",
    open_writing: "Write a new sentence from the meaning, not by copying the model.",
    revision: "Use one focused correction to improve the same message.",
    independent_transfer: "Reuse the language in a new topic with minimal support.",
  };
  return {
    listening: {
      stage: listeningStage,
      playbackRate: listeningSupport[listeningStage].playbackRate,
      transcriptCondition: listeningStage === "natural_comprehension" ? "after_replay" : "after_attempt",
      speakerFamiliarity: listeningStage === "natural_comprehension" ? "unfamiliar" : listeningStage === "functional_comprehension" ? "mixed" : "familiar",
      subtitles: listeningStage === "natural_comprehension" ? "after_replay" : "after_attempt",
      connectedSpeech: listeningStage === "functional_comprehension" || listeningStage === "natural_comprehension",
      guidance: listeningSupport[listeningStage].guidance,
      promotionEvidence: LISTENING_STAGE_CRITERIA[listeningStage].evidence,
    },
    speaking: {
      stage: speakingStage,
      targetSeconds: monologueSeconds(speakingStage),
      prompt: speakingSupport[speakingStage].prompt,
      guidance: speakingSupport[speakingStage].guidance,
      promotionEvidence: SPEAKING_STAGE_CRITERIA[speakingStage].evidence,
    },
    conversation: {
      maxTurns: speakingStage === "fixed_phrases" ? 4 : speakingStage === "variation" ? 6 : speakingStage === "guided_description" ? 8 : 12,
      followUpDepth: speakingStage === "fixed_phrases" ? "single" : speakingStage === "variation" || speakingStage === "guided_description" ? "layered" : "counterpoint",
      promptStyle: speakingSupport[speakingStage].prompt,
      familiarTopicCadenceDays: 7,
    },
    readingWriting: {
      stage: readingWritingStage,
      guidance: readingWritingGuidance[readingWritingStage],
    },
  };
}

export function stageOrder(): { listening: ListeningStage[]; speaking: SpeakingStage[] } {
  return { listening: [...LISTENING_STAGES], speaking: [...SPEAKING_STAGES] };
}

export function deriveProgressionState(input: {
  listeningAttempts: ListeningAttempt[];
  productionAttempts: ProductionAttempt[];
  retryOutcomes?: RetryOutcome[];
  previous?: MethodProgressionState;
  now?: number;
}): MethodProgressionState {
  const listening = deriveListeningStage(input.listeningAttempts, input.previous?.listeningStage);
  const speaking = deriveSpeakingStage(
    input.productionAttempts,
    input.retryOutcomes ?? [],
    input.previous?.speakingStage,
  );
  const readingWriting = deriveReadingWritingStage(input.productionAttempts, input.previous?.readingWritingStage);
  return {
    id: "current",
    listeningStage: listening.stage,
    speakingStage: speaking.stage,
    listeningScore: listening.score,
    speakingScore: speaking.score,
    readingWritingScore: readingWriting.score,
    listeningSamples: listening.samples,
    speakingSamples: speaking.samples,
    listeningReason: listening.reason,
    speakingReason: speaking.reason,
    readingWritingReason: readingWriting.reason,
    readingWritingStage: readingWriting.stage,
    readingWritingSamples: readingWriting.samples,
    updatedAt: input.now ?? Date.now(),
  };
}
