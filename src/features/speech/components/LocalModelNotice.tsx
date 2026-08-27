"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import type { LocalModelState } from "@/features/speech/hooks/useLocalModel";
import type { LocalModelId } from "@/features/speech/modelStore";

/**
 * In-flow indicator for a one-time local-model download, for screens whose own
 * content depends on that model — Kokoro on anything that speaks, Whisper on
 * anything that listens. Renders nothing once the model is on disk
 * (`ready === true`) or while the first status check is still in flight
 * (`ready === null`). When the model is missing it shows a download button; once
 * a download is running it shows live progress; if the install failed it offers
 * a retry. Drop it into any flow that needs a local model so the user always
 * sees *why* it's waiting instead of a dead error.
 *
 * The app-wide status bar above the tab content is a different component —
 * see `ModelDownloadBar`, which covers both models at once.
 */

interface NoticeCopy {
  waiting: string;
  progress: (percent: number) => string;
  preparing: string;
  progressLabel: string;
  start: string;
}

function useNoticeCopy(id: LocalModelId): NoticeCopy {
  const { t } = useT();
  if (id === "whisper") {
    return {
      waiting: t("Speech recognition (Whisper, about 488 MB) needs to be downloaded once before the app can hear you."),
      progress: (percent) => t("Downloading speech recognition… {percent}%", { percent }),
      preparing: t("Preparing speech-recognition download…"),
      progressLabel: t("Speech-recognition download progress"),
      start: t("Download speech recognition"),
    };
  }
  return {
    waiting: t("The local voice model (Kokoro, about 349 MB) needs to be downloaded once before audio can be generated."),
    progress: (percent) => t("Downloading voice model… {percent}%", { percent }),
    preparing: t("Preparing voice model download…"),
    progressLabel: t("Voice model download progress"),
    start: t("Download voice model"),
  };
}

export default function LocalModelNotice({
  model,
  className = "",
}: {
  model: LocalModelState;
  className?: string;
}) {
  const { t } = useT();
  const copy = useNoticeCopy(model.id);
  if (model.ready !== false) return null;

  const percent = Math.round((model.progress ?? 0) * 100);
  const hasProgress = model.progress !== undefined && model.progress > 0;
  const progressLabel = hasProgress ? copy.progress(percent) : copy.preparing;

  const progressBar = (
    <div
      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-line"
      role="progressbar"
      aria-label={copy.progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hasProgress ? percent : undefined}
    >
      <div
        className={cn(
          "h-full bg-accent transition-[width] duration-500",
          !hasProgress && "w-1/3 animate-pulse",
        )}
        style={hasProgress ? { width: `${percent}%` } : undefined}
      />
    </div>
  );

  return (
    <div
      className={cn("space-y-2 rounded-lg border border-line bg-input px-3 py-3 text-xs", className)}
      aria-live="polite"
    >
      <p className="text-ink-muted">{copy.waiting}</p>
      {model.downloading ? (
        <>
          <div className="flex items-center gap-3">{progressBar}</div>
          <p className="text-ink-muted">
            {progressLabel}
          </p>
        </>
      ) : (
        <Button variant="primary" size="lg" onClick={() => void (model.error ? model.retry() : model.ensure())}>
          {model.error ? t("Try again") : copy.start}
        </Button>
      )}
      {model.error && <p className="text-danger">{model.error}</p>}
    </div>
  );
}
