import type { LearningProfile, MethodObjective } from "@/features/settings/learningProfile";
import type { ErrorEvent } from "@/lib/cards/schema";
import type { ActivityEvent, MethodStagePayload } from "@/lib/store/activityLog";

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

export type MethodRoute = "lesson" | "discover" | "review" | "correct" | "speak";

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
  rhythm: WeeklyRhythm;
}

export interface WeeklyRhythm {
  activeDays: number;
  remainingDays: number;
  stageDays: Partial<Record<MethodStage, number>>;
  focusDays: Partial<Record<WeeklyMethodFocus, number>>;
  nextFocus: WeeklyMethodFocus;
  guidance: string;
}

export type WeeklyMethodFocus = "introduce" | "listen" | "speak" | "expand" | "simulate" | "transfer" | "reflect";

export interface WeeklyMethodDay {
  day: number;
  focus: WeeklyMethodFocus;
  title: string;
  stages: MethodStage[];
  recovery: string;
}

/** Soft weekly rhythm from the method; missed days are recovered, not punished. */
export const WEEKLY_METHOD_TEMPLATE: readonly WeeklyMethodDay[] = [
  { day: 1, focus: "introduce", title: "Introduce useful language", stages: ["learn", "listen", "speak"], recovery: "Start with a short phrase and one simple personal answer." },
  { day: 2, focus: "listen", title: "Listen and notice", stages: ["listen", "notice"], recovery: "If time is short, listen and keep one phrase." },
  { day: 3, focus: "speak", title: "Repeat and produce", stages: ["repeat", "speak", "feedback"], recovery: "A short spoken attempt still counts as useful output." },
  { day: 4, focus: "expand", title: "Expand the message", stages: ["learn", "notice", "review"], recovery: "Reuse one phrase in a different situation." },
  { day: 5, focus: "simulate", title: "Simulate a real situation", stages: ["speak", "feedback", "retry"], recovery: "Focus retry on the one issue that affects communication most." },
  { day: 6, focus: "transfer", title: "Transfer across contexts", stages: ["listen", "speak", "review"], recovery: "Use a saved phrase or recurring error in a new context." },
  { day: 7, focus: "reflect", title: "Review and reflect", stages: ["review", "feedback"], recovery: "Review what helped; the next week can recover anything missed." },
];

export function weeklyMethodTemplate(): WeeklyMethodDay[] {
  return WEEKLY_METHOD_TEMPLATE.map((day) => ({ ...day, stages: [...day.stages] }));
}

/** Map a calendar date to the method's Monday-first rhythm without duplicating date math in UI. */
export function weeklyMethodDayForDate(date = new Date()): WeeklyMethodDay {
  const mondayIndex = (date.getDay() + 6) % 7;
  return WEEKLY_METHOD_TEMPLATE[mondayIndex] ?? WEEKLY_METHOD_TEMPLATE[0];
}

export interface MethodSnapshot {
  cards: number;
  due: number;
  errorEvents: ErrorEvent[];
}

/**
 * Fallback for a profile with no stated objective — one written before onboarding asked.
 * This is not "the method's split": the five distributions in `TARGETS` are canonical and
 * every onboarded profile carries one.
 */
const DEFAULT_TARGET: MethodTarget = {
  structured: 0.4,
  listening: 0.3,
  speaking: 0.2,
  readingWriting: 0.1,
};

/**
 * Per-emit ceiling for one stage. A single measured window longer than this is idle
 * time, not study time. The ledger clamps on write (`useStageTimer`) and again on read,
 * so a stale or buggy client can never skew the week's balance.
 */
export const MAX_STAGE_MINUTES: Record<MethodStage, number> = {
  learn: 15,
  listen: 10,
  notice: 10,
  repeat: 5,
  speak: 8,
  feedback: 8,
  retry: 5,
  review: 5,
};

/** What a stage event with no measured `minutes` is worth. Events logged before the
 * timer existed rely on this. */
export const DEFAULT_STAGE_MINUTES = 2;

