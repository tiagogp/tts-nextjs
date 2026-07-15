"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import type { ErrorEvent } from "@/lib/cards/schema";
import { focusFeedback, prioritizeFeedback } from "@/features/correct/feedbackContract";
import { useT } from "@/i18n/I18nProvider";

interface RetryStepProps {
  /** The mistakes the evaluator just found — the language to apply in the second attempt. */
  corrections: ErrorEvent[];
  value: string;
  onChange: (value: string) => void;
  checking: boolean;
  /** Set once the second attempt comes back with no mistakes. */
  clear: boolean;
  note: string | null;
  onCheck: () => void;
  checkDisabled?: boolean;
  onDefer?: () => void;
  onDismiss?: () => void;
}

/**
 * Stage 7 — Try Again. The method treats feedback as unfinished until the learner
 * produces the idea a second time, so a correction here is never a dead end: the
 * `retry` stage is only credited when the rewrite comes back clean.
 */
export function RetryStep({
  corrections,
  value,
  onChange,
  checking,
  clear,
  note,
  onCheck,
  checkDisabled = false,
  onDefer,
  onDismiss,
}: RetryStepProps) {
  const { t } = useT();
  const focused = focusFeedback(prioritizeFeedback(corrections));

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Try again")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
          {t("Write it again, using the correction")}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {t("Feedback sticks when you use it immediately. Say the same idea, the clearer way.")}
        </p>
      </div>

      <ul className="space-y-1.5">
        {focused.map(({ event: correction }) => (
          <li key={correction.id} className="text-sm">
            <span className="text-ink-muted line-through">{correction.original}</span>
            <span className="mx-2 text-ink-muted">→</span>
            <span className="font-medium text-ink">{correction.corrected}</span>
          </li>
        ))}
      </ul>
      {corrections.length > focused.length && (
        <p className="text-xs text-ink-muted">
          {t("{count} minor issue(s) are not blocking this retry.", { count: corrections.length - focused.length })}
        </p>
      )}

      {clear ? (
        <p className="text-sm font-medium text-accent">
          {t("That's clear now. Saved for tomorrow's practice.")}
        </p>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={2}
            placeholder={t("Write your second attempt here…")}
            disabled={checking}
          />
          {note ? <p className="text-sm text-ink-soft">{note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={onCheck}
              disabled={checking || checkDisabled || value.trim().length === 0}
            >
              {checking ? <Spinner /> : null}
              {checking ? t("Checking…") : t("Check my second attempt")}
            </Button>
            {onDefer && (
              <Button type="button" variant="ghost" onClick={onDefer} disabled={checking}>
                {t("Defer for review")}
              </Button>
            )}
            {onDismiss && (
              <Button type="button" variant="ghost" onClick={onDismiss} disabled={checking}>
                {t("Dismiss this retry")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
