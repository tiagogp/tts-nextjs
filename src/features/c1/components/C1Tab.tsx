"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import Disclosure from "@/components/ui/Disclosure";
import ProviderBadge from "@/components/ui/ProviderBadge";
import { useT } from "@/i18n/I18nProvider";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { reviewAdvancedText } from "@/features/correct/api";
import { PronunciationCoach } from "@/features/pronunciation/components/PronunciationCoach";
import { getLearningProfile, saveLearningProfile } from "@/features/settings/learningProfile";
import { getC1Diagnoses, getReviews, saveC1Diagnosis } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { computePerformance } from "@/lib/srs/analytics";
import { groupRefinementsByDimension, type RegisterGap } from "@/features/c1/model";
import type { C1Diagnosis } from "@/features/c1/types";
import {
  MAX_DOMAIN_CHARS,
  MAX_GRAMMAR_GAPS_SHOWN,
  MAX_SAMPLE_CHARS,
  MIN_REVIEWS_FOR_GRAMMAR_GAP,
  MIN_SAMPLE_CHARS,
} from "@/features/c1/constants";

interface GrammarGap {
  type: string;
  reviews: number;
  accuracy: number;
}

interface FlaggedItem {
  id: string;
  original: string;
  corrected: string;
  rationale?: string;
}

/**
 * Experimental, pre-W5 exception (docs/c1-phase-proposal.md): diagnosis using the existing
 * `errorTypes` signal + one short writing-sample check, one domain, one
 * write -> feedback -> speak loop. Reached only from Settings, not part of the tested
 * first-loop.
 */
