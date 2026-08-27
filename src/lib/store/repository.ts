/**
 * Typed access to the local-first store. Sources of truth (ErrorEvent /
 * PhraseCandidate) and derived data (Card / SRS state / reviews) all flow through here.
 */

import type {
  AdvancedReview,
  Card,
  CardDirection,
  CardSource,
  ErrorEvent,
  ErrorType,
  PhraseCandidate,
} from "@/lib/cards/schema";
import type { JudgeStamp } from "@/lib/evaluation/judge";
import { orientCardsForTargetFront } from "@/lib/cards/orientation";
import { buildProductiveCardPairs } from "@/lib/cards/pairs";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type { StoredProgressAssessment } from "@/features/progress/model";
import type { C1Diagnosis } from "@/features/c1/types";
import type { StoredLevelTestAttempt } from "@/features/levelup/testModel";
import type { ConversationTurn } from "@/lib/cards/provider";
import type { RepertoireItem } from "@/features/converse/repertoire";
import type {
  AudioRecording,
  ListeningAttempt,
  ProductionAttempt,
  ProofAttempt,
  RetryOutcome,
} from "@/lib/performance/types";
import type { MethodProgressionState } from "@/features/method/progression";
import type { RecallQuality } from "@/features/study/responseEvaluation";
import {
  STORES,
  clearAll,
  count,
  countFromIndex,
  del,
  get,
  getAll,
  getAllFromIndex,
  getMany,
  put,
  putMany,
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
  /**
   * When FSRS originally scheduled this review. Optional for records written before
   * due-rhythm tracking existed. Keeping the original timestamp makes "on time"
   * measurable without reconstructing overwritten SRS state.
   */
  dueAt?: number;
  /** Whether the card was actually due when graded (focused/light practice can be early). */
  wasDue?: boolean;
  /** Card state *before* this review — lets us distinguish lapses from first passes. */
  previousState: State;
  scheduledDays: number;
  /** Denormalized so weakness detection survives card deletion. */
  concept: string;
  errorType?: ErrorType;
  /** Denormalized situational context (see `Card.context`) for context-grouped weakness. */
  context?: string;
  /**
   * Denormalized recall direction (see `Card.direction`), so the unaided-production rate
   * survives card deletion. Absent on reviews recorded before directions existed — those
   * are all receptive and must not be counted as production attempts.
   */
  direction?: CardDirection;
  /** ms from prompt presentation to the learner revealing an answer. */
  latencyMs?: number;
  /** true if any scaffold (hint/slow audio/modality) was used this review. */
  hintUsed?: boolean;
  /** 0 = none, 1 = hint, 2 = partial reveal, 3 = modality fallback. */
  scaffoldLevel?: number;
  /** What the learner produced before the answer was revealed (production cards only). */
  responseText?: string;
  /** Conservative local comparison with the fixed expected phrase. */
  responseQuality?: RecallQuality;
  responseCorrect?: boolean;
  /**
   * Which checker produced `responseCorrect`. Always local today, and versioned anyway:
   * `evaluateRecall` was rewritten the day the audit landed, so a D60 window can straddle
   * two different instruments. See `src/lib/evaluation/judge.ts`.
   */
  judge?: JudgeStamp;
}

