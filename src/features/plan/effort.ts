import { getActivitySince } from "@/lib/store/activityLog";
import type { ActivityEvent, ActivityEventType, CardsReviewedPayload, ConversationTurnPayload } from "@/lib/store/activityLog";
import type { LearningPlan, EffortSnapshot } from "./schema";
import { getIsoWeek, saveEffortSnapshot } from "./store";

/** Approximate cost in minutes for each activity event type. */
const MINUTES_PER_EVENT: Record<ActivityEventType, (event: ActivityEvent) => number> = {
  cards_reviewed: (e) => ((e.payload as CardsReviewedPayload).count ?? 1) * 1,
  video_processed: () => 20,
  conversation_turn: () => 1.5,
  correction_generated: () => 15,
  cards_created: () => 0, // overlap with other events — don't double-count
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday = start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Minutes planned for the given ISO week from the learning plan. */
function plannedMinutesForWeek(plan: LearningPlan, weekOf: string): number {
  const weekStart = new Date(weekOf.replace("W", "") + "-1"); // approximate
  // Parse ISO week properly
  const [yearStr, weekStr] = weekOf.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(year, 0, 4);
  const weekStartMs =
    jan4.getTime() +
    (week - 1) * 7 * 86400000 -
    ((jan4.getDay() + 6) % 7) * 86400000;
  const ws = new Date(weekStartMs);
  ws.setHours(0, 0, 0, 0);

  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    const ds = dateString(d);
    const day = plan.days.find((day) => day.date === ds);
    if (day) total += day.estimatedMinutes;
  }
  return total;
}

/** Count consecutive days with at least one activity event, ending today. */
function computeStreak(events: ActivityEvent[]): number {
  if (events.length === 0) return 0;
  const activeDays = new Set(events.map((e) => dateString(new Date(e.ts))));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (activeDays.has(dateString(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function computeAndSaveEffortSnapshot(
  plan: LearningPlan,
  forDate: Date = new Date(),
): Promise<EffortSnapshot> {
  const weekOf = getIsoWeek(forDate);
  const ws = startOfWeek(forDate);
  const events = await getActivitySince(ws.getTime());

  // Deduplicate conversation turns by conversationId to avoid counting each
  // turn as a full event when sessions have many turns.
  const seenConversations = new Set<string>();
  let actualMinutes = 0;
  for (const e of events) {
    if (e.type === "conversation_turn") {
      const cid = (e.payload as ConversationTurnPayload).conversationId;
      if (seenConversations.has(cid)) {
        // After the first turn, each subsequent turn costs 1.5 min
        actualMinutes += 1.5;
      } else {
        seenConversations.add(cid);
        // First turn of a conversation includes ~5 min setup
        actualMinutes += 5;
      }
    } else {
      actualMinutes += MINUTES_PER_EVENT[e.type](e);
    }
  }

  // Streak uses all events since plan start
  const planStartTs = new Date(plan.startsOn).getTime();
  const allEvents = await getActivitySince(planStartTs);
  const streak = computeStreak(allEvents);

  const plannedMinutes = plannedMinutesForWeek(plan, weekOf);
  const adherenceRate =
    plannedMinutes > 0 ? Math.min(1, actualMinutes / plannedMinutes) : 0;

  const snapshot: EffortSnapshot = {
    weekOf,
    plannedMinutes,
    actualMinutes: Math.round(actualMinutes),
    adherenceRate: Math.round(adherenceRate * 100) / 100,
    streak,
  };

  await saveEffortSnapshot(snapshot);
  return snapshot;
}
