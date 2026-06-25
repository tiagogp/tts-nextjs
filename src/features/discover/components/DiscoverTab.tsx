"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import Disclosure from "@/components/ui/Disclosure";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { PhraseCandidate } from "@/lib/cards/schema";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { useDeckGeneration } from "@/features/cards/hooks/useDeckGeneration";
import type { DeckPayload } from "@/features/cards/exportDeck";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { DeckPreview } from "@/features/cards/components/DeckPreview";
import { HomeDashboard } from "@/features/discover/components/HomeDashboard";
import { TodayCard } from "@/features/plan/components/TodayCard";
import { WeeklyEffortCard } from "@/features/plan/components/WeeklyEffortCard";
import { PlanCalendar } from "@/features/plan/components/PlanCalendar";
import { SourcePicker } from "@/features/discover/components/SourcePicker";
import { TranscriptReview } from "@/features/discover/components/TranscriptReview";
import { ENGLISH_LEVELS, GENERATION_TIMEOUT_MS } from "@/features/discover/constants";
import type { DiscoverResult, DiscoverSourceKind, EnglishLevel, TranscriptSegment } from "@/features/discover/types";
import { curateDiscoverSegments, extractDiscoverSource, generateDiscoverDeck } from "@/features/discover/api";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { emitActivity } from "@/lib/store/activityLog";

