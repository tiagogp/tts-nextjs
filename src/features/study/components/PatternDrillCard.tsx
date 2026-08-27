"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCards, getProductionAttempts, saveProductionAttempt } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";
import { interpolate } from "@/i18n/translate";
import type { ProductionAttempt } from "@/lib/performance/types";
import { buildPatternDrills, gradeDrill, type PatternDrill } from "../patternDrills";
import { patternProgress, rungFor, type PatternEvidence, type PatternRung } from "../patternLadder";

/**
 * The rung between remembering a sentence and using a structure.
 *
 * What each learner is asked for depends on where they are with *that pattern*, not on how
 * long they have used the app: two unaided retrievals earn a substitution, two distinct
 * substitutions earn a cloze, and so on up to an unscaffolded new situation. See
 * `patternLadder.ts` for why the bar is two and why fillings must differ.
 *
 * Everything is graded on device. A drill that needed a provider would not be part of the
 * method, only a feature of the paid path.
 */
export function PatternDrillCard({ onCompleted }: { onCompleted?: () => void } = {}) {
  const { t } = useT();
  const responseId = useId();
  const [drills, setDrills] = useState<PatternDrill[]>([]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ReturnType<typeof gradeDrill> | null>(null);
  const [saving, setSaving] = useState(false);
  // 0 until the first prompt is shown; reading the clock during render is impure.
  const promptStartedAt = useRef(0);

  const load = useCallback(async () => {
    const [cards, attempts] = await Promise.all([getCards(), getProductionAttempts()]);
    // Rebuild the ladder from the attempt log rather than storing a rung: the evidence is
    // already durable, and a cached rung would drift from the evidence behind it.
    const evidence: PatternEvidence[] = attempts
      .filter((attempt) => attempt.targetPatternId && attempt.stage === "production")
      .map((attempt) => ({
        patternId: attempt.targetPatternId!,
        rung: (attempt.context as PatternRung) ?? "retrieval",
        passed: attempt.taskCompleted === true,
        filling: attempt.text ? attempt.text.split(/\s+/).filter(Boolean) : undefined,
        at: attempt.createdAt,
      }));
    const hasContrast = new Map(cards.map((card) => [card.patternId ?? "", Boolean(card.patternContrast)]));
    const progress = patternProgress(evidence, { hasContrast: (id) => hasContrast.get(id) ?? false });
    setDrills(buildPatternDrills(cards, {
      stageOf: (patternId) => {
        const rung = rungFor(progress, patternId);
        // `retrieval` is the study card's job, and `retired` has left the study queue —
        // neither belongs here, so both fall back to the first drill rung.
        return rung === "retrieval" || rung === "retired" ? "slot_substitution" : rung;
      },
    }));
    promptStartedAt.current = Date.now();
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run().catch(() => undefined);
  }, [load]);

  const drill = drills[index];

  const advance = () => {
    setIndex((current) => (current + 1) % Math.max(1, drills.length));
    setValue("");
    setResult(null);
    promptStartedAt.current = Date.now();
    if (index + 1 >= drills.length) onCompleted?.();
  };

  const submit = async (response: string) => {
    if (!drill || saving || result) return;
    setSaving(true);
    try {
      const graded = gradeDrill(drill, response);
      const now = Date.now();
      const attempt: ProductionAttempt = {
        id: crypto.randomUUID(),
        source: "study",
        stage: "production",
        // The rung is stored in `context` so the ladder can be replayed from the log.
        context: drill.kind,
        prompt: interpolate(drill.prompt, drill.promptVars),
        targetPatternId: drill.patternId,
        text: response,
        spoken: false,
        wordCount: response.split(/\s+/).filter(Boolean).length,
        finished: true,
        issueCount: graded.formIssues.length,
        evaluated: true,
        taskCompleted: graded.passed,
        errorTypesFound: graded.formIssues.map((issue) => issue.type),
        // Only the top rung claims transfer, and only when it was verified.
        newContext: drill.kind === "new_situation" && graded.verified ? graded.transferred : undefined,
        transferVerified: drill.kind === "new_situation" ? graded.verified : undefined,
        scaffoldUsed: drill.kind === "slot_substitution" || drill.kind === "minimal_pair",
        preparationMs: promptStartedAt.current ? Math.max(0, now - promptStartedAt.current) : undefined,
        createdAt: now,
      };
      await saveProductionAttempt(attempt);
      await emitActivity("production_attempt", {
        attemptId: attempt.id,
        source: attempt.source,
        stage: attempt.stage,
        prompt: attempt.prompt,
        text: attempt.text,
        spoken: attempt.spoken,
        wordCount: attempt.wordCount,
        finished: attempt.finished,
        issueCount: attempt.issueCount,
        evaluated: attempt.evaluated,
        newContext: attempt.newContext,
        transferVerified: attempt.transferVerified,
        scaffoldUsed: attempt.scaffoldUsed,
        preparationMs: attempt.preparationMs,
        createdAt: attempt.createdAt,
      });
      setResult(graded);
    } finally {
      setSaving(false);
    }
  };

  if (!drill) return null;

  const feedback = result === null
    ? null
    : result.passed
      ? t("That is the structure carrying new content. That is the whole point.")
      : result.formIssues.length > 0
        ? t(result.formIssues[0].note)
        : !result.frameKept
          ? t("Good English, but use the structure this card practises.")
          : result.verdict === "reused"
            ? t("This is close to the sentence you studied. Say the same kind of thing about something else.")
            : t("Try a different word in the blank — one you have not used here before.");

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
          {DRILL_LABEL[drill.kind] ? t(DRILL_LABEL[drill.kind]) : t("Pattern practice")}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {t("{count} in today's queue", { count: drills.length - index })}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink">{t(drill.prompt, drill.promptVars)}</p>

      {drill.kind === "minimal_pair" ? (
        <div className="space-y-2">
          {drill.options?.map((option) => (
            <Button
              key={option}
              variant={result === null ? "secondary" : option === drill.answer ? "primary" : "secondary"}
              size="lg"
              className="w-full justify-start py-2.5 text-left"
              disabled={result !== null || saving}
              onClick={() => void submit(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="sr-only" htmlFor={responseId}>{t("Your answer")}</label>
          <input
            id={responseId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim()) void submit(value.trim());
            }}
            autoComplete="off"
            disabled={result !== null}
            placeholder={t("Write your sentence in English")}
            className="w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {result === null && (
            <Button
              variant="primary"
              size="lg"
              className="w-full py-2.5"
              disabled={!value.trim() || saving}
              onClick={() => void submit(value.trim())}
            >
              {t("Check")}
            </Button>
          )}
        </div>
      )}

      {feedback && (
        <div className="space-y-3">
          <p className={result?.passed ? "text-xs text-success" : "text-xs text-ink-soft"}>{feedback}</p>
          <Button variant="secondary" size="sm" onClick={advance}>{t("Next")}</Button>
        </div>
      )}
    </Card>
  );
}

const DRILL_LABEL: Record<PatternDrill["kind"], string> = {
  slot_substitution: "Change the blank",
  constrained_cloze: "Complete it about you",
  minimal_pair: "Spot the correct one",
  new_situation: "Use it somewhere new",
};
