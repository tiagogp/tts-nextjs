import type { DailyTask, TaskItem, TaskType } from "./schema";

export type PlanOnboardingStep = "goal" | "availability" | "generating";

export interface PlanNavigationHandlers {
  onDiscover?: () => void;
  onStudy?: () => void;
  onConverse?: () => void;
  onCorrect?: () => void;
  onLesson?: (lessonId?: string) => void;
}

export type PlanTaskActionMap = Record<TaskType, (() => void) | undefined>;

export interface PlanTaskRowProps {
  task: TaskItem;
  onComplete: () => void;
  onGo?: () => void;
  hideGoAction?: boolean;
  /** Marks the task the method recommends doing next — at most one per list. */
  highlight?: boolean;
  completeButtonLabel?: {
    done: string;
    pending: string;
  };
}

export type DayStatus =
  | "completed"
  | "partial"
  | "missed"
  | "today"
  | "upcoming"
  | "empty";

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  status: DayStatus;
  planDay: DailyTask | null;
}
