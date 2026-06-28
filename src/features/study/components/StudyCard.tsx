"use client";

import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeButtons } from "./GradeButtons";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import type { Card as CardModel } from "@/lib/cards/schema";
import type { ReviewRecord } from "@/lib/store/repository";
import { PronunciationCoach } from "@/features/pronunciation/components/PronunciationCoach";
import { SessionSummary, type SessionResult } from "./SessionSummary";
import {
  SCAFFOLD,
  buildHint,
  isStable,
  recentFailureCount,
  shouldOfferModalityFallback,
} from "../scaffold";

export interface DueCard {
  card: CardModel;
  srs: SrsRecord;
}

/** Telemetry the card reports up on grade, merged with latency in StudyTab. */
export interface ScaffoldTelemetry {
  hintUsed: boolean;
  scaffoldLevel: number;
}

interface StudyCardProps {
  totalCards: number;
  current?: DueCard;
  queueLength: number;
  flipped: boolean;
  sessionResults: SessionResult[];
  streakDays: number;
  reviews: ReviewRecord[];
  onFlip: () => void;
  onGrade: (grade: Grade, scaffold: ScaffoldTelemetry) => void;
  onDiscover: () => void;
}

export function StudyCard({
  totalCards,
  current,
  queueLength,
  flipped,
  sessionResults,
  streakDays,
  reviews,
  onFlip,
  onGrade,
  onDiscover,
}: StudyCardProps) {
  // Highest scaffold tier used on the current card — reported up on grade.
  const [scaffoldLevel, setScaffoldLevel] = useState<number>(SCAFFOLD.none);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cardId = current?.card.id;
  // Reset scaffold state whenever the card changes (render-phase reset on key change).
  const [prevCardId, setPrevCardId] = useState(cardId);
  if (cardId !== prevCardId) {
    setPrevCardId(cardId);
    setScaffoldLevel(SCAFFOLD.none);
  }

  const nativeClip =
    current?.card.audioClipPath?.startsWith("/") ? current.card.audioClipPath : undefined;
  const failures = useMemo(
    () => (cardId ? recentFailureCount(cardId, reviews) : 0),
    [cardId, reviews],
  );
  const stable = current ? isStable(current.srs) : false;
  const offerModality = !!nativeClip && shouldOfferModalityFallback(failures);

  const markScaffold = (level: number) => setScaffoldLevel((prev) => Math.max(prev, level));

  const playClip = (rate: number, level: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = rate;
    el.currentTime = 0;
    void el.play();
    markScaffold(level);
  };

  // When a queue finishes after real work, the honest session summary replaces the
  // bare "all caught up" note — it carries its own card chrome.
  if (totalCards > 0 && !current && sessionResults.length > 0) {
    return <SessionSummary results={sessionResults} streakDays={streakDays} />;
  }

  return (
    <Card className="p-6 sm:p-8">
      {totalCards === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">No cards yet</p>
          <p className="text-xs text-ink-muted">
            Start with one real source in Discover. Keep a small set of phrases, then review them here.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onDiscover}>
            Discover new content
          </Button>
        </div>
      ) : !current ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">You&apos;re all caught up</p>
          <p className="text-xs text-ink-muted">
            Add a small batch only when you are ready for more.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onDiscover}>
            Discover new content
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
              {current.card.concept || "Card"}
            </span>
            <span className="text-xs tabular-nums text-ink-muted">{queueLength} in today&apos;s queue</span>
          </div>

          <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg leading-relaxed text-ink">{current.card.front}</p>

            {!flipped && scaffoldLevel >= SCAFFOLD.partial && (
              <p className="font-mono text-sm tracking-wide text-ink-soft transition-opacity">
                {buildHint(current.card.back)}
              </p>
            )}

            {flipped && (
              <>
                <div className="w-full border-t border-line" />
                <p className="text-base leading-relaxed text-ink-soft">{current.card.back}</p>
                {current.card.errorType && <span className="text-xs text-ink-muted">{current.card.errorType}</span>}
                <div className="w-full">
                  <PronunciationCoach
                    source="study"
                    cardId={current.card.id}
                    targetText={current.card.back}
                    referenceAudioUrl={nativeClip}
                    compact
                  />
                </div>
              </>
            )}
          </div>

          {!flipped && (
            <ScaffoldControls
              stable={stable}
              hasHint={scaffoldLevel < SCAFFOLD.partial}
              nativeClip={nativeClip}
              offerModality={offerModality}
              onHint={() => markScaffold(SCAFFOLD.partial)}
              onSlowAudio={() => playClip(0.75, SCAFFOLD.hint)}
              onModality={() => playClip(1, SCAFFOLD.modality)}
            />
          )}

          {nativeClip && (
            // Hidden player the scaffold controls drive (slow replay / listen-and-repeat).
            <audio ref={audioRef} src={nativeClip} preload="none" className="hidden" />
          )}

          {!flipped ? (
            <Button variant="primary" size="lg" className="py-2.5" onClick={onFlip}>
              Show answer
            </Button>
          ) : (
            <GradeButtons
              srs={current.srs}
              onGrade={(g) => onGrade(g, { hintUsed: scaffoldLevel > SCAFFOLD.none, scaffoldLevel })}
            />
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Opt-in support shown pre-flip. For a stable card the affordance shrinks to a quiet text
 * link (withdrawal rule); for a fragile one it's a proper button. The listen-and-repeat
 * fallback only appears after a real run of failures on a card with native audio.
 */
function ScaffoldControls({
  stable,
  hasHint,
  nativeClip,
  offerModality,
  onHint,
  onSlowAudio,
  onModality,
}: {
  stable: boolean;
  hasHint: boolean;
  nativeClip?: string;
  offerModality: boolean;
  onHint: () => void;
  onSlowAudio: () => void;
  onModality: () => void;
}) {
  if (offerModality) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button variant="secondary" size="sm" onClick={onModality}>
          Listen &amp; repeat
        </Button>
        <p className="text-[11px] text-ink-muted">
          You&apos;ve struggled with this one — hear it first, then say it back.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 text-xs">
      {hasHint &&
        (stable ? (
          <button
            type="button"
            onClick={onHint}
            className="cursor-pointer text-ink-muted underline-offset-2 transition-opacity hover:opacity-70 hover:underline"
          >
            Need a hint?
          </button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onHint}>
            Hint
          </Button>
        ))}
      {nativeClip && (
        <button
          type="button"
          onClick={onSlowAudio}
          className="cursor-pointer text-ink-muted underline-offset-2 transition-opacity hover:opacity-70 hover:underline"
        >
          Replay 0.75×
        </button>
      )}
    </div>
  );
}
