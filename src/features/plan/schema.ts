import type { EnglishLevel } from "@/features/discover/types";

export type TaskType = "discover" | "study" | "converse" | "correct";

export interface TaskItem {
  id: string;
  type: TaskType;
  instruction: string;
  targetMetric?: {
    action: "cards_reviewed" | "video_processed" | "conversation_turns" | "cards_created";
    quantity: number;
  };
  completedAt?: number;
}

export interface DailyTask {
  /** ISO date string, e.g. "2026-06-24" */
  date: string;
  phase: number;
  tasks: TaskItem[];
  estimatedMinutes: number;
  completedAt?: number;
}

export interface Phase {
  number: number;
  title: string;
  focus: string;
  startDay: number;
  endDay: number;
}

export interface PlanMeta {
  goal: string;
  currentLevel: EnglishLevel;
  targetLevel: EnglishLevel;
  availabilityMinutes: number;
  planDays: number;
  language: string;
}

export interface LearningPlan {
  id: string;
  createdAt: number;
  startsOn: string;
  meta: PlanMeta;
  phases: Phase[];
  days: DailyTask[];
}

export interface EffortSnapshot {
  weekOf: string;
  plannedMinutes: number;
  actualMinutes: number;
  adherenceRate: number;
  streak: number;
}

/** Shape the LLM must return. Validated before saving. */
export interface PlanGenerationResult {
  phases: Array<{
    number: number;
    title: string;
    focus: string;
    startDay: number;
    endDay: number;
  }>;
  days: Array<{
    dayNumber: number;
    phase: number;
    estimatedMinutes: number;
    tasks: Array<{
      type: TaskType;
      instruction: string;
      targetMetric?: {
        action: "cards_reviewed" | "video_processed" | "conversation_turns" | "cards_created";
        quantity: number;
      };
    }>;
  }>;
}
