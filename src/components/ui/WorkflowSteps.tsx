import { cn } from "@/lib/cn";

interface WorkflowStepsProps {
  label: string;
  steps: string[];
  current: number;
}

/** A compact, non-interactive map of a multi-step workflow. */
export function WorkflowSteps({ label, steps, current }: WorkflowStepsProps) {
  return (
    <nav aria-label={label}>
      <ol className="grid rounded-lg border border-line/75 bg-card p-1 shadow-(--shadow-soft)" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const number = index + 1;
          const active = number === current;
          const complete = number < current;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-[11px] font-medium sm:text-xs",
                active ? "bg-accent/10 text-ink" : complete ? "text-ink-soft" : "text-ink-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums",
                  active
                    ? "border-accent bg-accent text-white"
                    : complete
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-line-strong text-ink-muted",
                )}
              >
                {complete ? "✓" : number}
              </span>
              <span className="truncate">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
