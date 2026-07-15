import { targetForProfile, type MethodArea } from "@/features/method/learningLoop";
import type { MethodObjective } from "@/features/settings/learningProfile";
import type { PlanGenerationResult, TaskType } from "./schema";

const TASK_AREA: Record<TaskType, MethodArea> = {
  lesson: "structured",
  study: "structured",
  discover: "listening",
  converse: "speaking",
  correct: "readingWriting",
  readWrite: "readingWriting",
};

const TASK_COPY: Record<TaskType, string> = {
  lesson: "Complete a structured lesson and keep useful language",
  study: "Retrieve due phrases with active recall",
  discover: "Listen to a short real-English source and notice one phrase",
  converse: "Speak from day one in a simple familiar situation",
  correct: "Write a short answer and retry the most important correction",
  readWrite: "Read for meaning, then write a short transfer message",
};

function task(type: TaskType, day = 1): PlanGenerationResult["days"][number]["tasks"][number] {
  const targetMetric = type === "study"
    ? { action: "cards_reviewed", quantity: 5 }
    : type === "discover"
      ? { action: "video_processed", quantity: 1 }
      : type === "converse"
        ? { action: "minutes_spoken", quantity: 5 }
        : type === "correct"
          ? { action: "retry_resolution", quantity: 1 }
          : type === "readWrite"
            ? { action: day % 4 < 2 ? "reading_comprehension" : "writing_production", quantity: 1 }
          : undefined;
  const instruction = type === "readWrite"
    ? day % 4 >= 2
      ? "Write a new professional or academic message, then revise one important issue"
      : "Read a professional or academic passage for meaning before explaining it"
    : TASK_COPY[type];
  return { type, instruction, ...(targetMetric ? { targetMetric } : {}) };
}

const AREA_TASKS: Record<MethodArea, TaskType[]> = {
  structured: ["study", "lesson"],
  listening: ["discover"],
  speaking: ["converse"],
  readingWriting: ["readWrite", "correct"],
};

function taskForArea(area: MethodArea, day: number): TaskType {
  const options = AREA_TASKS[area];
  return options[(day - 1) % options.length];
}

/** Largest-deficit scheduling gives the plan an actual distribution over its days. */
function nextArea(
  target: ReturnType<typeof targetForProfile>,
  counts: Record<MethodArea, number>,
): MethodArea {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (Object.keys(target) as MethodArea[]).sort((left, right) => {
    const leftNeed = target[left] * (total + 1) - counts[left];
    const rightNeed = target[right] * (total + 1) - counts[right];
    return rightNeed - leftNeed;
  })[0];
}

/** Add objective-specific composition while preserving authored instructions and lessons. */
export function applyObjectiveDistribution(
  result: PlanGenerationResult,
  objective: MethodObjective,
): PlanGenerationResult {
  const target = targetForProfile({ objective });
  const counts: Record<MethodArea, number> = {
    structured: 0,
    listening: 0,
    speaking: 0,
    readingWriting: 0,
  };
  return {
    ...result,
    days: result.days.map((day) => {
      const tasks = [...day.tasks];
      const ensure = (type: TaskType) => {
        if (tasks.some((item) => item.type === type)) return;
        if (tasks.length < 3) tasks.push(task(type, day.dayNumber));
        else tasks[tasks.length - 1] = task(type, day.dayNumber);
      };
      if (day.dayNumber === 1) {
        ensure("lesson");
        ensure("converse");
      } else {
        ensure(taskForArea(nextArea(target, counts), day.dayNumber));
      }
      for (const item of tasks) counts[TASK_AREA[item.type]] += 1;
      return { ...day, tasks };
    }),
  };
}

export function taskArea(type: TaskType): MethodArea {
  return TASK_AREA[type];
}

export function countTaskAreas(result: PlanGenerationResult): Record<MethodArea, number> {
  const counts: Record<MethodArea, number> = { structured: 0, listening: 0, speaking: 0, readingWriting: 0 };
  for (const day of result.days) for (const item of day.tasks) counts[TASK_AREA[item.type]] += 1;
  return counts;
}
