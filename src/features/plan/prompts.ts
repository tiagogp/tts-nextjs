import type { EffortSnapshot, Phase, PlanMeta, TaskType } from "./schema";

export interface PlanPromptMeta {
  goal: string;
  currentLevel: string;
  targetLevel: string;
  availabilityMinutes: number;
  planDays: number;
  language: string;
  objective?: string;
}

/** Shape of the previous chunk handed to the next one, so blocks stay continuous. */
export interface ChunkContext {
  /** Running task-type totals for every day authored so far. */
  counts: Partial<Record<TaskType, number>>;
  /** The last few authored days, so the next block does not repeat instructions. */
  recentDays: Array<{ dayNumber: number; instructions: string[] }>;
}

const ACTIVITY_MENU = `The app has these activities the learner can do each day:
- "discover": Find a YouTube video, article, or PDF, extract useful phrases, and generate flashcards from it
- "lesson": Follow a structured input-to-output lesson from learn to retry
- "study": Review due flashcards using spaced repetition (FSRS algorithm)
- "converse": Practice conversation with an AI partner in a chosen scenario
- "correct": Write or speak something, get corrections, turn mistakes into flashcards
- "readWrite": Read a meaningful sentence for comprehension, then write a short new message`;

function learnerBlock(meta: PlanPromptMeta): string {
  return `- Current level: ${meta.currentLevel}
- Target level: ${meta.targetLevel}
- Goal: ${meta.goal}
- Language being learned: ${meta.language}
- Daily availability: ${meta.availabilityMinutes} minutes
- Plan length: ${meta.planDays} days
- Structured objective: ${meta.objective ?? "conversation"}`;
}

/**
 * Call 1 of the chunked generation: phases only.
 *
 * Kept separate from the day blocks because every block needs the same phase
 * structure as context, and a 3-item JSON answers far faster than 90 days.
 */
export function buildPlanSkeletonPrompt(meta: PlanPromptMeta): string {
  return `You are a language learning curriculum designer. Design the phase structure of a ${meta.planDays}-day learning plan for a learner with these parameters:

${learnerBlock(meta)}

${ACTIVITY_MENU}

Design exactly 3 phases that build on each other and together cover days 1 to ${meta.planDays} with no gap and no overlap. Each phase needs a clear focus (e.g., "Listening and vocabulary building", "Output and error correction", "Consolidation and fluency") that moves the learner from ${meta.currentLevel} toward ${meta.targetLevel} for this specific goal.

Return ONLY valid JSON matching this exact shape:
{
  "phases": [
    { "number": 1, "title": "string", "focus": "string", "startDay": 1, "endDay": 30 }
  ]
}`;
}

/**
 * Call 2..N: the daily tasks for one block of days.
 *
 * The block is two whole weeks, so the weekly quotas below (study 5-6x, discover
 * 2-3x) and the 14-day check-in cadence all resolve inside a single answer.
 */
