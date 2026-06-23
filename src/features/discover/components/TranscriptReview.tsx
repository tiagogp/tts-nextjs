"use client";

import { motion } from "motion/react";
import { type RefObject } from "react";
import { BLUR, springSoft } from "@/lib/motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import type { DiscoverResult, TranscriptSegment } from "@/features/discover/types";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface TranscriptReviewProps {
  result: DiscoverResult;
  audioRef: RefObject<HTMLAudioElement | null>;
  kept: Set<number>;
  playing: number | null;
  curationNote: string | null;
  generating: boolean;
  genError: string | null;
  genDone: string | null;
  generationStage: string;
  generationSeconds: number;
  providerReady: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onToggleKeep: (index: number) => void;
  onPlay: (index: number, segment: TranscriptSegment) => void;
}

export function TranscriptReview({
  result,
  audioRef,
  kept,
  playing,
  curationNote,
  generating,
  genError,
  genDone,
  generationStage,
  generationSeconds,
  providerReady,
  onGenerate,
  onCancel,
  onToggleKeep,
  onPlay,
}: TranscriptReviewProps) {
  return (
    <Card className="overflow-hidden">
      {result.hasAudio && (
        <audio key={result.sourceId} ref={audioRef} src={`/api/discover/audio/${result.sourceId}`} preload="metadata" />
      )}

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{result.title}</p>
          <p className="text-xs text-ink-muted">
            {result.segments.length} segments · {kept.size} kept
            {curationNote ? ` · ${curationNote}` : ""}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={generating ? onCancel : onGenerate}
          disabled={!generating && (kept.size === 0 || !providerReady)}
        >
          {generating ? (
            <>
              <span aria-hidden="true">×</span>
              Cancel
            </>
          ) : (
            "Generate cards →"
          )}
        </Button>
      </div>

      {generating && (
        <motion.div
          className="border-b border-line bg-accent/4 px-5 py-3"
          initial={{ opacity: 0, height: 0, filter: `blur(${BLUR}px)` }}
          animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
          transition={springSoft}
          style={{ overflow: "hidden" }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-soft">{generationStage}</span>
            <span className="tabular-nums text-ink-muted">{generationSeconds}s</span>
          </div>
          <div className="generation-track" aria-hidden="true">
            <span className="generation-bar" />
          </div>
        </motion.div>
      )}

      {(genError || genDone) && (
        <div className={cn("border-b border-line px-5 py-2.5 text-xs", genError ? "bg-danger/8 text-danger" : "text-ink-soft")}>
          {genError ?? genDone}
        </div>
      )}

      <ul className="max-h-[28rem] overflow-y-auto">
        {result.segments.map((segment, index) => (
          <SegmentRow
            key={index}
            index={index}
            segment={segment}
            hasAudio={result.hasAudio}
            isKept={kept.has(index)}
            isPlaying={playing === index}
            onPlay={onPlay}
            onToggleKeep={onToggleKeep}
          />
        ))}
      </ul>
    </Card>
  );
}

interface SegmentRowProps {
  index: number;
  segment: TranscriptSegment;
  hasAudio: boolean;
  isKept: boolean;
  isPlaying: boolean;
  onPlay: (index: number, segment: TranscriptSegment) => void;
  onToggleKeep: (index: number) => void;
}

function SegmentRow({ index, segment, hasAudio, isKept, isPlaying, onPlay, onToggleKeep }: SegmentRowProps) {
  return (
    <li className={cn("flex items-start gap-3 border-b border-line px-5 py-2.5 transition-colors", isKept && "bg-surface")}>
      {hasAudio && (
        <button
          type="button"
          onClick={() => onPlay(index, segment)}
          aria-label={isPlaying ? "Pause clip" : "Play clip"}
          aria-pressed={isPlaying}
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-line transition-colors hover:border-line-strong",
            isPlaying ? "text-accent" : "text-ink-muted",
          )}
        >
          {isPlaying ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6z" />
            </svg>
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink">{segment.text}</p>
        {hasAudio && <span className="text-xs tabular-nums text-ink-muted">{formatTime(segment.startMs)}</span>}
      </div>

      <Chip active={isKept} className="mt-0.5 shrink-0" onClick={() => onToggleKeep(index)}>
        {isKept ? "Kept" : "Keep"}
      </Chip>
    </li>
  );
}
