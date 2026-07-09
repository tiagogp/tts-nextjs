"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import type { KokoroModelState } from "@/features/speech/hooks/useKokoroModel";

/**
 * Shared visual indicator for the one-time Kokoro voice-model download. Renders
 * nothing once the model is on disk (`ready === true`) or while the first status
 * check is still in flight (`ready === null`). When the model is missing it shows
 * a download button; once a download is running it shows live progress. Drop it
 * into any flow that needs local audio so the user always sees *why* it's waiting
 * instead of a dead error.
 */
export default function KokoroModelNotice({
  model,
  className = "",
}: {
  model: KokoroModelState;
  className?: string;
}) {
  const { t } = useT();
  if (model.ready !== false) return null;

  const percent = Math.round((model.progress ?? 0) * 100);
  const hasProgress = model.progress !== undefined && model.progress > 0;

  return (
    <div className={cn("space-y-2 rounded-lg border border-line bg-input px-3 py-3 text-xs", className)}>
      <p className="text-ink-muted">
        {t("The local voice model (Kokoro, about 349 MB) needs to be downloaded once before audio can be generated.")}
      </p>
      {model.downloading ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded bg-line">
            <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-ink-muted">
            {hasProgress
              ? t("Downloading voice model… {percent}%", { percent })
              : t("Preparing voice model download…")}
          </p>
        </>
      ) : (
        <Button variant="primary" size="lg" onClick={() => void model.ensure()}>
          {t("Download voice model")}
        </Button>
      )}
      {model.error && <p className="text-danger">{model.error}</p>}
    </div>
  );
}
