"use client";

import { AnimatePresence, m } from "motion/react";
import { BLUR, springSoft, tweenSmooth } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/i18n/I18nProvider";
import {
  cancelPlanGeneration,
  dismissPlanGeneration,
  retryPlanGeneration,
  usePlanGenerationJob,
} from "@/features/plan/generationJob";

/**
 * The only surface a background plan generation gets: progress while it runs,
 * and a way in once it is ready. The learner keeps using the app either way.
 */
export function PlanGenerationToast({ onViewPlan }: { onViewPlan: () => void }) {
  const { t } = useT();
  const job = usePlanGenerationJob();

  return (
    <AnimatePresence>
      {job.status !== "idle" && (
        <m.div
          key="plan-generation-toast"
          className="pointer-events-auto flex max-w-[min(100vw-2rem,26rem)] items-center gap-3 rounded-md border border-line bg-card px-3 py-2 text-sm text-ink shadow-lg"
          initial={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)`, transition: tweenSmooth }}
          transition={springSoft}
          role="status"
          aria-live="polite"
        >
          {job.status === "running" && (
            <>
              <Spinner className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("Building your plan in the background")}</p>
                <p className="text-xs text-ink-muted">
                  {t("Day {done} of {total} — keep using the app.", {
                    done: job.completedDays,
                    total: job.planDays,
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelPlanGeneration}
                aria-label={t("Cancel plan generation")}
              >
                {t("Cancel")}
              </Button>
            </>
          )}

          {job.status === "done" && (
            <>
              <span aria-hidden="true" className="text-base">
                ✅
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t("Your {days}-day plan is ready", { days: job.plan.meta.planDays })}
                </p>
                <p className="text-xs text-ink-muted">{t("Open it whenever you want.")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissPlanGeneration}>
                {t("Later")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  dismissPlanGeneration();
                  onViewPlan();
                }}
              >
                {t("See plan")}
              </Button>
            </>
          )}

          {job.status === "error" && (
            <>
              <span aria-hidden="true" className="text-base">
                ⚠️
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("Couldn't generate the plan. Try again.")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissPlanGeneration}>
                {t("Dismiss")}
              </Button>
              <Button variant="primary" size="sm" onClick={retryPlanGeneration}>
                {t("Try again")}
              </Button>
            </>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
