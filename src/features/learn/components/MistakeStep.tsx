"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as PanelCard } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import {
  correctSentenceLocally,
  mergeEvaluatedCorrection,
  type LocalCorrectionIssue,
  type LocalCorrectionResult,
} from "@/features/learn/localCorrection";
import { evaluateCorrectionText } from "@/features/correct/api";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { OWN_SENTENCE_CARD_PREFIX, type LessonPhrase } from "@/features/learn/lessonDeck";
import type { Card, ErrorEvent, ErrorType, PhraseCandidate } from "@/lib/cards/schema";
import { saveCorrectionDeck, saveGeneratedDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";

const CATEGORY_LABEL: Record<LocalCorrectionIssue["category"], string> = {
  messageClarity: "Message clarity",
  lessonLanguage: "Lesson language",
  mechanics: "Writing mechanics",
};

/**
 * The production → feedback → retry half of the guided loop. It always has a
 * local check and adds general language feedback when an existing evaluator is
 * available. Saving is gated on a real second response that applies the focused
 * feedback instead of treating a click on “save” as a retry.
 */
export function MistakeStep({
  lessonId,
  phrase,
  productionPrompt,
  retryHint,
  onSaved,
}: {
  lessonId: string;
  phrase: LessonPhrase;
  productionPrompt?: string;
  retryHint?: string;
  onSaved: (hadMistake: boolean) => void;
}) {
  const { t } = useT();
  const { provider, selectedModel, hasEvaluator } = useProviderSelection({
    fallbackToEvaluator: true,
  });
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<LocalCorrectionResult | null>(null);
  const [checkedSentence, setCheckedSentence] = useState("");
  const [retrySentence, setRetrySentence] = useState("");
  const [retryResult, setRetryResult] = useState<LocalCorrectionResult | null>(null);
  const [checkedRetry, setCheckedRetry] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingRetry, setCheckingRetry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const retryLoggedRef = useRef(false);
  const firstAttemptAtRef = useRef(0);

  const evaluateAttempt = async (text: string): Promise<LocalCorrectionResult> => {
    const local = correctSentenceLocally(text, phrase.en, phrase.concept);
    if (!hasEvaluator) return local;
    try {
      const events = await evaluateCorrectionText({
        provider,
        selectedModel,
        text,
        context: "guided-lesson",
      });
      return mergeEvaluatedCorrection(text, phrase.en, phrase.concept, events);
    } catch {
      // Deep feedback is additive. A provider outage must not break the
      // provider-free first lesson or strand a learner before review.
      return local;
    }
  };

  const check = async () => {
    const trimmed = sentence.trim();
    if (!trimmed || checking) return;
    setError(null);
    setCheckedSentence(trimmed);
    setChecking(true);
    setRetrySentence("");
    setRetryResult(null);
    setCheckedRetry("");
    retryLoggedRef.current = false;
    firstAttemptAtRef.current = Date.now();
    if (!submittedRef.current) {
      submittedRef.current = true;
      void emitActivity("mistake_submitted", { source: "lesson", lessonId });
      void emitActivity("method_stage", {
        stage: "feedback",
        area: "readingWriting",
        source: "lesson",
        minutes: 3,
        subjectId: lessonId,
      });
    }
    try {
      setResult(await evaluateAttempt(trimmed));
    } finally {
      setChecking(false);
    }
  };

  const checkRetry = async () => {
    const trimmed = retrySentence.trim();
    if (!trimmed || checkingRetry) return;
    setCheckingRetry(true);
    setError(null);
    setCheckedRetry(trimmed);
    try {
      const next = await evaluateAttempt(trimmed);
      setRetryResult(next);
      if (next.issues.length === 0 && !retryLoggedRef.current) {
        retryLoggedRef.current = true;
        void emitActivity("method_stage", {
          stage: "retry",
          area: "readingWriting",
          source: "lesson",
          minutes: 2,
          subjectId: lessonId,
        });
      }
    } finally {
      setCheckingRetry(false);
    }
  };

  const changedSinceCheck = result !== null && sentence.trim() !== checkedSentence;
  const retryChangedSinceCheck = retryResult !== null && retrySentence.trim() !== checkedRetry;
  const acceptedRetry =
    retryResult && !retryChangedSinceCheck && retryResult.issues.length === 0
      ? retryResult
      : null;

  const save = async () => {
    if (!result || !acceptedRetry || saving) return;
    setSaving(true);
    setError(null);
    try {
      const hadMistake = result.issues.length > 0;
      const id = crypto.randomUUID();
      const now = Date.now();
      const card: Card = {
        id: `${OWN_SENTENCE_CARD_PREFIX}${id}`,
        front: acceptedRetry.corrected,
        back: phrase.pt,
        concept: phrase.concept,
        errorType: hadMistake ? result.issues[0].type : undefined,
        source: { kind: hadMistake ? "error" : "phrase", id },
        createdAt: now,
      };
      if (hadMistake) {
        const event: ErrorEvent = {
          id,
          original: checkedSentence,
          corrected: acceptedRetry.corrected,
          errorTypes: [...new Set<ErrorType>(result.issues.map((issue) => issue.type))],
          sourceLang: "pt",
          targetLang: "en",
          rationale: result.issues.map((issue) => t(issue.note)).join(" "),
          context: "lesson",
          // Keep the error before the successful retry so the method planner does
          // not incorrectly ask for another retry after this loop is complete.
          createdAt: firstAttemptAtRef.current || now,
        };
        await saveCorrectionDeck([card], [event]);
      } else {
        const candidate: PhraseCandidate = {
          id,
          sourceId: `lesson-${lessonId}-own`,
          text: acceptedRetry.corrected,
          translation: phrase.pt,
          status: "accepted",
          createdAt: now,
        };
        await saveGeneratedDeck([card], [candidate]);
      }
      void emitActivity("correction_generated", { cardsCreated: 1, source: "lesson" });
      void emitActivity("cards_created", { count: 1, source: "correct" });
      onSaved(hadMistake);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Could not save your sentence."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard className="space-y-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Your turn")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
          {t("Write one sentence in English")}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {productionPrompt
            ? t(productionPrompt)
            : t('Use "{phrase}" or its reusable pattern, and add one detail of your own.', {
                phrase: phrase.en,
              })}
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={sentence}
          onChange={(event) => setSentence(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
                void check();
            }
          }}
          rows={2}
          placeholder={t("Write your sentence here…")}
          className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          disabled={saving || checking}
        />
        <Button
          variant="primary"
          onClick={() => void check()}
          disabled={!sentence.trim() || saving || checking}
        >
          {checking
            ? t("Checking your sentence…")
            : result && !changedSinceCheck
              ? t("Check again")
              : t("Check my sentence")}
        </Button>
      </div>

      {result && !changedSinceCheck && (
        <div className="space-y-4">
          <FeedbackPanel result={result} original={checkedSentence} />

          <div className="space-y-3 rounded border border-accent/30 bg-accent/5 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.5px] text-accent">
                {t("Apply the feedback")}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{t("Write the sentence again")}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {retryHint
                  ? t(retryHint)
                  : result.issues.length > 0
                    ? t("Use the feedback above in a new attempt. Saving unlocks only after the second attempt is clear.")
                    : t("Your first answer was clear. Produce it once more from memory before saving it.")}
              </p>
            </div>
            <textarea
              value={retrySentence}
              onChange={(event) => setRetrySentence(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void checkRetry();
                }
              }}
              rows={2}
              placeholder={t("Write your second attempt here…")}
              aria-label={t("Second attempt")}
              className="w-full resize-none rounded border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              disabled={saving || checkingRetry}
            />
            <Button
              variant="secondary"
              onClick={() => void checkRetry()}
              disabled={!retrySentence.trim() || saving || checkingRetry}
            >
              {checkingRetry
                ? t("Checking second attempt…")
                : retryResult && !retryChangedSinceCheck
                  ? t("Check second attempt again")
                  : t("Check second attempt")}
            </Button>

            {retryResult && !retryChangedSinceCheck && retryResult.issues.length > 0 && (
              <FeedbackIssues issues={retryResult.issues} />
            )}
            {acceptedRetry && (
              <Notice tone="success" className="space-y-3">
                <p>{t("Your second attempt applies the feedback and is ready for review.")}</p>
                <Button variant="primary" onClick={() => void save()} disabled={saving}>
                  {saving
                    ? t("Saving…")
                    : result.issues.length > 0
                      ? t("Save the improved sentence for tomorrow")
                      : t("Save your sentence for tomorrow")}
                </Button>
              </Notice>
            )}
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </PanelCard>
  );
}

function FeedbackPanel({
  result,
  original,
}: {
  result: LocalCorrectionResult;
  original: string;
}) {
  const { t } = useT();
  if (result.issues.length === 0) {
    return <Notice tone="success">{t("Your message is clear and uses the lesson language.")}</Notice>;
  }

  return (
    <div className="space-y-3 rounded border border-line bg-surface p-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">{t("You wrote")}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{original}</p>
      </div>
      {result.corrected !== original && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.5px] text-accent">{t("Corrected version")}</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{result.corrected}</p>
        </div>
      )}
      <FeedbackIssues issues={result.issues} />
    </div>
  );
}

function FeedbackIssues({ issues }: { issues: LocalCorrectionIssue[] }) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink">
        {t("Focus first: {category}", { category: t(CATEGORY_LABEL[issues[0].category]) })}
      </p>
      <ul className="space-y-2">
        {issues.map((issue) => (
          <li key={`${issue.category}-${issue.note}`} className="flex items-start gap-2 text-xs text-ink-muted">
            <span className="mt-0.5 rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px] text-ink-soft">
              {t(CATEGORY_LABEL[issue.category])}
            </span>
            <span className="pt-0.5">{t(issue.note)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
