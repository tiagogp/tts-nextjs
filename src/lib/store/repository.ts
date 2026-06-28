/**
 * Typed access to the local-first store. Sources of truth (ErrorEvent /
 * PhraseCandidate) and derived data (Card / SRS state / reviews) all flow through here.
 */

import type {
  AdvancedReview,
  Card,
  ErrorEvent,
  ErrorType,
  PhraseCandidate,
} from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { StoredProgressAssessment } from "@/features/progress/model";
import type { ConversationTurn } from "@/lib/cards/provider";
import {
  STORES,
  get,
  getAll,
  getAllFromIndex,
  put,
  putMany,
  del,
  count,
  type StoreName,
} from "@/lib/store/db";
import { initialSrs, type Grade, type SrsRecord, type State } from "@/lib/srs/fsrs";
import { applyGrade } from "@/lib/srs/fsrs";

/** D3 — one graded answer, denormalized with the concept/errorType for fast analytics. */
export interface ReviewRecord {
  id: string;
  cardId: string;
  /** ts-fsrs Rating: 1 Again / 2 Hard / 3 Good / 4 Easy. */
  grade: Grade;
  reviewedAt: number;
  /** Card state *before* this review — lets us distinguish lapses from first passes. */
  previousState: State;
  scheduledDays: number;
  /** Denormalized so weakness detection survives card deletion. */
  concept: string;
  errorType?: ErrorType;
  /** Denormalized situational context (see `Card.context`) for context-grouped weakness. */
  context?: string;
  /** ms from card-shown (flip) to grade. Overload/fatigue signal. */
  latencyMs?: number;
  /** true if any scaffold (hint/slow audio/modality) was used this review. */
  hintUsed?: boolean;
  /** 0 = none, 1 = hint, 2 = partial reveal, 3 = modality fallback. */
  scaffoldLevel?: number;
}

/** Per-review scaffolding/latency telemetry. All optional — captured now, analyzed later. */
export interface ReviewTelemetry {
  latencyMs?: number;
  hintUsed?: boolean;
  scaffoldLevel?: number;
}

/* ──────────────────────────── sources ──────────────────────────── */

export function saveErrorEvents(events: ErrorEvent[]): Promise<void> {
  return putMany(STORES.errorEvents, events);
}

export function getErrorEvents(): Promise<ErrorEvent[]> {
  return getAll<ErrorEvent>(STORES.errorEvents);
}

export function savePhraseCandidates(candidates: PhraseCandidate[]): Promise<void> {
  return putMany(STORES.phraseCandidates, candidates);
}

export function getPhraseCandidates(): Promise<PhraseCandidate[]> {
  return getAll<PhraseCandidate>(STORES.phraseCandidates);
}

/* ──────────────────────────── cards + SRS ──────────────────────────── */

export function getCards(): Promise<Card[]> {
  return getAll<Card>(STORES.cards);
}

export function getCard(id: string): Promise<Card | undefined> {
  return get<Card>(STORES.cards, id);
}

export function getSrs(cardId: string): Promise<SrsRecord | undefined> {
  return get<SrsRecord>(STORES.srs, cardId);
}

/** Write the cards and give each new one fresh SRS state (due immediately). Existing cards keep their state. */
async function persistCardsWithSrs(cards: Card[]): Promise<{ added: number }> {
  if (cards.length === 0) return { added: 0 };

  await putMany(STORES.cards, cards);

  const now = new Date();
  const newSrs: SrsRecord[] = [];
  for (const card of cards) {
    const existing = await getSrs(card.id);
    if (!existing) newSrs.push(initialSrs(card.id, now));
  }
  await putMany(STORES.srs, newSrs);
  return { added: newSrs.length };
}

/**
 * Persist a freshly generated discovery deck: the cards plus, optionally, the source
 * PhraseCandidates they were mined from (the source of truth).
 */
export async function saveGeneratedDeck(
  cards: Card[],
  candidates: PhraseCandidate[] = [],
): Promise<{ added: number }> {
  if (candidates.length > 0) await savePhraseCandidates(candidates);
  return persistCardsWithSrs(cards);
}

/**
 * E1 — persist a freshly generated correction deck: the cards plus the source
 * ErrorEvents (the source of truth) the native-correction tool produced. Mirrors
 * `saveGeneratedDeck` so the error-driven path feeds the same store, Study tab,
 * and weakness analysis the discovery path does.
 */