function waitForAudioEvent(
  audio: HTMLAudioElement,
  eventName: "loadedmetadata" | "seeked",
  timeoutMs = 4000,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeEventListener(eventName, finish);
      audio.removeEventListener("error", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    audio.addEventListener(eventName, finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

export default function DiscoverTab({
  onOpenSettings,
  onStudyNow,
  onSpeakNow,
  onCorrectNow,
}: {
  onOpenSettings?: () => void;
  onStudyNow?: () => void;
  onSpeakNow?: () => void;
  onCorrectNow?: () => void;
}) {
  const { loading: settingsLoading } = useAiSettings();
  const [profile] = useState(getLearningProfile);
  const [sourceKind, setSourceKind] = useState<DiscoverSourceKind>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [focus, setFocus] = useState(profile.focus);
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>(profile.level);
  const [loading, setLoading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curationNote, setCurationNote] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [deckPreview, setDeckPreview] = useState<{
    data: DeckPayload;
    candidates: PhraseCandidate[];
  } | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState<number | null>(null);

  const selection = useProviderSelection();
  const { provider, activeProvider, providerReady, selectedModel } = selection;

  const generation = useDeckGeneration({
    timeoutMs: GENERATION_TIMEOUT_MS,
    timeoutMessage:
      "This is taking longer than expected. Try a shorter clip or switch to a faster provider.",
    cancelMessage: "Generation cancelled. Your selected phrases are still here.",
    stages: [
      { untilSeconds: 8, label: "Creating focused cards…" },
      { untilSeconds: 25, label: "Reviewing card quality…" },
      { untilSeconds: 90, label: "Preparing audio and the Anki deck…" },
      { untilSeconds: Infinity, label: "Still working — local models and audio clips can take a while…" },
    ],
  });
  const {
    generating,
    genError,
    genDone,
    generationSeconds,
    generationStage,
    run,
    cancelGeneration,
    setGenError,
    setGenDone,
  } = generation;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRequestRef = useRef(0);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  // Stop clip playback at the segment boundary.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (stopAtRef.current != null && audio.currentTime >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
        setPlaying(null);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [result]);

  const playClip = useCallback(
    async (index: number, seg: TranscriptSegment) => {
      const audio = audioRef.current;
      if (!audio) return;
      const requestId = playRequestRef.current + 1;
      playRequestRef.current = requestId;

      if (playing === index) {
        audio.pause();
        stopAtRef.current = null;
        setPlaying(null);
        return;
      }

      const start = Math.max(0, seg.startMs / 1000);
      const end = Math.max(start + 0.25, seg.endMs / 1000);

      audio.pause();
      stopAtRef.current = null;
      setPlaying(null);

      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        audio.load();
        await waitForAudioEvent(audio, "loadedmetadata");
        if (playRequestRef.current !== requestId) return;
      }

      audio.currentTime = start;
      if (audio.seeking) {
        await waitForAudioEvent(audio, "seeked");
        if (playRequestRef.current !== requestId) return;
      }

      stopAtRef.current = end;
      try {
        await audio.play();
        if (playRequestRef.current === requestId) setPlaying(index);
      } catch {
        if (playRequestRef.current === requestId) {
          stopAtRef.current = null;
          setPlaying(null);
        }
      }
    },
    [playing],
  );

  const hasSource = sourceKind === "pdf" ? file !== null : url.trim().length > 0;
  const canRun = hasSource && providerReady;

  const extract = useCallback(async () => {
    if (sourceKind === "pdf" ? !file : !url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setKept(new Set());
    setPlaying(null);
    setCurationNote(null);
    setGenError(null);
    setGenDone(null);
    setDeckPreview(null);
    setTranscribeProgress(null);

    // Only the YouTube path may download the one-time Whisper model.
    if (sourceKind === "youtube") {
      const poll = async () => {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          if (data.downloading_whisper) setDownloadingModel(true);
        } catch {}
      };
      pollRef.current = setInterval(poll, 2000);
    }

    try {
      const data = await extractDiscoverSource({
        sourceKind,
        url,
        file,
        onProgress: sourceKind === "youtube"
          ? (percent, stage) => setTranscribeProgress({ percent, stage })
          : undefined,
      });
      setResult(data);

      setCurating(true);
      try {
        const { selectedIndexes: selected } = await curateDiscoverSegments({
          provider,
          selectedModel,
          sourceKind,
          result: data,
          url,
          focus,
          targetLevel,
        });
        setKept(new Set(selected));
        setCurationNote(
          selected.length > 0
            ? `${selected.length} segment${selected.length === 1 ? "" : "s"} preselected for ${targetLevel}.`
            : `No segments preselected for ${targetLevel}.`,
        );
      } catch (mineErr: unknown) {
        setCurationNote(
          mineErr instanceof Error
            ? `Curation skipped: ${mineErr.message}`
            : "Curation skipped.",
        );
      } finally {
        setCurating(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setCurating(false);
      setDownloadingModel(false);
      setTranscribeProgress(null);
    }
  }, [sourceKind, url, file, provider, selectedModel, focus, targetLevel, setGenError, setGenDone]);

  const toggleKeep = (index: number) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setGenDone(null);
    setDeckPreview(null);
  };

  const generateCards = useCallback(async () => {
    if (!result || kept.size === 0 || !providerReady) return;

    // Accepted phrases → PhraseCandidates (the source of truth we persist, D1).
    // Timestamps drive the native clip, so they only travel for audio sources;
    // text sources (article / PDF) fall back to TTS.
    const now = Date.now();
    const candidates: PhraseCandidate[] = [...kept].map((i) => {
      const seg = result.segments[i];
      return {
        id: `${result.sourceId}-${i}`,
        sourceId: result.sourceId,
        text: seg.text,
        status: "accepted",
        startMs: result.hasAudio ? seg.startMs : undefined,
        endMs: result.hasAudio ? seg.endMs : undefined,
        createdAt: now,
      };
    });

    await run(async (signal) => {
      const data = await generateDiscoverDeck({ provider, selectedModel, result, candidates, signal });
      const cardsCreated = data.count ?? data.cards?.length ?? 0;
      void emitActivity("video_processed", { sourceUrl: url || result.sourceId, cardsCreated });
      setDeckPreview({ data, candidates });
      return `${cardsCreated} card${cardsCreated === 1 ? "" : "s"} ready to preview.`;
    });
  }, [result, kept, provider, providerReady, selectedModel, run]);

  return (
    <div className="space-y-5">
      <TodayCard
        onDiscover={() => sourceInputRef.current?.focus()}
        onStudy={onStudyNow}
        onConverse={onSpeakNow}
        onCorrect={onCorrectNow}
        onOpenSettings={onOpenSettings}
      />

      <WeeklyEffortCard />

      <PlanCalendar
        onDiscover={() => sourceInputRef.current?.focus()}
        onStudy={onStudyNow}
        onConverse={onSpeakNow}
        onCorrect={onCorrectNow}
      />

      <HomeDashboard
        onDiscover={() => sourceInputRef.current?.focus()}
        onStudy={onStudyNow}
        onSpeak={onSpeakNow}
        onCorrect={onCorrectNow}
      />

      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Turn real English into practice</p>
          <p className="text-xs text-ink-muted">
            Import one source, keep the useful phrases, then generate a small deck you can study immediately.
          </p>
        </div>

        <SourcePicker
          value={sourceKind}
          disabled={loading}
          onChange={(kind) => {
            if (result && !window.confirm("Discard the current Discover results?")) return;
            setSourceKind(kind);
            setError(null);
            setResult(null);
            setCurationNote(null);
          }}
        />

        {sourceKind === "pdf" ? (
          <Field label="PDF file" htmlFor="discover-pdf-input">
            <input
              ref={sourceInputRef}
              id="discover-pdf-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded file:border-0 file:px-4 file:py-2 file:text-xs file:font-medium"
            />
          </Field>
        ) : (
          <Field label={sourceKind === "article" ? "Article URL" : "YouTube URL"} htmlFor="discover-url-input">
            <Input
              ref={sourceInputRef}
              id="discover-url-input"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={
                sourceKind === "article" ? "https://example.com/some-article" : "https://www.youtube.com/watch?v=…"
              }
            />
          </Field>
        )}

        <Field label="English level" className="max-w-52">
          <Select
            value={targetLevel}
            onChange={(value) => setTargetLevel(value as EnglishLevel)}
            options={ENGLISH_LEVELS}
            disabled={loading}
          />
        </Field>

        <Disclosure
          title="Advanced options"
          description="Guide curation or temporarily use a different AI model."
          nested
        >
          <div className="space-y-4">
            <Field
              label={
                <>
                  Focus <span className="opacity-70">— optional</span>
                </>
              }
            >
              <Input
                type="text"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="e.g. phrasal verbs, business vocabulary…"
              />
            </Field>
            <ProviderPicker selection={selection} disabled={loading} />
          </div>
        </Disclosure>

        {!providerReady && !settingsLoading && (
          <Notice tone="error" role="status">
            {activeProvider?.label ?? "The selected AI provider"} is unavailable.{" "}
            {onOpenSettings ? (
              <button onClick={onOpenSettings} className="underline hover:no-underline">
                Open Settings →
              </button>
            ) : (
              "Open Settings with the gear icon to connect it."
            )}
          </Notice>
        )}

        <Button
          variant="primary"
          size="lg"
          className="flex min-h-10 items-center justify-center gap-2"
          onClick={extract}
          disabled={loading || !canRun}
        >
          {loading ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              {curating
                ? "Curating…"
                : transcribeProgress?.stage === "transcribe"
                  ? `Transcribing… ${transcribeProgress.percent}%`
                  : transcribeProgress?.stage === "download"
                    ? "Downloading audio…"
                    : sourceKind === "youtube"
                      ? "Starting…"
                      : "Extracting…"}
            </>
          ) : (
            "Find phrases to learn"
          )}
        </Button>

        {loading && transcribeProgress?.stage === "transcribe" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-linear"
              style={{ width: `${transcribeProgress.percent}%` }}
            />
          </div>
        )}

        {downloadingModel && (
          <div className="flex items-center gap-2 rounded border border-line bg-surface px-3 py-2.5 text-xs text-ink-soft">
            <Spinner className="h-3 w-3 shrink-0" />
            Preparing audio discovery for the first time… this may take a minute.
          </div>
        )}

        {error && (
          <Notice tone="error" className="text-xs">
            {error}
          </Notice>
        )}

        {!result && !loading && !hasSource && (
          <div className="rounded border border-line bg-surface px-3 py-2.5 text-xs text-ink-soft">
            {sourceKind === "pdf"
              ? "Choose a PDF file to get started."
              : sourceKind === "article"
                ? "Paste an article URL to get started, for example https://example.com/english-learning."
                : "Paste a YouTube URL to get started, for example https://www.youtube.com/watch?v=VIDEO_ID."}
          </div>
        )}
      </Card>

      {result && (
        <TranscriptReview
          result={result}
          audioRef={audioRef}
          kept={kept}
          playing={playing}
          curationNote={curationNote}
          generating={generating}
          genError={genError}
          genDone={genDone}
          generationStage={generationStage}
          generationSeconds={generationSeconds}
          providerReady={providerReady}
          onGenerate={generateCards}
          onCancel={cancelGeneration}
          onToggleKeep={toggleKeep}
          onPlay={(index, segment) => void playClip(index, segment)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {deckPreview && (
        <DeckPreview
          title="Discover deck preview"
          data={deckPreview.data}
          defaultFilename={`${result?.title || "deck"}.apkg`}
          persist={async (cards) => {
            await saveGeneratedDeck(cards, deckPreview.candidates);
            void emitActivity("cards_created", { count: cards.length, source: "discover" });
          }}
          onStudyNow={onStudyNow}
          onDismiss={() => setDeckPreview(null)}
        />
      )}
    </div>
  );
}
