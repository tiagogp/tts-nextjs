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
import { SourcePicker } from "@/features/discover/components/SourcePicker";
import { TranscriptReview } from "@/features/discover/components/TranscriptReview";
import { ENGLISH_LEVELS, GENERATION_TIMEOUT_MS } from "@/features/discover/constants";
import type { DiscoverResult, DiscoverSourceKind, EnglishLevel, TranscriptSegment } from "@/features/discover/types";
import { curateDiscoverSegments, extractDiscoverSource, generateDiscoverDeck } from "@/features/discover/api";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile } from "@/features/settings/learningProfile";
import { demoResult, demoDeckFor } from "@/features/discover/demo/demoFixture";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";

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
}: {
  onOpenSettings?: () => void;
  onStudyNow?: () => void;
}) {
  const { t } = useT();
  const { loading: settingsLoading } = useAiSettings();
  const [sourceKind, setSourceKind] = useState<DiscoverSourceKind>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [focus, setFocus] = useState(DEFAULT_LEARNING_PROFILE.focus);
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>(DEFAULT_LEARNING_PROFILE.level);
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
  // The "Try demo" run uses bundled phrases + cards and bypasses the AI provider
  // entirely, so a new user can complete the loop with zero setup.
  const [demoMode, setDemoMode] = useState(false);

  const selection = useProviderSelection();
  const { provider, providerReady, selectedModel } = selection;

  const generation = useDeckGeneration({
    timeoutMs: GENERATION_TIMEOUT_MS,
    timeoutMessage:
      "This is taking longer than expected. Try a shorter clip or switch to a faster AI.",
    cancelMessage: "Generation cancelled. Your selected phrases are still here.",
    stages: [
      { untilSeconds: 8, label: "Creating focused practice phrases…" },
      { untilSeconds: 25, label: "Reviewing phrase quality…" },
      { untilSeconds: 90, label: "Preparing audio and Anki export…" },
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

  useEffect(() => {
    const loadProfile = () => {
      const nextProfile = getLearningProfile();
      setFocus(nextProfile.focus);
      setTargetLevel(nextProfile.level);
    };
    loadProfile();
    window.addEventListener("phraseloop:profile-updated", loadProfile);
    return () => window.removeEventListener("phraseloop:profile-updated", loadProfile);
  }, []);

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
    // Bundled clips (demo) play to their natural end rather than to a timestamp.
    const onEnded = () => {
      stopAtRef.current = null;
      setPlaying(null);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
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

      // Bundled per-segment clip (demo): swap the source and play it whole.
      if (seg.clipUrl) {
        audio.pause();
        stopAtRef.current = null;
        setPlaying(null);
        if (audio.src !== new URL(seg.clipUrl, window.location.href).href) {
          audio.src = seg.clipUrl;
          audio.load();
          await waitForAudioEvent(audio, "loadedmetadata");
          if (playRequestRef.current !== requestId) return;
        }
        audio.currentTime = 0;
        try {
          await audio.play();
          if (playRequestRef.current === requestId) setPlaying(index);
        } catch {
          if (playRequestRef.current === requestId) setPlaying(null);
        }
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
  // Importing/transcribing a source never needs the AI provider — only curation
  // (auto-picking phrases) and card generation do. Let people try the source step first.
  const canRun = hasSource;

  const extract = useCallback(async () => {
    if (sourceKind === "pdf" ? !file : !url.trim()) return;
    setLoading(true);
    setDemoMode(false);
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

      // Auto-curation needs the AI provider. Without it, still show the
      // transcript so people can hand-pick phrases; cards stay gated later.
      if (!providerReady) {
        setCurationNote("Connect AI in Settings to auto-pick phrases. For now, tap the phrases you want to keep.");
        return;
      }

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
            ? `Auto-selection skipped: ${mineErr.message}`
            : "Auto-selection skipped.",
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
  }, [sourceKind, url, file, provider, providerReady, selectedModel, focus, targetLevel, setGenError, setGenDone]);

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

  // Drop the user straight into the review step with bundled phrases — no source,
  // no model download, no AI provider. The aha is the loop itself.
  const startDemo = useCallback(() => {
    audioRef.current?.pause();
    setError(null);
    setGenError(null);
    setGenDone(null);
    setDeckPreview(null);
    setPlaying(null);
    setDemoMode(true);
    setResult(demoResult);
    setKept(new Set(demoResult.segments.map((_, i) => i)));
    setCurationNote(t("Example content — tap to listen, then uncheck anything you don't want."));
  }, [setGenError, setGenDone, t]);

  // Clear the demo and return to the empty import state. Stable card ids mean a
  // re-run overwrites rather than duplicates, but a learner who wants their own
  // captures clean can wipe the sample's cards too via Settings → clear data.
  const clearDemo = useCallback(() => {
    audioRef.current?.pause();
    setDemoMode(false);
    setResult(null);
    setKept(new Set());
    setPlaying(null);
    setCurationNote(null);
    setDeckPreview(null);
    setGenDone(null);
    setGenError(null);
  }, [setGenDone, setGenError]);

  // Let the "Hoje" home start the demo by deep-linking into Discover.
  useEffect(() => {
    const onStartDemo = () => startDemo();
    window.addEventListener("phraseloop:start-demo", onStartDemo);
    return () => window.removeEventListener("phraseloop:start-demo", onStartDemo);
  }, [startDemo]);

  const generateCards = useCallback(async () => {
    if (!result || kept.size === 0) return;

    // Demo: build the deck from bundled cards instead of calling the provider.
    if (demoMode) {
      const { candidates, cards } = demoDeckFor(kept);
      setDeckPreview({ data: { cards, count: cards.length }, candidates });
      setGenDone(`${cards.length} practice phrase${cards.length === 1 ? "" : "s"} ready to save.`);
      return;
    }

    if (!providerReady) return;

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
      return `${cardsCreated} practice phrase${cardsCreated === 1 ? "" : "s"} ready to save.`;
    });
  }, [result, kept, demoMode, provider, providerReady, selectedModel, run, setGenDone, setDeckPreview, url]);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Turn useful phrases into daily practice</p>
          <p className="text-xs text-ink-muted">
            Start with the bundled demo, or bring one source when you want your own material.
          </p>
        </div>

        {!result && !loading && (
          <Button
            variant="primary"
            size="lg"
            className="min-h-10"
            onClick={startDemo}
          >
            {t("Start a demo lesson")}
          </Button>
        )}

        {!result && !loading && (
          <Disclosure
            title="Use custom content"
            description="YouTube, article, and PDF import are here when you choose to bring your own material."
            nested
            defaultOpen={hasSource}
          >
            <div className="space-y-4">
              <SourcePicker
                value={sourceKind}
                disabled={loading}
                onChange={(kind) => {
                  if (result && !window.confirm("Discard the current Discover results?")) return;
                  setSourceKind(kind);
                  setError(null);
                  setResult(null);
                  setDemoMode(false);
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
                description="Focus, IA, and model choices for custom material."
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
                <Notice tone="default" role="status">
                  You can import and read a source now. To auto-pick phrases and save practice phrases, connect IA{" "}
                  {onOpenSettings ? (
                    <button onClick={onOpenSettings} className="underline hover:no-underline">
                      in Settings →
                    </button>
                  ) : (
                    "in Settings (gear icon)."
                  )}
                </Notice>
              )}

              <Button
                variant="secondary"
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
            </div>
          </Disclosure>
        )}

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

      </Card>

      {demoMode && result && (
        <div className="flex items-center justify-between gap-3 rounded border border-line bg-surface px-3 py-2 text-xs text-ink-soft">
          <span>{t("This is sample content, not your own captures.")}</span>
          <button
            type="button"
            onClick={clearDemo}
            className="shrink-0 underline transition-colors hover:text-ink hover:no-underline"
          >
            {t("Clear example")}
          </button>
        </div>
      )}

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
          providerReady={providerReady || demoMode}
          onGenerate={generateCards}
          onCancel={cancelGeneration}
          onToggleKeep={toggleKeep}
          onPlay={(index, segment) => void playClip(index, segment)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {deckPreview && (
        <DeckPreview
          title="Practice phrase preview"
          data={deckPreview.data}
          defaultFilename={`${result?.title || "study-list"}.apkg`}
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