export async function saveCorrectionDeck(
  cards: Card[],
  events: ErrorEvent[] = [],
): Promise<{ added: number }> {
  if (events.length > 0) await saveErrorEvents(events);
  return persistCardsWithSrs(cards);
}

/* ──────────────────────────── study session ──────────────────────────── */

/** Cards whose SRS `due` is at or before `now`, oldest-due first. */
export async function getDueCards(now: number = Date.now()): Promise<
  { card: Card; srs: SrsRecord }[]
> {
  const due = await getAllFromIndex<SrsRecord>(
    STORES.srs,
    "due",
    IDBKeyRange.upperBound(now),
  );
  due.sort((a, b) => a.due - b.due);
  const out: { card: Card; srs: SrsRecord }[] = [];
  for (const srs of due) {
    const card = await getCard(srs.cardId);
    if (card) out.push({ card, srs });
  }
  return out;
}

/**
 * Every card paired with its SRS state, regardless of due date. The light-session queue
 * draws from this to surface already-stable cards (which are usually *not* due) for a
 * low-load round.
 */
export async function getCardsWithSrs(): Promise<{ card: Card; srs: SrsRecord }[]> {
  const [cards, allSrs] = await Promise.all([
    getCards(),
    getAll<SrsRecord>(STORES.srs),
  ]);
  const byId = new Map(allSrs.map((s) => [s.cardId, s]));
  const out: { card: Card; srs: SrsRecord }[] = [];
  for (const card of cards) {
    const srs = byId.get(card.id);
    if (srs) out.push({ card, srs });
  }
  return out;
}

/** Grade a card: advance its SRS state and append a review-log entry. */
export async function recordReview(
  card: Card,
  srs: SrsRecord,
  grade: Grade,
  telemetry?: ReviewTelemetry,
  now: Date = new Date(),
): Promise<SrsRecord> {
  const { next, scheduledDays, previousState } = applyGrade(srs, grade, now);
  await put(STORES.srs, next);
  const review: ReviewRecord = {
    id: crypto.randomUUID(),
    cardId: card.id,
    grade,
    reviewedAt: now.getTime(),
    previousState,
    scheduledDays,
    concept: card.concept,
    errorType: card.errorType,
    context: card.context,
    latencyMs: telemetry?.latencyMs,
    hintUsed: telemetry?.hintUsed,
    scaffoldLevel: telemetry?.scaffoldLevel,
  };
  await put(STORES.reviews, review);
  return next;
}

export function getReviews(): Promise<ReviewRecord[]> {
  return getAll<ReviewRecord>(STORES.reviews);
}

/** Which weakness dimension a card is matched on. */
export type WeaknessRef = { label: string; kind: "concept" | "errorType" | "context" };

function cardMatchesWeakness(card: Card, weakness: WeaknessRef): boolean {
  if (weakness.kind === "concept") return card.concept === weakness.label;
  if (weakness.kind === "errorType") return card.errorType === weakness.label;
  return card.context === weakness.label;
}

/**
 * D5 — reinforcement: pull every card for a weak concept/error-type/context into a focused
 * drill, regardless of FSRS due date. This is what closes the "tutor" loop — a
 * `Weakness` from `detectWeaknesses` stops being a report and becomes an actionable
 * session. Cards without SRS state (shouldn't happen, but be safe) are skipped.
 */
export async function getReinforcementCards(
  weakness: WeaknessRef,
): Promise<{ card: Card; srs: SrsRecord }[]> {
  const cards = await getCards();
  const matches = cards.filter((c) => cardMatchesWeakness(c, weakness));
  const out: { card: Card; srs: SrsRecord }[] = [];
  for (const card of matches) {
    const srs = await getSrs(card.id);
    if (srs) out.push({ card, srs });
  }
  return out;
}

/**
 * D5 (a) — the sources (PhraseCandidates / ErrorEvents) behind a weak concept/error-type.
 * Feeding these back into generation produces fresh, still-grounded variant cards that
 * drill the same weakness — directed generation without needing new material.
 */
