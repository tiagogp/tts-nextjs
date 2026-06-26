import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import type { PlanGenerationResult, TaskType } from "./schema";
import type { DayStatus } from "./types";

export const PLAN_TASK_TYPES: PlanGenerationResult["days"][number]["tasks"][number]["type"][] = [
  "discover",
  "study",
  "converse",
  "correct",
];

export const PLAN_METRIC_ACTIONS: NonNullable<
  PlanGenerationResult["days"][number]["tasks"][number]["targetMetric"]
>["action"][] = [
  "cards_reviewed",
  "video_processed",
  "conversation_turns",
  "cards_created",
];

export const PLAN_DAYS_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
];

export const AVAILABILITY_OPTIONS = [
  { value: "10", label: "10 min / day" },
  { value: "20", label: "20 min / day" },
  { value: "30", label: "30 min / day" },
  { value: "45", label: "45 min / day" },
  { value: "60", label: "1 hour / day" },
];

export const TARGET_LEVELS: { value: EnglishLevel; label: string }[] =
  ENGLISH_LEVELS.filter((level) => level.value !== "A1");

export const TASK_LABELS: Record<TaskType, string> = {
  discover: "Discover",
  study: "Study",
  converse: "Speak",
  correct: "Correct",
};

export const TASK_COLORS: Record<TaskType, string> = {
  discover: "bg-accent/10 text-accent",
  study: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  converse: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  correct: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const CALENDAR_STATUS_DOT: Record<DayStatus, string> = {
  completed: "bg-emerald-500",
  partial: "bg-amber-400",
  missed: "bg-red-500",
  today: "bg-accent",
  upcoming: "bg-line",
  empty: "",
};

export const CALENDAR_STATUS_RING: Record<DayStatus, string> = {
  completed: "",
  partial: "",
  missed: "",
  today: "ring-2 ring-accent ring-offset-1",
  upcoming: "",
  empty: "",
};
