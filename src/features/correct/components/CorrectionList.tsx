"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { BLUR, springSoft, tweenSmooth } from "@/lib/motion";
import KokoroModelNotice from "@/features/speech/components/KokoroModelNotice";
import type { useKokoroModel } from "@/features/speech/hooks/useKokoroModel";
import type { ErrorEvent } from "@/lib/cards/schema";

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
  const showSettingsLink = Boolean(genError?.toLowerCase().includes("faster ai") && onOpenSettings);

  return (
    <Card className="overflow-hidden">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">Corrections to drill</p>
          <p className="text-xs text-ink-muted">
            {events.length} correction{events.length === 1 ? "" : "s"} ready
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
              Cancel
            </>
          ) : (
            "Save to study →"
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
            Larger study lists can take a little longer while audio is created. You can cancel safely.
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
                Open Settings →
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
          {events.map((event) => (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: springSoft }}
              exit={{ opacity: 0, height: 0, transition: tweenSmooth }}
              className="flex items-start gap-3 overflow-hidden border-b border-line px-5 py-3 transition-colors hover:bg-accent/3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-relaxed text-ink-muted line-through">{event.original}</p>
                <p className="text-sm font-medium leading-relaxed text-ink">{event.corrected}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {event.errorTypes.map((type) => (
                    <span key={type} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted">
                      {type}
                    </span>
                  ))}
                  {event.rationale && <span className="text-xs text-ink-muted">{event.rationale}</span>}
                </div>
              </div>
              <Chip
                className="mt-0.5 shrink-0"
                disabled={generating}
                aria-label="Remove correction"
                onClick={() => onRemove(event.id)}
              >
                Remove
              </Chip>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
