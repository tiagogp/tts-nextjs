import type { LearningProfile } from "@/features/settings/learningProfile";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";
import type {
  ActivityEvent,
  CardsCreatedPayload,
  CardsReviewedPayload,
  MethodStagePayload,
} from "@/lib/store/activityLog";
import type { Conversation, ReviewRecord } from "@/lib/store/repository";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export type MethodArea = "structured" | "listening" | "speaking" | "readingWriting";

export type MethodStage =
  | "learn"
  | "listen"
  | "notice"
  | "repeat"
  | "speak"
  | "feedback"
  | "retry"
  | "review";

export type MethodRoute = "lesson" | "discover" | "review" | "correct" | "conversation" | "none";

export interface MethodTarget {
  structured: number;
  listening: number;
  speaking: number;
  readingWriting: number;
}

export interface MethodBalance {
  area: MethodArea;
  label: string;
  target: number;
  minutes: number;
  share: number;
  deficit: number;
}

export interface MethodAction {
  stage: MethodStage;
  area: MethodArea;
  route: MethodRoute;
  title: string;
  detail: string;
  cta: string;
  minutes: number;
}

export interface MethodPlan {
  action: MethodAction;
  missingStage: MethodStage;
  target: MethodTarget;
  balance: MethodBalance[];
  weeklyMinutes: number;
}

export interface MethodSnapshot {
  cards: number;
  due: number;
  reviews: ReviewRecord[];
  errorEvents: ErrorEvent[];
  conversations: Conversation[];
  pronunciationAttempts: PronunciationAttempt[];
}

const DEFAULT_TARGET: MethodTarget = {
  structured: 0.4,
  listening: 0.3,
  speaking: 0.2,
  readingWriting: 0.1,
};

const TARGETS: Record<"conversation" | "professional" | "academic" | "travel", MethodTarget> = {
  conversation: { structured: 0.3, listening: 0.35, speaking: 0.25, readingWriting: 0.1 },
  professional: { structured: 0.35, listening: 0.25, speaking: 0.2, readingWriting: 0.2 },
  academic: { structured: 0.3, listening: 0.2, speaking: 0.15, readingWriting: 0.35 },
  travel: { structured: 0.25, listening: 0.3, speaking: 0.35, readingWriting: 0.1 },
};

const AREA_LABEL: Record<MethodArea, string> = {
  structured: "Study",
  listening: "Listen",
  speaking: "Speak",
  readingWriting: "Write",
};

function recent<T>(items: T[], now: number, getTime: (item: T) => number): T[] {
  const since = now - WEEK_MS;
  return items.filter((item) => getTime(item) >= since);
}

function targetForProfile(profile: Pick<LearningProfile, "focus" | "track">): MethodTarget {
  const focus = profile.focus.toLowerCase();
  if (/\b(academic|exam|ielts|toefl|university|research|paper|reading)\b/.test(focus)) {
    return TARGETS.academic;
  }
  if (/\b(work|professional|email|meeting|presentation|business|interview)\b/.test(focus)) {
    return TARGETS.professional;
  }
  if (/\b(travel|trip|restaurant|hotel|airport)\b/.test(focus)) return TARGETS.travel;
  return profile.track === "intermediate" ? TARGETS.conversation : DEFAULT_TARGET;
}

function add(minutes: Record<MethodArea, number>, area: MethodArea, value: number): void {
  minutes[area] += Math.max(0, value);
}

function activityMinutes(events: ActivityEvent[], now: number): Record<MethodArea, number> {
  const minutes: Record<MethodArea, number> = {
    structured: 0,
    listening: 0,
    speaking: 0,
    readingWriting: 0,
  };

  for (const event of recent(events, now, (item) => item.ts)) {
    if (event.type === "method_stage") {
      const payload = event.payload as MethodStagePayload;
      add(minutes, payload.area, payload.minutes ?? 2);
    } else if (event.type === "cards_reviewed") {
      const payload = event.payload as CardsReviewedPayload;
      add(minutes, "structured", payload.count);
    } else if (event.type === "cards_created") {
      const payload = event.payload as CardsCreatedPayload;
      add(minutes, payload.source === "discover" ? "listening" : "structured", payload.count * 0.5);
    } else if (event.type === "video_processed" || event.type === "own_source_completed") {
      add(minutes, "listening", 5);
    } else if (event.type === "own_source_started") {
      add(minutes, "listening", 2);
    } else if (event.type === "conversation_turn") {
      add(minutes, "speaking", 2);
    } else if (event.type === "mistake_submitted") {
      add(minutes, "readingWriting", 3);
    } else if (event.type === "correction_generated") {
      add(minutes, "readingWriting", 3);
    } else if (event.type === "progress_checkin") {
      add(minutes, "readingWriting", 5);
    } else if (event.type === "c1_diagnosis_completed") {
      add(minutes, "readingWriting", 8);
    } else if (event.type === "level_test_completed") {
      add(minutes, "readingWriting", 10);
    }
  }

  return minutes;
}

