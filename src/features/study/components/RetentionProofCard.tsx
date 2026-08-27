"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCards, getProofAttempts, getReviews, saveProofAttempt } from "@/lib/store/repository";
import { useT } from "@/i18n/I18nProvider";
import type { Card as CardModel } from "@/lib/cards/schema";
import type { ProofAttempt } from "@/lib/performance/types";
import { selectProofItems, type ProofCandidate } from "../proofQueue";
import { evaluateRecall, recordedCorrectness } from "../responseEvaluation";
import { LOCAL_JUDGE } from "@/lib/evaluation/judge";

/**
 * Queue C — the retention proof.
 *
 * Deliberately austere: no hint, no reveal before answering, no audio, no grade buttons.
 * The learner is not studying here and there is nothing to self-assess; they answer, the
 * result is recorded, and the card's schedule is untouched.
 *
 * Two things this component must never grow: a call to `saveReview`, and a scaffold. Either
 * one turns the measurement back into a review, and the D7/D30/D60 numbers stop being
 * comparable — which is the whole reason the queue was split out of FSRS.
 */
export function RetentionProofCard({ onCompleted }: { onCompleted?: () => void } = {}) {
  const { t } = useT();
  const responseId = useId();
  const [items, setItems] = useState<{ candidate: ProofCandidate; card: CardModel }[]>([]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [answered, setAnswered] = useState<{ correct?: boolean; expected: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // 0 until the first prompt is shown; reading the clock during render is impure.
  const askedAt = useRef(0);

  const load = useCallback(async () => {
    const [cards, reviews, attempts] = await Promise.all([getCards(), getReviews(), getProofAttempts()]);
    // Acquisition is the learner's first review of the item — the moment it entered memory.
    // Dating the window from here, rather than from the previous review, is what removes
    // the scheduler from the measurement.
    const acquiredAt = new Map<string, number>();
    for (const review of reviews) {
      const existing = acquiredAt.get(review.cardId);
      if (existing === undefined || review.reviewedAt < existing) acquiredAt.set(review.cardId, review.reviewedAt);
    }
    const byId = new Map(cards.map((card) => [card.id, card]));
    const candidates = selectProofItems({ cards, acquiredAt, attempts });
    setItems(candidates.flatMap((candidate) => {
      const card = byId.get(candidate.cardId);
      return card ? [{ candidate, card }] : [];
    }));
    askedAt.current = Date.now();
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run().catch(() => undefined);
  }, [load]);

  const current = items[index];

  const submit = async () => {
    const response = value.trim();
    if (!current || !response || saving || answered) return;
    setSaving(true);
    try {
      const evaluation = evaluateRecall(current.card.back, response, {
        acceptedAnswers: current.card.acceptedAnswers,
        frame: current.card.patternFrame,
      });
      const now = Date.now();
      const attempt: ProofAttempt = {
        id: crypto.randomUUID(),
        cardId: current.card.id,
        targetDays: current.candidate.targetDays,
        ageDays: Math.round(current.candidate.ageDays),
        response,
        // Undefined when the check could not tell a valid paraphrase from a wrong answer.
        // The rate excludes it rather than counting it as a miss.
        correct: recordedCorrectness(evaluation),
        evaluatedBy: "local",
        // Versioned even though it is local: the offline checker changes too, and a D60
        // window that straddles a rewrite compares two instruments, not two months.
        judge: LOCAL_JUDGE,
        patternId: current.card.patternId,
        askedAt: askedAt.current || now,
        answeredAt: now,
      };
      // Note what is *not* here: no saveReview, no SRS update, no activity that feeds the
      // scheduler. Answering this does not change when the card comes back.
      await saveProofAttempt(attempt);
      setAnswered({ correct: attempt.correct, expected: current.card.back });
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    setValue("");
    setAnswered(null);
    askedAt.current = Date.now();
    if (index + 1 >= items.length) onCompleted?.();
    else setIndex(index + 1);
  };

  if (!current) return null;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
          {t("Day {days} check", { days: current.candidate.targetDays })}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {t("{count} left", { count: items.length - index })}
        </span>
      </div>

      <p className="text-xs text-ink-muted">
        {t("This does not change your schedule. Answer from memory or leave it.")}
      </p>

      <p className="text-lg leading-relaxed text-ink">{current.card.front}</p>

      {answered ? (
        <div className="space-y-3">
          <p className="text-base text-ink-soft">{answered.expected}</p>
          <p className={
            answered.correct === true
              ? "text-xs text-success"
              : answered.correct === false
                ? "text-xs text-ink-soft"
                : "text-xs text-ink-muted"
          }>
            {answered.correct === true
              ? t("Held after {days} days.", { days: current.candidate.targetDays })
              : answered.correct === false
                ? t("Not yet — recorded, and your schedule is unchanged.")
                : t("Recorded without a verdict: this one was too open to judge on the device.")}
          </p>
          <Button variant="secondary" size="sm" onClick={advance}>{t("Next")}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="sr-only" htmlFor={responseId}>{t("Your answer")}</label>
          <input
            id={responseId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && value.trim()) void submit(); }}
            autoComplete="off"
            placeholder={t("Type what you would say in English")}
            className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full py-2.5"
            disabled={!value.trim() || saving}
            onClick={() => void submit()}
          >
            {t("Check")}
          </Button>
        </div>
      )}
    </Card>
  );
}
