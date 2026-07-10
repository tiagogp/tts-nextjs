"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as PanelCard } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { correctSentenceLocally, type LocalCorrectionResult } from "@/features/learn/localCorrection";
import { OWN_SENTENCE_CARD_PREFIX, type LessonPhrase } from "@/features/learn/lessonDeck";
import type { Card, ErrorEvent, ErrorType, PhraseCandidate } from "@/lib/cards/schema";
import { saveCorrectionDeck, saveGeneratedDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";

/**
 * The "write one sentence" half of the first loop. Fully local: the learner uses
 * the lesson phrase in their own sentence, gets a deterministic correction (see
 * localCorrection.ts) and saves it as tomorrow's review card — no AI provider,
 * so the W5 loop can complete on a clean install.
 */
export function MistakeStep({
  lessonId,
  phrase,
  onSaved,
}: {
  lessonId: string;
  phrase: LessonPhrase;
  onSaved: (hadMistake: boolean) => void;
}) {
  const { t } = useT();
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<LocalCorrectionResult | null>(null);
  const [checkedSentence, setCheckedSentence] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const check = () => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    setError(null);
    setCheckedSentence(trimmed);
    setResult(correctSentenceLocally(trimmed, phrase.en));
    if (!submittedRef.current) {
      submittedRef.current = true;
      void emitActivity("mistake_submitted", { source: "lesson", lessonId });
    }
  };

  const save = async () => {
    if (!result || saving) return;
    setSaving(true);
    setError(null);
    try {
      const hadMistake = result.issues.length > 0;
      const id = crypto.randomUUID();
      const now = Date.now();
      const card: Card = {
        id: `${OWN_SENTENCE_CARD_PREFIX}${id}`,
        front: result.corrected,
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
          corrected: result.corrected,
          errorTypes: [...new Set<ErrorType>(result.issues.map((issue) => issue.type))],
          sourceLang: "pt",
          targetLang: "en",
          rationale: result.issues.map((issue) => t(issue.note)).join(" "),
          context: "lesson",
          createdAt: now,
        };
        await saveCorrectionDeck([card], [event]);
      } else {
        const candidate: PhraseCandidate = {
          id,
          sourceId: `lesson-${lessonId}-own`,
          text: result.corrected,
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

  const changedSinceCheck = result !== null && sentence.trim() !== checkedSentence;

  return (
    <PanelCard className="space-y-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.7px] text-accent">{t("Your turn")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">
          {t("Write one sentence in English")}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {t('Use "{phrase}" in your own sentence. You will practice the corrected version tomorrow.', {
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
              check();
            }
          }}
          rows={2}
          placeholder={t("Write your sentence here…")}
          className="w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          disabled={saving}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={check} disabled={!sentence.trim() || saving}>
            {result && !changedSinceCheck ? t("Check again") : t("Check my sentence")}
          </Button>
        </div>
      </div>

      {result && !changedSinceCheck && (
        <div className="space-y-3">
          {result.issues.length === 0 ? (
            <Notice tone="success">{t("Nothing to fix — nice work.")}</Notice>
          ) : (
            <div className="space-y-2 rounded border border-line bg-surface p-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.5px] text-ink-muted">{t("You wrote")}</p>
                <p className="mt-0.5 text-sm text-ink-soft line-through decoration-ink-muted/50">
                  {checkedSentence}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.5px] text-accent">{t("Corrected version")}</p>
                <p className="mt-0.5 text-sm font-medium text-ink">{result.corrected}</p>
              </div>
              <ul className="space-y-1 pt-1">
                {result.issues.map((issue) => (
                  <li key={issue.note} className="text-xs text-ink-muted">
                    • {t(issue.note)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!result.usedPhrase && (
            <p className="text-xs text-ink-muted">
              {t('Tip: try using "{phrase}" in your sentence.', { phrase: phrase.en })}
            </p>
          )}

          <Button variant="secondary" onClick={() => void save()} disabled={saving}>
            {saving
              ? t("Saving…")
              : result.issues.length > 0
                ? t("Save the correction for tomorrow")
                : t("Save your sentence for tomorrow")}
          </Button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </PanelCard>
  );
}
