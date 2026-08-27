"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { tweenSmooth } from "@/lib/motion";
import { useT } from "@/i18n/I18nProvider";
import { useKokoroModel, useWhisperModel, type LocalModelState } from "@/features/speech/hooks/useLocalModel";

/**
 * The app-wide bar for the one-time local-model downloads (Kokoro for voice,
 * Whisper for listening). It lives above the tab content so whichever tab the
 * learner is on, they can see a ~349–488 MB download is still running — and, if
 * it failed, retry from where they already are.
 *
 * Both models can be downloading at once, so this renders one row per model
 * rather than a single ambiguous bar.
 */

/**
 * How long a finished row stays on screen at 100%. Without it the bar blinks
 * out mid-progress and the download reads as cancelled rather than done.
 */
const DONE_HOLD_MS = 1_800;

interface RowCopy {
  /** The model's own name — short enough to keep the row single-line. */
  name: string;
  waiting: string;
  failed: string;
  done: string;
  start: string;
  progressLabel: string;
}

function useRowCopy(): Record<"kokoro" | "whisper", RowCopy> {
  const { t } = useT();
  return {
    kokoro: {
      name: "Kokoro",
      waiting: t("The local voice model (Kokoro, about 349 MB) needs to be downloaded once before audio can be generated."),
      failed: t("The voice-model download failed. Audio stays unavailable until it finishes."),
      done: t("Voice ready."),
      start: t("Download voice model"),
      progressLabel: t("Voice model download progress"),
    },
    whisper: {
      name: "Whisper",
      waiting: t("Speech recognition (Whisper, about 488 MB) is being downloaded once so the app can hear you."),
      failed: t("The speech-recognition download failed. Speaking practice stays unavailable until it finishes."),
      done: t("Speech recognition ready."),
      start: t("Download speech recognition"),
      progressLabel: t("Speech-recognition download progress"),
    },
  };
}

/**
 * Whether a model's row belongs on screen, and whether it is showing its
 * closing "done" beat. `done` outlives the download by `DONE_HOLD_MS` so the
 * bar can finish its progress and animate away instead of vanishing.
 */
function useRowVisibility(model: LocalModelState): { visible: boolean; done: boolean } {
  const active = model.ready === false && (model.downloading || model.error !== null);
  const [seen, setSeen] = useState({ active, done: false });

  if (seen.active !== active) {
    // The render where a row stops being active is the only moment we can tell
    // a download that just *finished* from one that was never running — so the
    // closing beat is derived here (React's adjust-state-on-change pattern)
    // rather than in an effect. A model already on disk at boot never had an
    // active row, so it can never flash a false "ready".
    setSeen({ active, done: !active && model.ready === true });
  }

  const done = seen.done && model.ready === true;

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setSeen((prev) => ({ ...prev, done: false })), DONE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [done]);

  return { visible: active || done, done };
}

function ModelRow({
  model,
  copy,
  done,
}: {
  model: LocalModelState;
  copy: RowCopy;
  done: boolean;
}) {
  const { t } = useT();
  const percent = done ? 100 : Math.round((model.progress ?? 0) * 100);
  const hasProgress = done || (model.progress !== undefined && model.progress > 0);
  const showBar = done || model.downloading;

  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={
        done
          ? copy.done
          : model.downloading
            ? hasProgress
              ? t("Downloading {model}… {percent}%", { model: copy.name, percent })
              : copy.waiting
            : undefined
      }
    >
      <p className="shrink-0 text-xs font-medium text-ink">{copy.name}</p>
      {showBar ? (
        <>
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-line"
            role="progressbar"
            aria-label={copy.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasProgress ? percent : undefined}
          >
            <m.div
              className={cn(
                "h-full rounded",
                done ? "bg-success" : "bg-accent",
                !hasProgress && "w-1/3 animate-pulse",
              )}
              // Animating width (rather than a CSS transition) keeps the final
              // sprint to 100% smooth even when the last poll jumps several
              // percent at once.
              animate={hasProgress ? { width: `${percent}%` } : undefined}
              transition={tweenSmooth}
            />
          </div>
          <p
            className={cn(
              "shrink-0 text-xs tabular-nums",
              done ? "font-medium text-success" : "text-ink-muted",
            )}
          >
            {done ? copy.done : hasProgress ? `${percent}%` : t("Preparing…")}
          </p>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
            {model.error ? copy.failed : copy.waiting}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => void (model.error ? model.retry() : model.ensure())}
          >
            {model.error ? t("Try again") : copy.start}
          </Button>
        </>
      )}
    </div>
  );
}

export default function ModelDownloadBar({ className = "" }: { className?: string }) {
  const copy = useRowCopy();
  const kokoro = useKokoroModel();
  const whisper = useWhisperModel();
  const kokoroRow = useRowVisibility(kokoro);
  const whisperRow = useRowVisibility(whisper);

  const rows = [
    { model: kokoro, copy: copy.kokoro, ...kokoroRow },
    { model: whisper, copy: copy.whisper, ...whisperRow },
  ].filter((row) => row.visible);

  return (
    <AnimatePresence initial={false}>
      {rows.length > 0 && (
        <m.div
          key="model-downloads"
          className={cn(
            "shrink-0 overflow-hidden border-b border-line bg-input shadow-sm",
            className,
          )}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={tweenSmooth}
        >
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-2.5">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <m.div
                  key={row.model.id}
                  className="overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={tweenSmooth}
                >
                  <ModelRow model={row.model} copy={row.copy} done={row.done} />
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