/** Per-review scaffolding/latency telemetry. All optional — captured now, analyzed later. */
export interface ReviewTelemetry {
  latencyMs?: number;
  hintUsed?: boolean;
  scaffoldLevel?: number;
  responseText?: string;
  responseQuality?: RecallQuality;
  responseCorrect?: boolean;
  judge?: JudgeStamp;
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

/** Only the sources the given cards actually reference — not the whole stores. */
async function getSourcesForCards(cards: Card[]): Promise<CardSource[]> {
  const phraseIds = new Set<string>();
  const errorIds = new Set<string>();
  for (const card of cards) {
    if (card.source.kind === "phrase") phraseIds.add(card.source.id);
    else errorIds.add(card.source.id);
  }
  const [candidates, events] = await Promise.all([
    getMany<PhraseCandidate>(STORES.phraseCandidates, [...phraseIds]),
    getMany<ErrorEvent>(STORES.errorEvents, [...errorIds]),
  ]);
  return [
    ...candidates
      .filter((candidate): candidate is PhraseCandidate => candidate !== undefined)
      .map((candidate): CardSource => ({ kind: "phrase", candidate })),
    ...events
      .filter((event): event is ErrorEvent => event !== undefined)
      .map((event): CardSource => ({ kind: "error", event })),
  ];
}

async function orientStoredCards(cards: Card[]): Promise<Card[]> {
  if (cards.length === 0) return cards;
  return orientCardsForTargetFront(cards, await getSourcesForCards(cards), "en");
}

/** One-time/idempotent upgrade for decks saved before explicit production siblings existed. */
export async function ensureProductiveCardPairs(): Promise<{ added: number }> {
  const raw = await getAll<Card>(STORES.cards);
  if (raw.length === 0) return { added: 0 };
  const sources = await getSourcesForCards(raw);
  const oriented = orientCardsForTargetFront(raw, sources, "en");
  const paired = buildProductiveCardPairs(oriented, sources);
  const changed = paired.length !== raw.length || paired.some((card, index) =>
    card.direction !== raw[index]?.direction ||
    card.front !== raw[index]?.front ||
    card.patternId !== raw[index]?.patternId,
  );
  return changed ? persistCardsWithSrs(paired) : { added: 0 };
}

export function getCards(): Promise<Card[]> {
  return getAll<Card>(STORES.cards).then(orientStoredCards);
}

export async function getCard(id: string): Promise<Card | undefined> {
  const card = await get<Card>(STORES.cards, id);
  if (!card) return undefined;
  return (await orientStoredCards([card]))[0];
}

export function getSrs(cardId: string): Promise<SrsRecord | undefined> {
  return get<SrsRecord>(STORES.srs, cardId);
}

/** Write the cards and give each new one fresh SRS state (due immediately). Existing cards keep their state. */
async function persistCardsWithSrs(cards: Card[]): Promise<{ added: number }> {
  if (cards.length === 0) return { added: 0 };

  await putMany(STORES.cards, cards);

  const now = new Date();
  const existing = await getMany<SrsRecord>(
    STORES.srs,
    cards.map((card) => card.id),
  );
  const newSrs = cards
    .filter((_, index) => !existing[index])
    .map((card) => initialSrs(card.id, now));
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
  const sources: CardSource[] = candidates.map((candidate) => ({ kind: "phrase", candidate }));
  return persistCardsWithSrs(
    buildProductiveCardPairs(orientCardsForTargetFront(cards, sources, "en"), sources),
  );
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
  const sources: CardSource[] = events.map((event) => ({ kind: "error", event }));
  return persistCardsWithSrs(
    buildProductiveCardPairs(orientCardsForTargetFront(cards, sources, "en"), sources),
  );
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
  const dueCards = await getMany<Card>(
    STORES.cards,
    due.map((srs) => srs.cardId),
  );
  const raw: { card: Card; srs: SrsRecord }[] = [];
  for (const [index, srs] of due.entries()) {
    const card = dueCards[index];
    if (card) raw.push({ card, srs });
  }
  const cards = await orientStoredCards(raw.map((item) => item.card));
  return raw.map((item, index) => ({ ...item, card: cards[index] }));
}

/**
 * How many cards are due right now, straight off the `due` index — no cards,
 * sources, or orientation are loaded. This is what badges and "what's next"
 * surfaces should call; `getDueCards` is for actually starting a session.
 */
export function countDueCards(now: number = Date.now()): Promise<number> {
  return countFromIndex(STORES.srs, "due", IDBKeyRange.upperBound(now));
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
): Promise<{ next: SrsRecord; review: ReviewRecord }> {
  const { next, scheduledDays, previousState } = applyGrade(srs, grade, now);
  await put(STORES.srs, next);
  const review: ReviewRecord = {
    id: crypto.randomUUID(),
    cardId: card.id,
    grade,
    reviewedAt: now.getTime(),
    dueAt: srs.due,
    wasDue: srs.due <= now.getTime(),
    previousState,
    scheduledDays,
    concept: card.concept,
    errorType: card.errorType,
    context: card.context,
    direction: card.direction,
    latencyMs: telemetry?.latencyMs,
    hintUsed: telemetry?.hintUsed,
    scaffoldLevel: telemetry?.scaffoldLevel,
    responseText: telemetry?.responseText,
    responseQuality: telemetry?.responseQuality,
    responseCorrect: telemetry?.responseCorrect,
  };
  await put(STORES.reviews, review);
  return { next, review };
}

export function getReviews(): Promise<ReviewRecord[]> {
  return getAll<ReviewRecord>(STORES.reviews);
}

/**
 * Reviews graded at or after `since`, straight off the `reviewedAt` index. Prefer this
 * over `getReviews()` for windowed stats (weekly activity, recent-days charts) — the
 * full log grows without bound under daily use.
 */
export function getReviewsSince(since: number): Promise<ReviewRecord[]> {
  return getAllFromIndex<ReviewRecord>(
    STORES.reviews,
    "reviewedAt",
    IDBKeyRange.lowerBound(since),
  );
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
  const srsRecords = await getMany<SrsRecord>(
    STORES.srs,
    matches.map((card) => card.id),
  );
  const out: { card: Card; srs: SrsRecord }[] = [];
  for (const [index, card] of matches.entries()) {
    const srs = srsRecords[index];
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
  return persistCardsWithSrs(buildProductiveCardPairs(cards));
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

/* ──────────────────────────── C1 diagnosis (experimental) ──────────────────────────── */

export function saveC1Diagnosis(diagnosis: C1Diagnosis): Promise<void> {
  return put(STORES.c1Diagnoses, diagnosis);
}

export async function getC1Diagnoses(): Promise<C1Diagnosis[]> {
  const diagnoses = await getAll<C1Diagnosis>(STORES.c1Diagnoses);
  return diagnoses.sort((a, b) => b.createdAt - a.createdAt);
}

/* ──────────────────────────── level-up test attempts ──────────────────────────── */

export function saveLevelTestAttempt(attempt: StoredLevelTestAttempt): Promise<void> {
  return put(STORES.levelTests, attempt);
}

export async function getLevelTestAttempts(): Promise<StoredLevelTestAttempt[]> {
  const attempts = await getAll<StoredLevelTestAttempt>(STORES.levelTests);
  return attempts.sort((a, b) => b.createdAt - a.createdAt);
}

/* ──────────────────────────── method performance evidence ──────────────────────────── */

function notifyPerformanceEvidenceSaved(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("phraseloop:performance-evidence"));
  }
}

export async function saveListeningAttempt(attempt: ListeningAttempt): Promise<void> {
  await put(STORES.listeningAttempts, attempt);
  notifyPerformanceEvidenceSaved();
}

export function getListeningAttempts(): Promise<ListeningAttempt[]> {
  return getAll<ListeningAttempt>(STORES.listeningAttempts);
}

export function getListeningAttemptsForLesson(lessonId: string): Promise<ListeningAttempt[]> {
  return getAllFromIndex<ListeningAttempt>(STORES.listeningAttempts, "lessonId", lessonId);
}

export async function saveProductionAttempt(attempt: ProductionAttempt): Promise<void> {
  await put(STORES.productionAttempts, attempt);
  notifyPerformanceEvidenceSaved();
}

export function getProductionAttempts(): Promise<ProductionAttempt[]> {
  return getAll<ProductionAttempt>(STORES.productionAttempts);
}

export function getProductionAttemptsForLesson(lessonId: string): Promise<ProductionAttempt[]> {
  return getAllFromIndex<ProductionAttempt>(STORES.productionAttempts, "lessonId", lessonId);
}

/**
 * Queue C writes land here and nowhere else. There is deliberately no path from a proof to
 * `saveReview` or to SRS state: the whole value of the measurement is that answering it
 * does not reschedule the card. If a caller ever needs a proof to also count as study, the
 * answer is to add a separate review, not to widen this.
 */
export async function saveProofAttempt(attempt: ProofAttempt): Promise<void> {
  await put(STORES.proofAttempts, attempt);
  notifyPerformanceEvidenceSaved();
}

export function getProofAttempts(): Promise<ProofAttempt[]> {
  return getAll<ProofAttempt>(STORES.proofAttempts);
}

export async function saveRetryOutcome(outcome: RetryOutcome): Promise<void> {
  await put(STORES.retryOutcomes, outcome);
  notifyPerformanceEvidenceSaved();
}

export function getRetryOutcomes(): Promise<RetryOutcome[]> {
  return getAll<RetryOutcome>(STORES.retryOutcomes);
}

export function getRetryOutcomesForAttempt(retryOf: string): Promise<RetryOutcome[]> {
  return getAllFromIndex<RetryOutcome>(STORES.retryOutcomes, "retryOf", retryOf);
}

export function saveMethodProgression(state: MethodProgressionState): Promise<void> {
  return put(STORES.methodProgression, state);
}

export function getMethodProgression(): Promise<MethodProgressionState | undefined> {
  return get<MethodProgressionState>(STORES.methodProgression, "current");
}

/* ──────────────────────────── bounded local recordings ──────────────────────────── */

const MAX_RECORDING_COUNT = 80;
const MAX_RECORDING_BYTES = 80 * 1024 * 1024;

export async function saveAudioRecording(recording: AudioRecording): Promise<void> {
  await put(STORES.audioRecordings, recording);
  const all = (await getAll<AudioRecording>(STORES.audioRecordings)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  let bytes = 0;
  const keep = new Set<string>();
  for (const item of all) {
    if (keep.size >= MAX_RECORDING_COUNT || bytes + item.sizeBytes > MAX_RECORDING_BYTES) continue;
    keep.add(item.id);
    bytes += item.sizeBytes;
  }
  await Promise.all(all.filter((item) => !keep.has(item.id)).map((item) => del(STORES.audioRecordings, item.id)));
}

export function getAudioRecording(id: string): Promise<AudioRecording | undefined> {
  return get<AudioRecording>(STORES.audioRecordings, id);
}

export function deleteAudioRecording(id: string): Promise<void> {
  return del(STORES.audioRecordings, id);
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
  progressionStage?: string;
  /** Familiar personal topics are deliberately rotated and revisited over time. */
  topicId?: string;
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
  /**
   * Repertoire mode (C1-C2): the expressions the partner introduced, and which ones the learner
   * said back. Persisted rather than re-derived because the glosses live in a trailer that is
   * stripped before a turn is stored, and because the review reports uptake after the fact.
   */
  repertoire?: RepertoireItem[];
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
    countDueCards(),
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

interface SerializedAudioRecording {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  /** Data URL keeps local recordings portable without exposing a filesystem path. */
  blobDataUrl: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function serializeAudioRecording(recording: AudioRecording): Promise<SerializedAudioRecording> {
  const bytes = new Uint8Array(await recording.blob.arrayBuffer());
  return {
    id: recording.id,
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    createdAt: recording.createdAt,
    blobDataUrl: `data:${recording.mimeType};base64,${bytesToBase64(bytes)}`,
  };
}

function restoreAudioRecording(row: SerializedAudioRecording): AudioRecording {
  const [, base64 = ""] = row.blobDataUrl.split(",", 2);
  return {
    id: row.id,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    blob: new Blob([base64ToBytes(base64).buffer as ArrayBuffer], { type: row.mimeType }),
  };
}

export interface BackupValidationResult {
  ok: boolean;
  errors: string[];
  counts: Record<StoreName, number>;
  totalRecords: number;
  exportedAt?: string;
}

function emptyBackupCounts(): Record<StoreName, number> {
  return Object.fromEntries(
    (Object.values(STORES) as StoreName[]).map((store) => [store, 0]),
  ) as Record<StoreName, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateLocalBackup(raw: unknown): BackupValidationResult {
  const counts = emptyBackupCounts();
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return {
      ok: false,
      errors: ["Backup file must contain a JSON object."],
      counts,
      totalRecords: 0,
    };
  }

  if (raw.app !== "PhraseLoop") errors.push("Backup is not a PhraseLoop export.");
  if (raw.schemaVersion !== 1) errors.push("Backup schema version is not supported.");
  if (!isRecord(raw.stores)) errors.push("Backup is missing its stores.");

  if (isRecord(raw.stores)) {
    const knownStores = new Set(Object.values(STORES) as StoreName[]);
    for (const store of Object.keys(raw.stores)) {
      if (!knownStores.has(store as StoreName)) errors.push(`Unknown store: ${store}.`);
    }
    for (const store of Object.values(STORES) as StoreName[]) {
      const rows = raw.stores[store];
      if (rows === undefined) continue;
      if (!Array.isArray(rows)) {
        errors.push(`${store} must be an array.`);
        continue;
      }
      counts[store] = rows.length;
      for (const [index, row] of rows.entries()) {
        if (!isRecord(row)) {
          errors.push(`${store}[${index}] must be an object.`);
          continue;
        }
        if (typeof row.id !== "string" && store !== STORES.srs && store !== STORES.effortHistory) {
          errors.push(`${store}[${index}] is missing an id.`);
        }
        if (store === STORES.srs && typeof row.cardId !== "string") {
          errors.push(`${store}[${index}] is missing a cardId.`);
        }
        if (store === STORES.effortHistory && typeof row.weekOf !== "string") {
          errors.push(`${store}[${index}] is missing a weekOf key.`);
        }
        if (errors.length >= 12) {
          errors.push("More validation errors were omitted.");
          break;
        }
      }
    }
  }

  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (totalRecords === 0) errors.push("Backup contains no records to restore.");

  return {
    ok: errors.length === 0,
    errors,
    counts,
    totalRecords,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : undefined,
  };
}

export async function exportLocalBackup(): Promise<LocalBackup> {
  const storeNames = Object.values(STORES) as StoreName[];
  const entries = await Promise.all(
    storeNames.map(async (store) => {
      const rows = await getAll<unknown>(store);
      const exported = store === STORES.audioRecordings
        ? await Promise.all((rows as AudioRecording[]).map(serializeAudioRecording))
        : rows;
      return [store, exported] as const;
    }),
  );
  return {
    app: "PhraseLoop",
    schemaVersion: 1,
    dbName: "tts-cards",
    exportedAt: new Date().toISOString(),
    stores: Object.fromEntries(entries) as Record<StoreName, unknown[]>,
  };
}

export async function restoreLocalBackup(raw: unknown): Promise<BackupValidationResult> {
  const validation = validateLocalBackup(raw);
  if (!validation.ok || !isRecord(raw) || !isRecord(raw.stores)) return validation;

  for (const store of Object.values(STORES) as StoreName[]) {
    const rows = raw.stores[store];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const restored = store === STORES.audioRecordings
      ? rows.map((row) => restoreAudioRecording(row as SerializedAudioRecording))
      : rows;
    await putMany(store, restored);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("phraseloop:backup-restored"));
    window.dispatchEvent(new CustomEvent("phraseloop:activity"));
  }
  return validation;
}

/**
 * Data transparency (launch checklist item 8): delete every record PhraseLoop keeps in
 * the browser — all IndexedDB stores plus localStorage preferences. Files on disk
 * (imported-audio cache, voice reference, logs) are removed separately via
 * DELETE /api/data; the caller is expected to do both and then reload.
 */
export async function wipeLocalData(): Promise<void> {
  await clearAll();
  if (typeof localStorage !== "undefined") localStorage.clear();
}
