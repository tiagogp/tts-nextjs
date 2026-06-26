import { TASK_COLORS, TASK_LABELS } from "../constants";
import type { PlanTaskRowProps } from "../types";

export function PlanTaskRow({
  task,
  onGo,
  onComplete,
  hideGoAction = false,
  completeButtonLabel = {
    done: "Mark as not done",
    pending: "Mark as done",
  },
}: PlanTaskRowProps) {
  const done = task.completedAt != null;

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        done ? "border-line bg-surface opacity-60" : "border-line bg-canvas"
      }`}
    >
      <button
        type="button"
        aria-label={done ? completeButtonLabel.done : completeButtonLabel.pending}
        onClick={onComplete}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-line hover:border-accent"
        }`}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M1 4l3 3 5-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            TASK_COLORS[task.type]
          }`}
        >
          {TASK_LABELS[task.type]}
        </span>
        <p className={`truncate text-xs ${done ? "line-through text-ink-muted" : "text-ink-soft"}`}>
          {task.instruction}
        </p>
      </div>

      {!done && !hideGoAction && onGo && (
        <button
          type="button"
          onClick={onGo}
          className="shrink-0 text-xs font-medium text-accent transition-opacity hover:opacity-70"
        >
          Go &rarr;
        </button>
      )}
    </li>
  );
}