export default function C1Tab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { t } = useT();
  const [domain, setDomain] = useState(() => getLearningProfile().c1Domain);
  const [domainDraft, setDomainDraft] = useState("");
  const [editingDomain, setEditingDomain] = useState(false);

  const [grammarGaps, setGrammarGaps] = useState<GrammarGap[]>([]);
  const [registerGaps, setRegisterGaps] = useState<RegisterGap[]>([]);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(true);

  const [sampleText, setSampleText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<C1Diagnosis | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, hasEvaluator, selectedModel } = selection;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [reviews, diagnoses] = await Promise.all([getReviews(), getC1Diagnoses()]);
        if (cancelled) return;
        const stats = computePerformance(reviews);
        setGrammarGaps(
          stats.errorTypes
            .filter((e) => e.reviews >= MIN_REVIEWS_FOR_GRAMMAR_GAP)
            .slice(0, MAX_GRAMMAR_GAPS_SHOWN)
            .map((e) => ({ type: e.type, reviews: e.reviews, accuracy: e.accuracy })),
        );
        setRegisterGaps(groupRefinementsByDimension(diagnoses[0]?.refinements ?? []));
      } finally {
        if (!cancelled) setLoadingDiagnosis(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveDomain = () => {
    const trimmed = domainDraft.trim().slice(0, MAX_DOMAIN_CHARS);
    if (!trimmed) return;
    saveLearningProfile({ c1Domain: trimmed });
    setDomain(trimmed);
    setEditingDomain(false);
  };

  const submitSample = useCallback(async () => {
    const text = sampleText.trim();
    if (text.length < MIN_SAMPLE_CHARS || reviewing || !hasEvaluator) return;
    setReviewing(true);
    setNote(null);
    try {
      const review = await reviewAdvancedText({
        provider,
        selectedModel,
        text,
        context: domain || undefined,
        level: "C1",
      });
      if (review.errors.length === 0 && review.refinements.length === 0) {
        setNote(t("No gaps found in this sample — try a longer or more ambitious one."));
        setResult(null);
        return;
      }
      const diagnosis: C1Diagnosis = {
        id: crypto.randomUUID(),
        domain,
        sampleText: text,
        errors: review.errors,
        refinements: review.refinements,
        createdAt: Date.now(),
      };
      await saveC1Diagnosis(diagnosis);
      void emitActivity("c1_diagnosis_completed", {
        domain,
        errorsFound: review.errors.length,
        dimensionsFlagged: new Set(review.refinements.map((r) => r.dimension)).size,
      });
      setResult(diagnosis);
      setRegisterGaps(groupRefinementsByDimension(review.refinements));
      setSampleText("");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : t("Couldn't check that sample."));
    } finally {
      setReviewing(false);
    }
  }, [domain, hasEvaluator, provider, reviewing, sampleText, selectedModel, t]);

  const evaluatorHint = !hasEvaluator
    ? t("{provider} is unavailable. Open Settings to connect one.", {
        provider: activeProvider?.label ?? "AI",
      })
    : null;

  const flaggedItems: FlaggedItem[] = result
    ? [
        ...result.errors.map((e) => ({ id: e.id, original: e.original, corrected: e.corrected, rationale: e.rationale })),
        ...result.refinements.map((r) => ({ id: r.id, original: r.original, corrected: r.suggested, rationale: r.rationale })),
      ]
    : [];

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">
            {t("C1 diagnosis")}{" "}
            <span className="ml-1 rounded border border-line px-1.5 py-0.5 text-[0.65rem] font-normal text-ink-muted">
              {t("Experimental")}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t(
              "Past B1/B2, grammar stops being the gap — register, naturalness, and collocation take over. This checks a short writing sample for that gap and lets you practice speaking the fix.",
            )}
          </p>
        </div>

        {domain && !editingDomain ? (
          <p className="text-xs text-ink-muted">
            {t("Domain: {domain}", { domain })}{" "}
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => {
                setDomainDraft(domain);
                setEditingDomain(true);
              }}
            >
              {t("Edit")}
            </button>
          </p>
        ) : (
          <div className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink">{t("What's this for?")}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t(
                "Work, university, immigration — one domain, picked once. Steers the feedback toward language you'll actually use.",
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                value={domainDraft}
                onChange={(event) => setDomainDraft(event.target.value)}
                placeholder={t("e.g. work")}
                maxLength={MAX_DOMAIN_CHARS}
              />
              <Button variant="primary" onClick={saveDomain} disabled={!domainDraft.trim()}>
                {t("Save")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {!loadingDiagnosis && (grammarGaps.length > 0 || registerGaps.length > 0) && (
        <Card className="space-y-4 p-5">
          <p className="text-sm font-medium text-ink">{t("Where you're stuck")}</p>
          {grammarGaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.7px] text-ink-muted">{t("Grammar")}</p>
              <ul className="space-y-1">
                {grammarGaps.map((gap) => (
                  <li key={gap.type} className="flex items-center justify-between text-sm text-ink-soft">
                    <span>{gap.type}</span>
                    <span className="tabular-nums text-xs text-ink-muted">
                      {Math.round(gap.accuracy * 100)}% · {gap.reviews} {t("reviews")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {registerGaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.7px] text-ink-muted">
                {t("Register, naturalness, collocation")}
              </p>
              <ul className="space-y-2">
                {registerGaps.map((gap) => (
                  <li key={gap.dimension} className="rounded-md border border-line bg-surface px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink">{gap.dimension}</span>
                      <span className="text-xs text-ink-muted">{gap.count}×</span>
                    </div>
                    {gap.examples.map((example) => (
                      <p key={example.id} className="mt-1 text-xs text-ink-muted">
                        <span className="line-through">{example.original}</span> → {example.suggested}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <Field
          label={t("Write a short C1-level sample")}
          hint={t(
            "A paragraph or two in your domain. This checks for what a native speaker would phrase differently.",
          )}
        >
          <Textarea
            value={sampleText}
            onChange={(event) => setSampleText(event.target.value)}
            rows={6}
            maxLength={MAX_SAMPLE_CHARS}
            disabled={reviewing}
            className="px-4 py-3 leading-relaxed"
            placeholder={t("Write about {domain}…", { domain: domain || t("your domain") })}
          />
        </Field>
        {note && (
          <p className="text-xs text-danger" role="status" aria-live="polite">
            {note}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">
            {sampleText.trim().length}/{MIN_SAMPLE_CHARS}
          </p>
          <Button
            variant="primary"
            onClick={() => void submitSample()}
            disabled={sampleText.trim().length < MIN_SAMPLE_CHARS || reviewing || !hasEvaluator}
          >
            {reviewing ? t("Checking…") : t("Check with AI →")}
          </Button>
        </div>
        {evaluatorHint && (
          <p className="text-xs text-ink-muted">
            {evaluatorHint}{" "}
            {onOpenSettings && (
              <button type="button" onClick={onOpenSettings} className="underline hover:no-underline">
                {t("Open Settings →")}
              </button>
            )}
          </p>
        )}

        <Disclosure
          title={t("Advanced options")}
          description={t("Temporarily change the AI.")}
          badge={
            activeProvider ? (
              <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} />
            ) : undefined
          }
          nested
        >
          <ProviderPicker selection={selection} disabled={reviewing} />
        </Disclosure>
      </Card>

      {flaggedItems.length > 0 && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-medium text-ink">{t("Practice speaking the fix")}</p>
          {flaggedItems.map((item) => (
            <div key={item.id} className="rounded-md border border-line bg-surface px-3 py-2">
              <p className="text-sm leading-relaxed text-ink-muted line-through">{item.original}</p>
              <p className="text-sm font-medium leading-relaxed text-ink">{item.corrected}</p>
              {item.rationale && <p className="mt-1 text-xs text-ink-muted">{item.rationale}</p>}
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => setSpeakingId(speakingId === item.id ? null : item.id)}
              >
                {speakingId === item.id ? t("Hide") : t("Practice speaking")}
              </Button>
              {speakingId === item.id && (
                <div className="mt-2">
                  <PronunciationCoach targetText={item.corrected} targetLang="en" source="c1" compact />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