const TARGETS: Record<MethodObjective, MethodTarget> = {
  conversation: { structured: 0.3, listening: 0.35, speaking: 0.25, readingWriting: 0.1 },
  professional: { structured: 0.35, listening: 0.25, speaking: 0.2, readingWriting: 0.2 },
  academic: { structured: 0.3, listening: 0.2, speaking: 0.15, readingWriting: 0.35 },
  travel: { structured: 0.25, listening: 0.3, speaking: 0.35, readingWriting: 0.1 },
  media: { structured: 0.25, listening: 0.4, speaking: 0.25, readingWriting: 0.1 },
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

/** The single objective-to-distribution policy used by planning and progress coaching. */
export function targetForProfile(profile: Pick<LearningProfile, "objective">): MethodTarget {
  return TARGETS[profile.objective] ?? DEFAULT_TARGET;
}

function add(minutes: Record<MethodArea, number>, area: MethodArea, value: number): void {
  minutes[area] += Math.max(0, value);
}

/**
 * The week's minutes per area.
 *
 * `method_stage` is the single source of truth: every stage that costs the learner
 * time emits one, so counting anything else that mirrors a stage (a review record and
 * its `cards_reviewed` event, a conversation turn and its `conversation_turn` event,
 * a pronunciation attempt and its `repeat` stage) inflates that area and skews the
 * shares `weakestArea` routes on. The only extras are the assessments, which consume
 * real time but sit outside the eight-stage loop.
 */
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
      const cap = MAX_STAGE_MINUTES[payload.stage] ?? DEFAULT_STAGE_MINUTES;
      add(minutes, payload.area, Math.min(payload.minutes ?? DEFAULT_STAGE_MINUTES, cap));
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

export function weeklyRhythm(events: ActivityEvent[], now = Date.now()): WeeklyRhythm {
  const weekStart = now - WEEK_MS;
  const recentEvents = events.filter((event) => event.ts >= weekStart);
  const activeDays = new Set(recentEvents.map((event) => new Date(event.ts).toISOString().slice(0, 10))).size;
  const stageDays: Partial<Record<MethodStage, number>> = {};
  for (const stage of ["learn", "listen", "notice", "repeat", "speak", "feedback", "retry", "review"] as MethodStage[]) {
    stageDays[stage] = new Set(
      recentEvents
        .filter((event): event is ActivityEvent<"method_stage"> => event.type === "method_stage" && (event.payload as MethodStagePayload).stage === stage)
        .map((event) => new Date(event.ts).toISOString().slice(0, 10)),
    ).size;
  }
  const focusDays: Partial<Record<WeeklyMethodFocus, number>> = {};
  for (const day of WEEKLY_METHOD_TEMPLATE) {
    const dates = new Set(
      recentEvents
        .filter((event) => {
          const methodDay = weeklyMethodDayForDate(new Date(event.ts)).day;
          return methodDay === day.day && event.type === "method_stage" && day.stages.includes((event.payload as MethodStagePayload).stage);
        })
        .map((event) => new Date(event.ts).toISOString().slice(0, 10)),
    );
    focusDays[day.focus] = dates.size;
  }
  const nextFocus = [...WEEKLY_METHOD_TEMPLATE]
    .sort((left, right) => (focusDays[left.focus] ?? 0) - (focusDays[right.focus] ?? 0))[0]?.focus ?? "introduce";
  const remainingDays = Math.max(0, 7 - activeDays);
  return {
    activeDays,
    remainingDays,
    stageDays,
    focusDays,
    nextFocus,
    guidance: activeDays >= 5
      ? "Your weekly rhythm is on track; use the weakest area as the next focus."
      : `${remainingDays} flexible day${remainingDays === 1 ? "" : "s"} remain this week; recover missing stages without a daily penalty.`,
  };
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

/**
 * Which stage the weakest area needs, read off the week's stages so the method's
 * ordering survives:
 *
 *   Notice follows Listen  — input was heard but nothing was kept from it.
 *   Repeat follows Notice and precedes Speak — a phrase was kept but never said aloud.
 *
 * `events` is already scoped to the rolling week, so a notice from three weeks ago
 * cannot pin the learner on `repeat` forever. With nothing logged every `lastStageAt`
 * is 0, both comparisons are false, and a brand-new learner is sent to `speak` — never
 * to `repeat`, which would have nothing to imitate.
 */
function stageForArea(area: MethodArea, weekEvents: ActivityEvent[]): MethodStage {
  if (area === "listening") return "listen";
  if (area === "readingWriting") return "feedback";
  if (area === "speaking") {
    return lastStageAt(weekEvents, "notice") > lastStageAt(weekEvents, "repeat") ? "repeat" : "speak";
  }
  return lastStageAt(weekEvents, "listen") > lastStageAt(weekEvents, "notice") ? "notice" : "review";
}

function actionForStage(stage: MethodStage, area: MethodArea): MethodAction {
  switch (stage) {
    case "listen":
      return {
        stage,
        area,
        route: "discover",
        title: "Listen before adding more cards",
        detail: "Spend a few minutes with real English. Catch the topic, known words, and one useful phrase.",
        cta: "Find listening",
        minutes: 9,
      };
    case "notice":
      return {
        stage,
        area,
        route: "discover",
        title: "Keep what you just heard",
        detail: "You listened, but nothing was saved. Pull out the two or three phrases you would actually use.",
        cta: "Pick phrases to keep",
        minutes: 5,
      };
    case "repeat":
      return {
        stage,
        area,
        route: "speak",
        title: "Say the phrase out loud",
        detail: "Imitate the model line first. Repeating what you noticed is what makes it available when you speak.",
        cta: "Listen and repeat",
        minutes: 4,
      };
    case "speak":
      return {
        stage,
        area,
        route: "speak",
        title: "Produce English out loud",
        detail: "Answer one short prompt in your own voice, using a phrase you already saved.",
        cta: "Speak now",
        minutes: 6,
      };
    case "feedback":
      return {
        stage,
        area,
        route: "correct",
        title: "Write, get feedback, then try again",
        detail: "A short answer is enough. The important step is applying the correction immediately.",
        cta: "Open Mistakes",
        minutes: 3,
      };
    default:
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
}

export function deriveMethodPlan(input: {
  profile: Pick<LearningProfile, "objective">;
  activity: ActivityEvent[];
  snapshot: MethodSnapshot;
  now?: number;
}): MethodPlan {
  const now = input.now ?? Date.now();
  const target = targetForProfile(input.profile);
  const minutes = activityMinutes(input.activity, now);
  const { balance, weeklyMinutes } = balanceFor(minutes, target);
  const weekEvents = recent(input.activity, now, (item) => item.ts);

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
      // A built string can never match an i18n key, so this title stays static and the
      // count is carried by the surrounding copy, which the UI already localizes.
      route: "review",
      title: "Practice phrases are due",
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
    const area = weakestArea(balance).area;
    action = actionForStage(stageForArea(area, weekEvents), area);
  }

  return {
    action,
    missingStage: action.stage,
    target,
    balance,
    weeklyMinutes,
    rhythm: weeklyRhythm(input.activity, now),
  };
}
