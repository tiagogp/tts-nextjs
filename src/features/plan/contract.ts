import { PLAN_METRIC_ACTIONS, PLAN_TASK_TYPES } from "./constants";
import type { PlanGenerationResult } from "./schema";

type GeneratedTask = PlanGenerationResult["days"][number]["tasks"][number];
type GeneratedDay = PlanGenerationResult["days"][number];

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(first, last + 1));
}

function validateTask(raw: unknown): GeneratedTask | null {
  if (!raw || typeof raw !== "object") return null;
  const task = raw as Record<string, unknown>;
  if (!PLAN_TASK_TYPES.includes(task.type as GeneratedTask["type"])) return null;
  if (typeof task.instruction !== "string") return null;

  let targetMetric: GeneratedTask["targetMetric"];
  if (task.targetMetric && typeof task.targetMetric === "object") {
    const metric = task.targetMetric as Record<string, unknown>;
    if (typeof metric.action === "string" && PLAN_METRIC_ACTIONS.includes(metric.action as typeof PLAN_METRIC_ACTIONS[number]) && typeof metric.quantity === "number" && Number.isFinite(metric.quantity) && metric.quantity > 0) {
      targetMetric = {
        action: metric.action,
        quantity: metric.quantity,
      };
    }
  }

  return {
    type: task.type as GeneratedTask["type"],
    instruction: task.instruction.slice(0, 120),
    ...(typeof task.lessonId === "string" ? { lessonId: task.lessonId.slice(0, 80) } : {}),
    ...(targetMetric ? { targetMetric } : {}),
  };
}

export function validateGeneratedDays(raw: unknown): GeneratedDay[] | null {
  if (!Array.isArray(raw)) return null;

  const days = raw.map((d: unknown) => {
    if (!d || typeof d !== "object") return null;
    const day = d as Record<string, unknown>;
    if (
      typeof day.dayNumber !== "number" ||
      typeof day.phase !== "number" ||
      typeof day.estimatedMinutes !== "number" ||
      !Array.isArray(day.tasks)
    ) {
      return null;
    }

    const tasks = day.tasks.map(validateTask);
    if (tasks.some((task) => task === null)) return null;

    return {
      dayNumber: day.dayNumber,
      phase: day.phase,
      estimatedMinutes: day.estimatedMinutes,
      tasks: tasks as GeneratedTask[],
    };
  });

  if (days.some((day) => day === null)) return null;
  return days as GeneratedDay[];
}

export function validatePlanResult(raw: unknown): PlanGenerationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.phases)) return null;

  const phases = obj.phases.map((p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const phase = p as Record<string, unknown>;
    if (
      typeof phase.number !== "number" ||
      typeof phase.title !== "string" ||
      typeof phase.focus !== "string" ||
      typeof phase.startDay !== "number" ||
      typeof phase.endDay !== "number"
    ) {
      return null;
    }
    return {
      number: phase.number,
      title: phase.title.slice(0, 100),
      focus: phase.focus.slice(0, 200),
      startDay: phase.startDay,
      endDay: phase.endDay,
    };
  });
  if (phases.some((phase) => phase === null)) return null;

  const days = validateGeneratedDays(obj.days);
  if (!days) return null;

  return {
    phases: phases as PlanGenerationResult["phases"],
    days,
  };
}