function addSnapshotMinutes(
  minutes: Record<MethodArea, number>,
  snapshot: MethodSnapshot,
  now: number,
): void {
  add(minutes, "speaking", recent(snapshot.pronunciationAttempts, now, (item) => item.createdAt).length * 3);

  const recentConversations = recent(snapshot.conversations, now, (item) => item.startedAt);
  const userTurns = recentConversations.reduce(
    (sum, conversation) => sum + conversation.turns.filter((turn) => turn.role === "user").length,
    0,
  );
  add(minutes, "speaking", userTurns * 2);

  const recentReviews = recent(snapshot.reviews, now, (item) => item.reviewedAt).length;
  add(minutes, "structured", recentReviews);

  const recentErrors = recent(snapshot.errorEvents, now, (item) => item.createdAt).length;
  add(minutes, "readingWriting", recentErrors);
}

function balanceFor(
  minutes: Record<MethodArea, number>,
  target: MethodTarget,
): { balance: MethodBalance[]; weeklyMinutes: number } {
  const weeklyMinutes = Object.values(minutes).reduce((sum, value) => sum + value, 0);
  const denominator = Math.max(1, weeklyMinutes);
  const balance = (Object.keys(target) as MethodArea[]).map((area) => {
    const share = minutes[area] / denominator;
    return {
      area,
      label: AREA_LABEL[area],
      target: target[area],
      minutes: minutes[area],
      share,
      deficit: Math.max(0, target[area] - share),
    };
  });
  return { balance, weeklyMinutes };
}

function lastStageAt(events: ActivityEvent[], stage: MethodStage): number {
  let newest = 0;
  for (const event of events) {
    if (event.type === "method_stage" && (event.payload as MethodStagePayload).stage === stage) {
      newest = Math.max(newest, event.ts);
    }
  }
  return newest;
}

function needsRetry(snapshot: MethodSnapshot, events: ActivityEvent[], now: number): boolean {
  const newestError = recent(snapshot.errorEvents, now, (item) => item.createdAt).reduce(
    (latest, event) => Math.max(latest, event.createdAt),
    0,
  );
  if (newestError === 0) return false;
  return lastStageAt(events, "retry") < newestError;
}

function weakestArea(balance: MethodBalance[]): MethodBalance {
  return [...balance].sort((a, b) => b.deficit - a.deficit)[0] ?? balance[0];
}

function actionForArea(area: MethodArea): MethodAction {
  if (area === "listening") {
    return {
      stage: "listen",
      area,
      route: "discover",
      title: "Listen before adding more cards",
      detail: "Spend a few minutes with real English. Catch the topic, known words, and one useful phrase.",
      cta: "Find listening",
      minutes: 9,
    };
  }
  if (area === "speaking") {
    return {
      stage: "speak",
      area,
      route: "correct",
      title: "Produce English out loud",
      detail: "Use a phrase you already saved in one short answer, then get focused feedback.",
      cta: "Speak or write",
      minutes: 6,
    };
  }
  if (area === "readingWriting") {
    return {
      stage: "feedback",
      area,
      route: "correct",
      title: "Write, get feedback, then try again",
      detail: "A short answer is enough. The important step is applying the correction immediately.",
      cta: "Open Mistakes",
      minutes: 3,
    };
  }
  return {
    stage: "review",
    area,
    route: "review",
    title: "Review to make phrases usable",
    detail: "Use active recall before adding new material, so your useful phrases stay available.",
    cta: "Review now",
    minutes: 12,
  };
}

export function deriveMethodPlan(input: {
  profile: Pick<LearningProfile, "focus" | "track">;
  activity: ActivityEvent[];
  snapshot: MethodSnapshot;
  now?: number;
}): MethodPlan {
  const now = input.now ?? Date.now();
  const target = targetForProfile(input.profile);
  const minutes = activityMinutes(input.activity, now);
  addSnapshotMinutes(minutes, input.snapshot, now);
  const { balance, weeklyMinutes } = balanceFor(minutes, target);

  let action: MethodAction;
  if (input.snapshot.cards === 0) {
    action = {
      stage: "learn",
      area: "structured",
      route: "lesson",
      title: "Start with one useful phrase",
      detail: "Learn it, hear it, repeat it, then use it in your own sentence.",
      cta: "Start first lesson",
      minutes: 12,
    };
  } else if (input.snapshot.due > 0) {
    action = {
      stage: "review",
      area: "structured",
      route: "review",
      title: `${input.snapshot.due} practice phrase${input.snapshot.due === 1 ? "" : "s"} due`,
      detail: "Review first. Retrieval is the structured part that keeps input available for speaking.",
      cta: "Review now",
      minutes: Math.min(12, Math.max(3, input.snapshot.due)),
    };
  } else if (needsRetry(input.snapshot, input.activity, now)) {
    action = {
      stage: "retry",
      area: "speaking",
      route: "correct",
      title: "Try a corrected idea again",
      detail: "Feedback only sticks when you immediately say or write a clearer version.",
      cta: "Try again",
      minutes: 6,
    };
  } else {
    action = actionForArea(weakestArea(balance).area);
  }

  return {
    action,
    missingStage: action.stage,
    target,
    balance,
    weeklyMinutes,
  };
}
