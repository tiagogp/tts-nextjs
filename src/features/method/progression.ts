import { interpolate } from "@/i18n/translate";
import type { ListeningAttempt, ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import type { EnglishLevel } from "@/features/discover/types";
import { LEVEL_RANK } from "@/features/discover/levels";

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

export type ProgressionLadder = "listening" | "speaking" | "readingWriting";
export type ProgressionReasonKind = "promoted" | "holding" | "regressed";

/**
 * Coaching sentences for each ladder, as message templates rather than finished prose.
 *
 * A sentence built here and stored would arrive at the UI already interpolated, and an
 * interpolated string can never match an i18n key. Keeping the template and its `evidence`
 * variable apart lets the snapshot stay language-neutral and the screen translate it.
 */
export const PROGRESSION_REASON_MESSAGE: Record<ProgressionLadder, Record<ProgressionReasonKind, string>> = {
  listening: {
    promoted: "Repeated listening evidence met the stage requirement: {evidence}.",
    holding: "Keep the current support until this evidence is available: {evidence}.",
    regressed: "Recent comprehension is struggling, so transcript and speed support should return.",
  },
  speaking: {
    promoted: "Repeated production met the stage requirement: {evidence}.",
    holding: "Complete more evaluated production evidence before increasing independence: {evidence}.",
    regressed: "Recent production is struggling, so prompts and scaffolds should become more supported.",
  },
  readingWriting: {
    promoted: "Repeated reading, writing, and transfer evidence supports the next scaffold.",
    holding: "Keep building evidence before withdrawing support: {evidence}.",
    regressed: "Recent reading or writing evidence is struggling, so the next task restores more guidance.",
  },
};

export interface ProgressionDecision<T extends string> {
  stage: T;
  score: number;
  samples: number;
  /** English prose, for callers and stored snapshots that predate `reasonKind`. */
  reason: string;
  /** Which sentence in `PROGRESSION_REASON_MESSAGE` explains the decision. */
  reasonKind: ProgressionReasonKind;
  /** The stage's evidence requirement, translated and interpolated by the UI. */
  reasonEvidence: string;
  regressed: boolean;
}

function decisionReason(
  ladder: ProgressionLadder,
  kind: ProgressionReasonKind,
  evidence: string,
): Pick<ProgressionDecision<string>, "reason" | "reasonKind" | "reasonEvidence"> {
  return {
    reason: interpolate(PROGRESSION_REASON_MESSAGE[ladder][kind], { evidence }),
    reasonKind: kind,
    reasonEvidence: evidence,
  };
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
  /**
   * Why each ladder holds where it does. The screen pairs this with the stage's own
   * evidence line, so the coaching sentence is composed — and therefore translated —
   * where it is rendered instead of being frozen into English here.
   */
  listeningReasonKind?: ProgressionReasonKind;
  speakingReasonKind?: ProgressionReasonKind;
  readingWritingReasonKind?: ProgressionReasonKind;
  /** Optional for migration compatibility with snapshots written before this stage existed. */
  readingWritingStage?: ReadingWritingStage;
  readingWritingSamples?: number;
  /**
   * When each ladder was last entered. Promotion counts only evidence recorded after
   * this moment, so re-deriving the snapshot (which happens on every app mount) cannot
   * climb a second rung on evidence that already earned the first one.
   *
   * Optional for snapshots written before stage entry was recorded; those are stamped
   * on the next derivation, which withholds promotion until fresh evidence arrives.
   */
  listeningStageSince?: number;
  speakingStageSince?: number;
  readingWritingStageSince?: number;
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

/**
 * Reader-facing names for the ladders and the listening conditions.
 *
 * The enum values are stable identifiers and must never reach a learner: rendering
 * `after_attempt` or `sound_familiarity` leaks internal state into practice copy, and a
 * value spliced into a sentence can never be translated. These labels are English source
 * strings, so `t()` resolves them like any other message.
 */
export const LISTENING_STAGE_LABEL: Record<ListeningStage, string> = {
  sound_familiarity: "sound familiarity",
  word_recognition: "word recognition",
  main_idea: "main idea",
  functional_comprehension: "functional comprehension",
  natural_comprehension: "natural comprehension",
};

export const SPEAKING_STAGE_LABEL: Record<SpeakingStage, string> = {
  fixed_phrases: "fixed phrases",
  variation: "variation",
  guided_description: "guided description",
  timed_monologue: "timed monologue",
  simulated_conversation: "simulated conversation",
  real_world_production: "real-world production",
};

export const READING_WRITING_STAGE_LABEL: Record<ReadingWritingStage, string> = {
  guided_reading: "guided reading",
  open_writing: "open writing",
  revision: "revision",
  independent_transfer: "independent transfer",
};

export const SPEAKER_FAMILIARITY_LABEL: Record<MethodSupport["listening"]["speakerFamiliarity"], string> = {
  familiar: "familiar",
  mixed: "mixed",
  unfamiliar: "unfamiliar",
};

export const TRANSCRIPT_CONDITION_LABEL: Record<MethodSupport["listening"]["subtitles"], string> = {
  hidden: "hidden",
  after_attempt: "after your attempt",
  after_replay: "after a replay",
};

/** Label for a stage read back from storage, where the type has been widened to string. */
export function stageLabel(stage: string): string {
  return (
    LISTENING_STAGE_LABEL[stage as ListeningStage]
    ?? SPEAKING_STAGE_LABEL[stage as SpeakingStage]
    ?? READING_WRITING_STAGE_LABEL[stage as ReadingWritingStage]
    ?? stage.replaceAll("_", " ")
  );
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

/**
 * Evidence that can promote the *current* stage: recorded after the learner entered it.
 *
 * The displayed score and sample count stay on the recent window, so the signal a learner
 * reads does not reset on promotion. Only the promotion gate narrows — which is what keeps
 * one rung from being paid for twice.
 */
function evidenceAtStage<T>(recent: T[], since: number | undefined, timeOf: (item: T) => number): T[] {
  return since === undefined ? recent : recent.filter((item) => timeOf(item) >= since);
}

/** Promotion requires repeated evidence; one lucky answer cannot remove scaffolding. */
export function deriveListeningStage(
  attempts: ListeningAttempt[],
  current: ListeningStage = "sound_familiarity",
  stageSince?: number,
): ProgressionDecision<ListeningStage> {
  const recent = [...usableListeningAttempts(attempts)].sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
  const score = Math.round(average(recent.map(listeningScore)));
  const currentIndex = LISTENING_STAGES.indexOf(current);
  const criteria = LISTENING_STAGE_CRITERIA[current];
  const atStage = evidenceAtStage(recent, stageSince, (attempt) => attempt.completedAt);
  const promotionReady =
    recent.length >= criteria.minSamples && score >= criteria.minScore && atStage.length >= criteria.minSamples;
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
    ...decisionReason(
      "listening",
      regressed ? "regressed" : stage !== current ? "promoted" : "holding",
      criteria.evidence,
    ),
  };
}

export function deriveSpeakingStage(
  attempts: ProductionAttempt[],
  retries: RetryOutcome[] = [],
  current: SpeakingStage = "fixed_phrases",
  stageSince?: number,
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
  const atStage = evidenceAtStage(recent, stageSince, (attempt) => attempt.createdAt);
  const durationReady = criteria.minDurationSeconds === undefined || atStage.filter((attempt) =>
    (attempt.durationMs ?? 0) >= criteria.minDurationSeconds! * 1000,
  ).length >= criteria.minSamples;
  const promotionReady =
    recent.length >= criteria.minSamples
    && score >= criteria.minScore
    && durationReady
    && atStage.length >= criteria.minSamples;
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
    ...decisionReason(
      "speaking",
      regressed ? "regressed" : stage !== current ? "promoted" : "holding",
      criteria.evidence,
    ),
  };
}

export function deriveReadingWritingStage(
  attempts: ProductionAttempt[],
  current: ReadingWritingStage = "guided_reading",
  stageSince?: number,
): ProgressionDecision<ReadingWritingStage> {
  const recent = [...usableProductionAttempts(attempts)]
    .filter((attempt) => !attempt.spoken && attempt.transferKind)
    // Open transfer is valuable practice, but self-reflection cannot prove the answer was
    // correct or promote the learner through a scaffold ladder.
    .filter((attempt) => attempt.evaluated !== false)
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
  const atStage = evidenceAtStage(recent, stageSince, (attempt) => attempt.createdAt);
  const canPromote =
    evidenceCount >= criteria.minSamples
    && stageScore >= criteria.minScore
    && atStage.length >= criteria.minSamples;
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
    ...decisionReason(
      "readingWriting",
      regressed ? "regressed" : stage !== current ? "promoted" : "holding",
      criteria.evidence,
    ),
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

/**
 * Conversation shaping for an advanced learner, independent of recorded evidence.
 *
 * The stages below are deliberately evidence-driven, but a learner who has declared C1/C2 has
 * no recorded productions on day one and so lands on `fixed_phrases` — a 4-turn, single-follow-up
 * exchange. For that band the bottleneck is repertoire, not the ability to hold a conversation,
 * and a beginner-shaped chat cannot supply it. So the declared level sets a floor on the
 * *conversation* only; the promotion ladder itself stays evidence-based and untouched.
 */
const ADVANCED_CONVERSATION_FLOOR = { minTurns: 12, followUpDepth: "counterpoint" } as const;

function isAdvancedLevel(level?: EnglishLevel): boolean {
  return level ? LEVEL_RANK[level] >= LEVEL_RANK.C1 : false;
}

/** Convert evidence-based stages into concrete support used by practice surfaces. */
export function supportForProgression(
  progression?: Pick<MethodProgressionState, "listeningStage" | "speakingStage" | "readingWritingStage">,
  opts?: { level?: EnglishLevel },
): MethodSupport {
  const listeningStage = progression?.listeningStage ?? "sound_familiarity";
  const speakingStage = progression?.speakingStage ?? "fixed_phrases";
  const readingWritingStage = progression?.readingWritingStage ?? "guided_reading";
  const listeningSupport: Record<ListeningStage, { playbackRate: number; guidance: string }> = {
    sound_familiarity: { playbackRate: 0.8, guidance: "Start with slower supported input and replay freely." },
    word_recognition: { playbackRate: 0.9, guidance: "Listen for familiar words before checking the main idea." },
    main_idea: { playbackRate: 1, guidance: "Catch the situation first; details can wait." },
    functional_comprehension: { playbackRate: 1, guidance: "Try natural speed and use the transcript after the check." },
        // Said plainly because it is a real limit of the product, not a suggestion: every
    // built-in lesson clip is the same synthetic voice, so this rung — and the
    // unfamiliar-speech metric behind it — needs audio the learner brings themselves.
    natural_comprehension: { playbackRate: 1, guidance: "Every built-in clip uses the same synthetic voice. Import real audio — this stage cannot be measured without it." },
  };
  const speakingSupport: Record<SpeakingStage, { prompt: string; guidance: string }> = {
    fixed_phrases: { prompt: "Use the kept phrase in one clear sentence.", guidance: "Keep the model phrase as your scaffold." },
    variation: { prompt: "Keep the phrase frame, but change one detail about your situation.", guidance: "Withdraw one piece of support by changing a detail." },
    guided_description: { prompt: "Describe this situation in two or three connected sentences.", guidance: "Use the situation as a guide, not a script." },
    timed_monologue: { prompt: "Speak about this situation until the timer ends.", guidance: "Keep speaking until the timer ends; pauses are allowed." },
    simulated_conversation: { prompt: "Answer the prompt and add one natural follow-up detail.", guidance: "Respond without relying on a fixed script." },
    real_world_production: { prompt: "Deliver this message as you would outside the app.", guidance: "Use the language for a real communicative purpose." },
  };
  const advanced = isAdvancedLevel(opts?.level);
  const stageMaxTurns = speakingStage === "fixed_phrases" ? 4 : speakingStage === "variation" ? 6 : speakingStage === "guided_description" ? 8 : 12;
  const stageFollowUpDepth: MethodSupport["conversation"]["followUpDepth"] =
    speakingStage === "fixed_phrases" ? "single" : speakingStage === "variation" || speakingStage === "guided_description" ? "layered" : "counterpoint";
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
      // The floor only ever raises these — an advanced learner who has also earned a later
      // stage keeps whatever the evidence gives them.
      maxTurns: advanced ? Math.max(stageMaxTurns, ADVANCED_CONVERSATION_FLOOR.minTurns) : stageMaxTurns,
      followUpDepth: advanced ? ADVANCED_CONVERSATION_FLOOR.followUpDepth : stageFollowUpDepth,
      promptStyle: advanced
        ? "Open with a substantive prompt and follow the learner's own line of thought."
        : speakingSupport[speakingStage].prompt,
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
  const now = input.now ?? Date.now();
  const previous = input.previous;
  const listening = deriveListeningStage(
    input.listeningAttempts,
    previous?.listeningStage,
    enteredAt(previous, previous?.listeningStageSince, now),
  );
  const speaking = deriveSpeakingStage(
    input.productionAttempts,
    input.retryOutcomes ?? [],
    previous?.speakingStage,
    enteredAt(previous, previous?.speakingStageSince, now),
  );
  const readingWriting = deriveReadingWritingStage(
    input.productionAttempts,
    previous?.readingWritingStage,
    enteredAt(previous, previous?.readingWritingStageSince, now),
  );
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
    listeningReasonKind: listening.reasonKind,
    speakingReasonKind: speaking.reasonKind,
    readingWritingReasonKind: readingWriting.reasonKind,
    readingWritingStage: readingWriting.stage,
    readingWritingSamples: readingWriting.samples,
    listeningStageSince: stayedAt(previous?.listeningStage, listening.stage, previous?.listeningStageSince, now),
    speakingStageSince: stayedAt(previous?.speakingStage, speaking.stage, previous?.speakingStageSince, now),
    readingWritingStageSince: stayedAt(
      previous?.readingWritingStage,
      readingWriting.stage,
      previous?.readingWritingStageSince,
      now,
    ),
    updatedAt: now,
  };
}

/**
 * The moment the current stage was entered, as the promotion gate should read it.
 *
 * `undefined` only on the very first derivation, where the whole history is the evidence
 * for the opening rung. A stored snapshot that predates stage stamping is treated as
 * "entered now", so it withholds promotion until fresh evidence exists rather than
 * spending old evidence a second time.
 */
function enteredAt(
  previous: MethodProgressionState | undefined,
  since: number | undefined,
  now: number,
): number | undefined {
  if (!previous) return undefined;
  return since ?? now;
}

/** Carry the entry timestamp while the stage holds; restart it on any move, up or down. */
function stayedAt<T extends string>(
  previousStage: T | undefined,
  stage: T,
  since: number | undefined,
  now: number,
): number {
  return previousStage === stage ? since ?? now : now;
}
