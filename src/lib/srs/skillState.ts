/**
 * Phase 2 #6 — derived per-skill state. A coarse proficiency + recent-fatigue + due signal
 * for each skill, **derived from existing logs, not modeled**. No IRT/theta engine, no new
 * storage: everything here is computed on read from `reviews`, `pronunciationAttempts`,
 * `errorEvents`, and current card/SRS state.
 *
 * Kept pure (mirrors `analytics.ts`) so the policy is testable away from IndexedDB. This is
 * the input the cycle planner (Problem 5) reads to recommend challenge / review / light.
 */

import type { Card, ErrorEvent, ErrorType, Skill } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import { Rating, type SrsRecord } from "@/lib/srs/fsrs";
import type { ReviewRecord } from "@/lib/store/repository";

export const SKILLS: readonly Skill[] = ["vocabulary", "grammar", "listening", "speaking"];

/** ErrorTypes that read as grammar; everything else maps to vocabulary. */
const GRAMMAR_ERROR_TYPES: ReadonlySet<ErrorType> = new Set(["tense", "article", "word-order"]);

const DAY_MS = 86_400_000;
/** "Recent" = the last week of activity — the window proficiency and fatigue read from. */
const RECENT_WINDOW_MS = 7 * DAY_MS;
/** The trailing reviews fatigue inspects per skill — a rough "last session" worth. */
const FATIGUE_WINDOW = 8;
/** Stability (days) at which a skill's cards count as fully "proven" for the proxy. */
const STABILITY_TARGET_DAYS = 21;
/** Latency (ms) treated as fully fatigued; matches the saturation floor in `sessionMode`. */
const SLOW_LATENCY_MS = 12_000;
/** Recent production errors that saturate the error contribution to fatigue. */
const ERROR_FATIGUE_FULL = 5;

export interface SkillState {
  /** 0..1 — recent accuracy scaled by how stable this skill's cards actually are. */
  proficiency: number;
  /** 0..1 — recent lapse/latency/error spike. Higher = more drained right now. */
  fatigue: number;
  /** This skill's cards currently due. */
  due: number;
  /** Reviews seen for this skill in the recent window — coverage/confidence for the above. */
  reviews: number;
}

/**
 * Infer the skill a card mostly trains. Priority: an explicit tag wins; otherwise a card the
 * learner has spoken (pronunciation attempts) is speaking, a native-audio card is listening,
 * a grammatical error type is grammar, and everything else is vocabulary. Derive-on-read so
 * untagged/back-catalogue cards still classify.
 */
export function skillOfCard(
  card: Pick<Card, "skill" | "audioClipPath" | "errorType">,
  opts: { hasSpeechAttempt?: boolean } = {},
): Skill {
  if (card.skill) return card.skill;
  if (opts.hasSpeechAttempt) return "speaking";
  if (card.audioClipPath) return "listening";
  if (card.errorType && GRAMMAR_ERROR_TYPES.has(card.errorType)) return "grammar";
  return "vocabulary";
}

