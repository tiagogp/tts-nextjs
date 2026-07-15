"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { BLUR, springSoft, tweenSmooth } from "@/lib/motion";
import { useT } from "@/i18n/I18nProvider";
import { errorTypeLabel } from "@/lib/cards/errorTypeLabels";
import KokoroModelNotice from "@/features/speech/components/KokoroModelNotice";
import type { useKokoroModel } from "@/features/speech/hooks/useKokoroModel";
import type { ErrorEvent } from "@/lib/cards/schema";
import { countPolishFeedback, prioritizeFeedback } from "@/features/correct/feedbackContract";

interface CorrectionListProps {
  events: ErrorEvent[];
  generating: boolean;
  genError: string | null;
  genDone: string | null;
  generationStage: string;
  generationSeconds: number;
  providerReady: boolean;
  kokoro: ReturnType<typeof useKokoroModel>;
  onGenerate: () => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
  onOpenSettings?: () => void;
}

export function CorrectionList({
  events,
  generating,
  genError,
  genDone,
  generationStage,
  generationSeconds,
  providerReady,
  kokoro,
  onGenerate,
  onCancel,
  onRemove,
  onOpenSettings,
}: CorrectionListProps) {
  const { t } = useT();
  const timeoutMessage = t("Taking longer than expected. Try fewer corrections or a faster AI.");
  const showSettingsLink = Boolean(genError === timeoutMessage && onOpenSettings);
  const prioritized = prioritizeFeedback(events);
  const [showPolish, setShowPolish] = useState(false);
  const polishCount = countPolishFeedback(prioritized);
  const visible = showPolish ? prioritized : prioritized.filter((issue) => issue.priority !== "polish");

  return (
    <Card className="overflow-hidden">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{t("Corrections to drill")}</p>
          <p className="text-xs text-ink-muted">
            {events.length === 1 ? t("1 correction ready") : t("{count} corrections ready", { count: events.length })}
          </p>
        </div>
        <Button
          variant={generating ? "secondary" : "primary"}
          size="sm"
          className={cn("shrink-0", generating && "border-danger text-danger")}
          onClick={generating ? onCancel : onGenerate}
          disabled={!generating && !providerReady}
        >
          {generating ? (
            <>
              <span aria-hidden="true">×</span>
              {t("Cancel")}
            </>
          ) : (
            t("Save to study →")
          )}
        </Button>
      </div>

      {generating && (
        <motion.div
          className="border-b border-line bg-accent/4 px-5 py-3"
          initial={{ opacity: 0, height: 0, filter: `blur(${BLUR}px)` }}
          animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
          transition={springSoft}
          style={{ overflow: "hidden" }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-soft">{generationStage}</span>
            <span className="tabular-nums text-ink-muted">{generationSeconds}s</span>
          </div>
          <div className="generation-track" aria-hidden="true">
            <span className="generation-bar" />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-muted">
            {t("Larger study lists can take a little longer while audio is created. You can cancel safely.")}
          </p>
        </motion.div>
      )}

      {(genError || genDone) && (
        <div className={cn("border-b border-line px-5 py-2.5 text-xs", genError ? "bg-danger/8 text-danger" : "text-ink-soft")}>
          {genError ?? genDone}
          {showSettingsLink && (
            <>
              {" "}
              <button type="button" onClick={onOpenSettings} className="font-medium underline hover:no-underline">
                {t("Open Settings →")}
              </button>
            </>
          )}
        </div>
      )}

      {kokoro.ready === false && (
        <div className="border-b border-line px-5 py-3">
          <KokoroModelNotice model={kokoro} />
        </div>
      )}

      <ul className="max-h-[28rem] overflow-y-auto">
        <AnimatePresence initial={false}>
          {visible.map((issue) => (
            <motion.li
              key={issue.event.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: springSoft }}
              exit={{ opacity: 0, height: 0, transition: tweenSmooth }}
              className="flex items-start gap-3 overflow-hidden border-b border-line px-5 py-3 transition-colors hover:bg-accent/3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-relaxed text-ink-muted line-through">{issue.event.original}</p>
                <p className="text-sm font-medium leading-relaxed text-ink">{issue.event.corrected}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="rounded border border-accent/30 px-1.5 py-0.5 text-xs text-accent">{issue.priority}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted">{issue.category}</span>
                  {issue.event.errorTypes.map((type) => (
                    <span key={type} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted">
                      {t(errorTypeLabel(type))}
                    </span>
                  ))}
                  {issue.evidence && <span className="text-xs text-ink-muted">{issue.evidence}</span>}
                </div>
                <p className="text-[11px] text-ink-muted">{issue.suggestedRetrySupport}</p>
              </div>
              <Chip
                className="mt-0.5 shrink-0"
                disabled={generating}
                aria-label={t("Remove correction")}
                onClick={() => onRemove(issue.event.id)}
              >
                {t("Remove")}
              </Chip>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {polishCount > 0 && (
        <div className="border-t border-line px-5 py-2.5">
          <button
            type="button"
            className="text-xs text-ink-muted underline hover:no-underline"
            onClick={() => setShowPolish((value) => !value)}
          >
            {showPolish ? t("Hide {count} minor polish issue(s)") : t("Show {count} minor polish issue(s)")}
          </button>
        </div>
      )}
    </Card>
  );
}