export async function getReinforcementSources(
  weakness: WeaknessRef,
): Promise<{ candidates: PhraseCandidate[]; errors: ErrorEvent[] }> {
  const cards = await getCards();
  const matches = cards.filter((c) => cardMatchesWeakness(c, weakness));
  const phraseIds = new Set<string>();
  const errorIds = new Set<string>();
  for (const c of matches) {
    if (c.source.kind === "phrase") phraseIds.add(c.source.id);
    else errorIds.add(c.source.id);
  }
  const [allCandidates, allErrors] = await Promise.all([
    getPhraseCandidates(),
    getErrorEvents(),
  ]);
  return {
    candidates: allCandidates.filter((p) => phraseIds.has(p.id)),
    errors: allErrors.filter((e) => errorIds.has(e.id)),
  };
}

/** Persist freshly generated cards (e.g. reinforcement variants) with fresh SRS state. */
export function saveCards(cards: Card[]): Promise<{ added: number }> {
  return persistCardsWithSrs(cards);
}

/* ──────────────────────────── pronunciation attempts ──────────────────────────── */

export function savePronunciationAttempt(attempt: PronunciationAttempt): Promise<void> {
  return put(STORES.pronunciationAttempts, attempt);
}

export function getPronunciationAttempts(): Promise<PronunciationAttempt[]> {
  return getAll<PronunciationAttempt>(STORES.pronunciationAttempts);
}

export function getPronunciationAttemptsForCard(cardId: string): Promise<PronunciationAttempt[]> {
  return getAllFromIndex<PronunciationAttempt>(STORES.pronunciationAttempts, "cardId", cardId);
}

/* ──────────────────────────── progress assessments ──────────────────────────── */

export function saveProgressAssessment(assessment: StoredProgressAssessment): Promise<void> {
  return put(STORES.progressAssessments, assessment);
}

export async function getProgressAssessments(): Promise<StoredProgressAssessment[]> {
  const assessments = await getAll<StoredProgressAssessment>(STORES.progressAssessments);
  return assessments.sort((a, b) => b.createdAt - a.createdAt);
}

/* ──────────────────────────── conversations (Phase 1) ──────────────────────────── */

/**
 * One practice conversation. `scenario` is the descriptive prompt the LLM role-plays;
 * `context` is the normalized situational tag (e.g. "job interview") that Phase 2 stamps
 * onto the mistakes this conversation produces, tying it into context-grouped weakness.
 * Turns are append-only; the whole record is re-persisted as the conversation grows.
 */
export interface Conversation {
  id: string;
  scenario: string;
  context: string;
  targetLang: string;
  sourceLang: string;
  level?: string;
  challenge?: boolean;
  turns: ConversationTurn[];
  startedAt: number;
  endedAt?: number;
  /** Set once Phase 2 has run error extraction over this conversation. */
  correctedAt?: number;
  /**
   * The mistakes found in this conversation, denormalized so re-opening shows them without
   * re-charging the provider. They're also persisted to the errorEvents store once cards
   * are generated (the source of truth for weakness detection).
   */
  errors?: ErrorEvent[];
  advancedReview?: AdvancedReview;
}

export function saveConversation(conversation: Conversation): Promise<void> {
  return put(STORES.conversations, conversation);
}

export function getConversation(id: string): Promise<Conversation | undefined> {
  return get<Conversation>(STORES.conversations, id);
}

export function getConversations(): Promise<Conversation[]> {
  return getAll<Conversation>(STORES.conversations);
}

export function deleteConversation(id: string): Promise<void> {
  return del(STORES.conversations, id);
}

/* ──────────────────────────── counts / housekeeping ──────────────────────────── */

export async function getCounts(): Promise<{
  cards: number;
  reviews: number;
  due: number;
}> {
  const [cards, reviews, due] = await Promise.all([
    count(STORES.cards),
    count(STORES.reviews),
    getDueCards().then((d) => d.length),
  ]);
  return { cards, reviews, due };
}

export async function deleteCard(cardId: string): Promise<void> {
  await del(STORES.cards, cardId);
  await del(STORES.srs, cardId);
}

export interface LocalBackup {
  app: "PhraseLoop";
  schemaVersion: 1;
  dbName: string;
  exportedAt: string;
  stores: Record<StoreName, unknown[]>;
}

export async function exportLocalBackup(): Promise<LocalBackup> {
  const storeNames = Object.values(STORES) as StoreName[];
  const entries = await Promise.all(
    storeNames.map(async (store) => [store, await getAll<unknown>(store)] as const),
  );
  return {
    app: "PhraseLoop",
    schemaVersion: 1,
    dbName: "tts-cards",
    exportedAt: new Date().toISOString(),
    stores: Object.fromEntries(entries) as Record<StoreName, unknown[]>,
  };
}