/** Skill an isolated production error reads as — only grammar vs vocabulary are observable. */
function skillOfErrorEvent(event: ErrorEvent): Skill {
  return event.errorTypes.some((t) => GRAMMAR_ERROR_TYPES.has(t)) ? "grammar" : "vocabulary";
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function passed(r: ReviewRecord): boolean {
  return r.grade >= Rating.Good;
}

function emptyState(): SkillState {
  return { proficiency: 0, fatigue: 0, due: 0, reviews: 0 };
}

/**
 * Per-skill proficiency / fatigue / due, derived from real logs. Every output sits in a sane
 * range (proficiency & fatigue in [0,1]); a skill the learner has never touched reads as all
 * zeros (unproven, not tired) rather than throwing the planner off.
 */
export function deriveSkillStates(
  reviews: ReviewRecord[],
  cards: { card: Card; srs: SrsRecord }[],
  pronunciationAttempts: PronunciationAttempt[] = [],
  errorEvents: ErrorEvent[] = [],
  now: number = Date.now(),
): Record<Skill, SkillState> {
  const since = now - RECENT_WINDOW_MS;

  // 1. Classify each current card. Cards the learner has spoken count as speaking.
  const spokenCardIds = new Set(
    pronunciationAttempts.map((a) => a.cardId).filter((id): id is string => !!id),
  );
  const skillByCardId = new Map<string, Skill>();
  const cardsBySkill = new Map<Skill, { card: Card; srs: SrsRecord }[]>();
  for (const skill of SKILLS) cardsBySkill.set(skill, []);
  for (const entry of cards) {
    const skill = skillOfCard(entry.card, { hasSpeechAttempt: spokenCardIds.has(entry.card.id) });
    skillByCardId.set(entry.card.id, skill);
    cardsBySkill.get(skill)!.push(entry);
  }

  // 2. Bucket reviews by skill. Reviews outlive their card (denormalized), so fall back to the
  //    review's own errorType when the source card is gone.
  const reviewsBySkill = new Map<Skill, ReviewRecord[]>();
  for (const skill of SKILLS) reviewsBySkill.set(skill, []);
  for (const r of reviews) {
    const skill =
      skillByCardId.get(r.cardId) ??
      (r.errorType && GRAMMAR_ERROR_TYPES.has(r.errorType) ? "grammar" : "vocabulary");
    reviewsBySkill.get(skill)!.push(r);
  }

  // 3. Recent production errors per skill — secondary fatigue signal.
  const recentErrorsBySkill = new Map<Skill, number>();
  for (const skill of SKILLS) recentErrorsBySkill.set(skill, 0);
  for (const e of errorEvents) {
    if (e.createdAt < since) continue;
    const skill = skillOfErrorEvent(e);
    recentErrorsBySkill.set(skill, recentErrorsBySkill.get(skill)! + 1);
  }

  // 4. Recent pronunciation accuracy (0..1), the richer signal for speaking proficiency.
  const recentPron = pronunciationAttempts.filter((a) => a.createdAt >= since);
  const pronSource = recentPron.length ? recentPron : pronunciationAttempts;
  const speakingAccuracy = pronSource.length
    ? clamp01(pronSource.reduce((s, a) => s + a.scores.overall, 0) / pronSource.length / 100)
    : undefined;

  const out = {} as Record<Skill, SkillState>;
  for (const skill of SKILLS) {
    const skillCards = cardsBySkill.get(skill)!;
    const skillReviews = reviewsBySkill.get(skill)!;
    const recent = skillReviews.filter((r) => r.reviewedAt >= since);

    if (skillCards.length === 0 && skillReviews.length === 0 && (skill !== "speaking" || !speakingAccuracy)) {
      out[skill] = emptyState();
      continue;
    }

    // proficiency = how well you're recalling × how stable the material actually is.
    const reviewAccuracy = recent.length
      ? recent.filter(passed).length / recent.length
      : skillReviews.length
        ? skillReviews.filter(passed).length / skillReviews.length
        : 0;
    const accuracy = skill === "speaking" && speakingAccuracy !== undefined
      ? speakingAccuracy
      : reviewAccuracy;
    const stabilityProxy = skillCards.length
      ? skillCards.reduce((s, c) => s + clamp01(c.srs.stability / STABILITY_TARGET_DAYS), 0) /
        skillCards.length
      : 0;
    const proficiency = clamp01(accuracy * stabilityProxy);

    // fatigue = recent struggle in the last session-ish window: failures + slow answers,
    // nudged by fresh production errors. Absolute (not vs a baseline) so sparse logs stay calm.
    const window = [...skillReviews].sort((a, b) => b.reviewedAt - a.reviewedAt).slice(0, FATIGUE_WINDOW);
    const lapseLevel = window.length
      ? window.filter((r) => r.grade === Rating.Again).length / window.length
      : 0;
    const timed = window.filter((r): r is ReviewRecord & { latencyMs: number } => r.latencyMs != null);
    const latencyLevel = timed.length
      ? clamp01(timed.reduce((s, r) => s + r.latencyMs, 0) / timed.length / SLOW_LATENCY_MS)
      : 0;
    const errorLevel = clamp01(recentErrorsBySkill.get(skill)! / ERROR_FATIGUE_FULL);
    const fatigue = clamp01(0.5 * lapseLevel + 0.35 * latencyLevel + 0.15 * errorLevel);

    const due = skillCards.filter((c) => c.srs.due <= now).length;

    out[skill] = { proficiency, fatigue, due, reviews: recent.length };
  }
  return out;
}
