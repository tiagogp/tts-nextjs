"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useT } from "@/i18n/I18nProvider";
import type { ProviderKind } from "@/lib/cards/provider";
import { reviewAdvancedText } from "@/features/correct/api";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import LocalModelNotice from "@/features/speech/components/LocalModelNotice";
import { useWhisperModel } from "@/features/speech/hooks/useLocalModel";
import { detectRepertoireUse, type RepertoireItem } from "@/features/converse/repertoire";

/** Offering every unheard expression at once is a vocabulary list; three is a choice. */
const MAX_OFFERED = 3;

/**
 * The pushed-output half of repertoire practice, at the one moment it costs nothing to ask:
 * the session is over, the learner has just been shown what they only heard, and the gap between
 * "I understood that" and "I could have said that" is still fresh.
 *
 * Being fed expressions is not what moves an advanced learner — the C1-C2 plateau is precisely
 * that they perform sophisticated functions with the vocabulary they already own. So this asks
 * them to produce one of the new ones in their own sentence, and only counts it when they do.
 */
export function RepertoireRecall({
  items,
  context,
  level,
  provider,
  selectedModel,
  hasEvaluator,
  onUsed,
}: {
  /** Expressions from this session the learner never said back. */
  items: RepertoireItem[];
  context: string;
  level?: string;
  provider: ProviderKind;
  selectedModel?: string;
  hasEvaluator: boolean;
  onUsed: (used: RepertoireItem[]) => void;
}) {
  const { t } = useT();
  const whisper = useWhisperModel();
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [used, setUsed] = useState<RepertoireItem[]>([]);
  const [issueCount, setIssueCount] = useState<number | null>(null);

  const audio = useCorrectionAudio({
    onNote: setNote,
    onText: (updater) => {
      setText(updater);
      setUsed([]);
      setIssueCount(null);
    },
    onBlob: () => {},
  });

  const offered = items.slice(-MAX_OFFERED);
  if (offered.length === 0) return null;

  const check = async () => {
    const attempt = text.trim();
    if (!attempt || checking) return;
    const matched = detectRepertoireUse(attempt, offered);
    if (matched.length === 0) {
      setUsed([]);
      setIssueCount(null);
      // Not a failure worth a red banner — they wrote something, it just wasn't the exercise.
      setNote(t("None of these are in there yet. Work one into a sentence you'd actually say."));
      return;
    }
    setNote(null);
    setUsed(matched);
    onUsed(matched);
    // Using it is what counts; whether it came out cleanly is a bonus, so a failed check
    // never takes back the credit above.
    if (!hasEvaluator) return;
    setChecking(true);
    try {
      const review = await reviewAdvancedText({ provider, selectedModel, text: attempt, context, level });
      setIssueCount(review.errors.length);
    } catch {
      setIssueCount(null);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-ink">{t("Say one of these back")}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {t("You heard these but never used them. Put one into a sentence of your own about {context}.", { context })}
        </p>
      </div>

      <ul className="space-y-1.5">
        {offered.map((item) => (
          <li key={item.expression.toLowerCase()} className="rounded border border-line bg-card px-2.5 py-2">
            <p className="text-sm font-medium text-ink">{item.expression}</p>
            {item.gloss && <p className="text-xs text-ink-muted">{item.gloss}</p>}
            {item.carrier && <p className="mt-1 text-xs italic text-ink-muted">“{item.carrier}”</p>}
          </li>
        ))}
      </ul>

      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setUsed([]);
          setIssueCount(null);
        }}
        rows={2}
        placeholder={t("Write your sentence here…")}
        className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        disabled={checking}
      />
      <LocalModelNotice model={whisper} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant={audio.recording ? "primary" : "secondary"}
          onClick={() => (audio.recording ? audio.stopRecording() : void audio.startRecording())}
          disabled={checking || audio.transcribing}
          aria-pressed={audio.recording}
        >
          {audio.transcribing ? t("Transcribing…") : audio.recording ? t("Stop recording") : t("Say it")}
        </Button>
        <Button variant="secondary" onClick={() => void check()} disabled={!text.trim() || checking}>
          {checking ? t("Checking…") : t("Check")}
        </Button>
      </div>

      {note && <p className="text-xs text-ink-soft">{note}</p>}
      {used.length > 0 && (
        <Notice tone={issueCount && issueCount > 0 ? "warning" : "success"}>
          {issueCount && issueCount > 0
            ? t("You used {expression} — that's the one that counts. {count} smaller issues elsewhere in the sentence.", {
                expression: used[0].expression,
                count: issueCount,
              })
            : t("You used {expression}. That's it moving from heard to yours.", { expression: used[0].expression })}
        </Notice>
      )}
    </div>
  );
}