export function buildPlanChunkPrompt(
  meta: PlanPromptMeta,
  phases: Phase[],
  startDay: number,
  endDay: number,
  context: ChunkContext,
): string {
  const phasesDesc = phases
    .map((phase) => `  Phase ${phase.number} (days ${phase.startDay}-${phase.endDay}): ${phase.title} - ${phase.focus}`)
    .join("\n");

  const countsDesc = Object.entries(context.counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const recentDesc = context.recentDays
    .map((day) => `  - Day ${day.dayNumber}: ${day.instructions.join(" | ")}`)
    .join("\n");

  const dayCount = endDay - startDay + 1;
  const isFirstBlock = startDay === 1;

  return `You are a language learning curriculum designer writing one block of an existing ${meta.planDays}-day learning plan.

Learner:
${learnerBlock(meta)}

Plan phases:
${phasesDesc}

${ACTIVITY_MENU}

${
  isFirstBlock
    ? "This is the first block of the plan."
    : `Already authored: days 1-${startDay - 1}.
Task types used so far: ${countsDesc || "none"}.
Last authored days:
${recentDesc || "  (none)"}`
}

Write ONLY days ${startDay} to ${endDay} (${dayCount} days). For EACH day, provide 1-3 tasks. Each task must have:
- type: one of "discover", "lesson", "study", "converse", "correct", "readWrite"
- instruction: a short, concrete, actionable instruction (max 80 chars)
- targetMetric (optional): what counts as "done" (action + quantity)

Rules:
- Use the phase that contains each day number and match its focus.
${isFirstBlock ? "- Speaking must be present from day 1 with a simple level-appropriate prompt.\n" : "- Do not repeat the instructions of the last authored days; move the learner forward.\n"}- Use the structured objective to change the balance of discover, converse, correct, readWrite, lesson, and study. Conversation and travel emphasize speaking/listening; academic emphasizes reading/writing; professional balances speaking with writing; media emphasizes listening.
- Every 14 days (day 14, 28, 42, ...), include one "correct" task for a short progress check-in with targetMetric action "progress_checkin"
- study should appear 5-6 days per week (spaced repetition needs consistency)
- discover 2-3 times per week (not every day)
- Keep total estimatedMinutes close to ${meta.availabilityMinutes} per day
- study ≈ 10 min, discover ≈ 20-30 min, converse ≈ 15 min, correct ≈ 15 min

Return ONLY valid JSON with exactly ${dayCount} days, numbered ${startDay} to ${endDay}:
{
  "days": [
    {
      "dayNumber": ${startDay},
      "phase": 1,
      "estimatedMinutes": ${meta.availabilityMinutes},
      "tasks": [
        {
          "type": "discover",
          "instruction": "Find a short video on a topic you enjoy",
          "targetMetric": { "action": "video_processed", "quantity": 1 }
        }
      ]
    }
  ]
}`;
}

export function buildAdaptPrompt(
  meta: PlanMeta,
  phases: Phase[],
  remainingDays: number,
  startDayNumber: number,
  newAvailabilityMinutes: number,
  effortHistory: EffortSnapshot[],
): string {
  const historyLines = effortHistory
    .slice(-4)
    .map(
      (snapshot) =>
        `  - Week ${snapshot.weekOf}: ${Math.round(snapshot.adherenceRate * 100)}% adherence, ${snapshot.actualMinutes} actual min vs ${snapshot.plannedMinutes} planned`,
    )
    .join("\n");

  const phasesDesc = phases
    .map((phase) => `  Phase ${phase.number} (days ${phase.startDay}-${phase.endDay}): ${phase.title} - ${phase.focus}`)
    .join("\n");

  return `You are revising a language learning plan. The learner's recent effort history shows they need an adjustment.

Original plan:
- Goal: ${meta.goal}
- Language: ${meta.language}
- Current level: ${meta.currentLevel} -> Target: ${meta.targetLevel}
- Original daily availability: ${meta.availabilityMinutes} min/day
- New daily availability: ${newAvailabilityMinutes} min/day
- Structured objective: ${meta.objective ?? "conversation"}

Plan phases:
${phasesDesc}

Recent effort history (last weeks):
${historyLines || "  No history yet"}

Generate revised daily tasks for the REMAINING ${remainingDays} days, starting at day ${startDayNumber}.
Keep the same phase structure. Adjust task count and estimatedMinutes to fit ${newAvailabilityMinutes} min/day.

Rules:
- Keep the same objective distribution: conversation (more speaking/listening), professional (balanced speaking and writing), academic (more reading/writing), travel (more speaking/listening), or media (more listening).
- Include simple speaking from the first remaining day; do not postpone conversation until a later week.
- study should appear 5-6 days per week (spaced repetition needs consistency)
- keep or add one progress check-in every 14 days as a "correct" task with targetMetric action "progress_checkin"
- discover 2-3 times per week
- converse and correct based on phase and availability
- Keep estimatedMinutes close to ${newAvailabilityMinutes} per day

Return ONLY valid JSON:
{
  "days": [
    {
      "dayNumber": ${startDayNumber},
      "phase": 1,
      "estimatedMinutes": ${newAvailabilityMinutes},
      "tasks": [
        {
          "type": "study",
          "instruction": "Review due flashcards",
          "targetMetric": { "action": "cards_reviewed", "quantity": 10 }
        }
      ]
    }
  ]
}`;
}
