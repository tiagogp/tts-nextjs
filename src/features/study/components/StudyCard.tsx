"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeButtons } from "./GradeButtons";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import type { Card as CardModel } from "@/lib/cards/schema";

export interface DueCard {
  card: CardModel;
  srs: SrsRecord;
}

interface StudyCardProps {
  totalCards: number;
  current?: DueCard;
  queueLength: number;
  flipped: boolean;
  reviewedThisSession: number;
  onFlip: () => void;
  onGrade: (grade: Grade) => void;
}

export function StudyCard({
  totalCards,
  current,
  queueLength,
  flipped,
  reviewedThisSession,
  onFlip,
  onGrade,
}: StudyCardProps) {
  return (
    <Card className="p-6 sm:p-8">
      {totalCards === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">No cards yet</p>
          <p className="text-xs text-ink-muted">
            Generate some cards in the Discover tab — they’ll show up here for review.
          </p>
        </div>
      ) : !current ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-ink">All caught up 🎉</p>
          <p className="text-xs text-ink-muted">
            {reviewedThisSession > 0 ? `${reviewedThisSession} reviewed this session. ` : ""}
            Nothing due right now — come back later.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.8px] text-ink-muted">
              {current.card.concept || "Card"}
            </span>
            <span className="text-xs tabular-nums text-ink-muted">{queueLength} due</span>
          </div>

          <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg leading-relaxed text-ink">{current.card.front}</p>
            {flipped && (
              <>
                <div className="w-full border-t border-line" />
                <p className="text-base leading-relaxed text-ink-soft">{current.card.back}</p>
                {current.card.errorType && <span className="text-xs text-ink-muted">{current.card.errorType}</span>}
              </>
            )}
          </div>

          {!flipped ? (
            <Button variant="primary" size="lg" className="py-2.5" onClick={onFlip}>
              Show answer
            </Button>
          ) : (
            <GradeButtons srs={current.srs} onGrade={onGrade} />
          )}
        </div>
      )}
    </Card>
  );
}
