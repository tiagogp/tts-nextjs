"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import Disclosure from "@/components/ui/Disclosure";
import { getCounts, saveGeneratedDeck } from "@/lib/store/repository";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { Card as CardModel, PhraseCandidate } from "@/lib/cards/schema";
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
import { markFirstRunPhrasesSaved, startFirstRunActivation } from "@/features/activation/firstRun";
import { emitActivity } from "@/lib/store/activityLog";
import { useT } from "@/i18n/I18nProvider";

/**
 * Local path Study/pronunciation can play for one segment's native audio:
 * the bundled clip when the segment ships one, otherwise the per-phrase
 * slice of the imported source. Works with no AI provider configured.
 */
function clipPathForSegment(result: DiscoverResult, seg: TranscriptSegment): string | undefined {
  if (seg.clipUrl) return seg.clipUrl;
  if (!result.hasAudio || seg.endMs <= seg.startMs) return undefined;
  if (!/^[a-z0-9]{12}$/.test(result.sourceId)) return undefined;
  // The runtime slices at most 30s per clip; a longer "phrase" keeps its first 30s.
  const endMs = Math.min(seg.endMs, seg.startMs + 30_000);
  return `/api/discover/clip/${result.sourceId}?startMs=${seg.startMs}&endMs=${endMs}`;
}

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
  prefill,
}: {
  onOpenSettings?: () => void;
  onStudyNow?: () => void;
  prefill?: { url: string; nonce: number } | null;
}) {
  const { t } = useT();
  const { loading: settingsLoading } = useAiSettings();
  const initialCurationNote = prefill
    ? "Vídeo sugerido preenchido. Toque em “Buscar frases para aprender” para testar com uma fonte real."
    : null;
  const [sourceKind, setSourceKind] = useState<DiscoverSourceKind>("youtube");
  const [url, setUrl] = useState(prefill?.url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [focus, setFocus] = useState(DEFAULT_LEARNING_PROFILE.focus);
  const [targetLevel, setTargetLevel] = useState<EnglishLevel>(DEFAULT_LEARNING_PROFILE.level);
  const [loading, setLoading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curationNote, setCurationNote] = useState<string | null>(initialCurationNote);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [deckPreview, setDeckPreview] = useState<{
    data: DeckPayload;
    candidates: PhraseCandidate[];
  } | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState<number | null>(null);
  const selection = useProviderSelection();
  const { provider, providerReady, selectedModel } = selection;

  const generation = useDeckGeneration({
    timeoutMs: GENERATION_TIMEOUT_MS,
    timeoutMessage:
      "Está demorando mais do que o esperado. Tente um vídeo mais curto ou uma IA mais rápida.",
    cancelMessage: "Geração cancelada. As frases selecionadas continuam aqui.",
    stages: [
      { untilSeconds: 8, label: "Criando frases focadas para praticar…" },
      { untilSeconds: 25, label: "Revisando a qualidade das frases…" },
      { untilSeconds: 90, label: "Preparando áudio e cards de revisão…" },
      { untilSeconds: Infinity, label: "Ainda trabalhando. O processamento local e os áudios podem demorar um pouco…" },
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
    if (!prefill) return;
    window.setTimeout(() => sourceInputRef.current?.focus(), 0);
  }, [prefill]);

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
    setError(null);
    setResult(null);
    setKept(new Set());
    setPlaying(null);
    setCurationNote(null);
    setGenError(null);
    setGenDone(null);
    setDeckPreview(null);
    setTranscribeProgress(null);

    try {
      const counts = await getCounts();
      if (counts.cards === 0 && counts.reviews === 0) {
        const sourceId = sourceKind === "pdf" ? file?.name : url.trim();
        startFirstRunActivation({
          source: "own_source",
          sourceId,
        });
        void emitActivity("first_run_started", { source: "own_source", sourceId });
      }
    } catch {
      // Activation timing is diagnostic only; never block source import.
    }

    void emitActivity("own_source_started", {
      sourceKind,
      sourceId: (sourceKind === "pdf" ? file?.name : url.trim()) || undefined,
    });

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
        setCurationNote(t("Connect an AI in Settings to pick phrases automatically. For now, tap the phrases you want to keep."));
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
          selected.length === 1
            ? t("1 passage pre-selected for {level}.", { level: targetLevel })
            : selected.length > 1
              ? t("{count} passages pre-selected for {level}.", { count: selected.length, level: targetLevel })
              : t("No passages pre-selected for {level}.", { level: targetLevel }),
        );
      } catch (mineErr: unknown) {
        setCurationNote(
          mineErr instanceof Error
            ? t("Automatic selection skipped: {message}", { message: mineErr.message })
            : t("Automatic selection skipped."),
        );
      } finally {
        setCurating(false);
      }
    } catch (err: unknown) {
      const fallback =
        sourceKind === "youtube"
          ? "Não consegui importar esse vídeo. Tente um vídeo público com menos de 15 minutos ou continue pela lição inicial e Estudar."
          : sourceKind === "article"
            ? "Não consegui abrir esse artigo. Tente outro link ou continue pela lição inicial e Estudar."
            : "Não consegui ler esse PDF. Tente um arquivo menor ou continue pela lição inicial e Estudar.";
      const message = err instanceof Error ? err.message : "";
      setError(message.startsWith("Não ") || message.startsWith("O processamento") ? message : fallback);
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setCurating(false);
      setDownloadingModel(false);
      setTranscribeProgress(null);
    }
  }, [sourceKind, url, file, provider, providerReady, selectedModel, focus, targetLevel, setGenError, setGenDone, t]);

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

  const buildCandidates = useCallback((): PhraseCandidate[] => {
    if (!result) return [];
    // Accepted phrases → PhraseCandidates (the source of truth we persist, D1).
    // Timestamps drive the native clip, so they only travel for audio sources;
    // text sources (article / PDF) fall back to TTS.
    const now = Date.now();
    return [...kept]
      .sort((a, b) => a - b)
      .map((i) => {
        const seg = result.segments[i];
        return {
          id: `${result.sourceId}-${i}`,
          sourceId: result.sourceId,
          text: seg.text,
          status: "accepted" as const,
          startMs: result.hasAudio ? seg.startMs : undefined,
          endMs: result.hasAudio ? seg.endMs : undefined,
          audioClipPath: clipPathForSegment(result, seg),
          createdAt: now,
        };
      });
  }, [result, kept]);

  // No AI provider: hand-picked phrases still become review cards — phrase +
  // native clip + SRS entry, built deterministically on the client. The AI only
  // adds automatic curation and translations on top of this path.
  const saveManualSelection = useCallback(async () => {
    if (!result || kept.size === 0) return;
    setGenError(null);
    try {
      const candidates = buildCandidates();
      const cards: CardModel[] = candidates.map((candidate) => ({
        id: `${candidate.id}-manual`,
        front: candidate.text,
        back: t("Say what it means, then try using it in your own sentence."),
        concept: result.title.slice(0, 60),
        source: { kind: "phrase", id: candidate.id },
        audioClipPath: candidate.audioClipPath,
        createdAt: candidate.createdAt,
      }));
      const saved = await saveGeneratedDeck(cards, candidates);
      const activation = markFirstRunPhrasesSaved({ sourceId: result.sourceId });
      void emitActivity("cards_created", { count: cards.length, source: "discover", activation });
      void emitActivity("own_source_completed", { cardsCreated: cards.length });
      setGenDone(
        saved.added === 1
          ? t("1 phrase saved for review. Find it in Study.")
          : t("{count} phrases saved for review. Find them in Study.", { count: saved.added }),
      );
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : t("Could not save these phrases."));
    }
  }, [result, kept, buildCandidates, setGenError, setGenDone, t]);

  const generateCards = useCallback(async () => {
    if (!result || kept.size === 0) return;

    if (!providerReady) {
      await saveManualSelection();
      return;
    }

    const candidates = buildCandidates();
    await run(async (signal) => {
      const data = await generateDiscoverDeck({ provider, selectedModel, result, candidates, signal });
      const cardsCreated = data.count ?? data.cards?.length ?? 0;
      void emitActivity("video_processed", { sourceUrl: url || result.sourceId, cardsCreated });
      setDeckPreview({ data, candidates });
      return `${cardsCreated} practice phrase${cardsCreated === 1 ? "" : "s"} ready to save.`;
    });
  }, [result, kept, provider, providerReady, selectedModel, run, setDeckPreview, url, buildCandidates, saveManualSelection]);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Turn useful phrases into daily practice")}</p>
          <p className="text-xs text-ink-muted">
            {t("Bring one video, article, or PDF when you want practice from your own material.")}
          </p>
        </div>

        {!result && !loading && (
          <Disclosure
            title={t("Use your own content")}
            description={t("YouTube, article, and PDF import for the source you already care about.")}
            nested
            defaultOpen
          >
            <div className="space-y-4">
              <SourcePicker
                value={sourceKind}
                disabled={loading}
                onChange={(kind) => {
                  if (result && !window.confirm(t("Discard the current Discover results?"))) return;
                  setSourceKind(kind);
                  setError(null);
                  setResult(null);
                  setCurationNote(null);
                }}
              />

              {sourceKind === "pdf" ? (
                <Field label={t("PDF file")} htmlFor="discover-pdf-input">
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
                <Field label={sourceKind === "article" ? t("Article link") : t("YouTube link")} htmlFor="discover-url-input">
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

              <Field label={t("English level")} className="max-w-52">
                <Select
                  value={targetLevel}
                  onChange={(value) => setTargetLevel(value as EnglishLevel)}
                  options={ENGLISH_LEVELS}
                  disabled={loading}
                />
              </Field>

              <Disclosure
                title={t("Advanced options")}
                description={t("Optional focus and AI choice for your own material.")}
                nested
              >
                <div className="space-y-4">
                  <Field
                    label={
                      <>
                        {t("Focus")} <span className="opacity-70">— {t("optional")}</span>
                      </>
                    }
                  >
                    <Input
                      type="text"
                      value={focus}
                      onChange={(event) => setFocus(event.target.value)}
                      placeholder={t("e.g., phrasal verbs, work vocabulary…")}
                    />
                  </Field>
                  <ProviderPicker selection={selection} disabled={loading} />
                </div>
              </Disclosure>

              {!providerReady && !settingsLoading && (
                <Notice tone="default" role="status">
                  {t("You can import a source and save hand-picked phrases now — no setup needed. To pick phrases automatically and add translations, connect an AI")}{" "}
                  {onOpenSettings ? (
                    <button onClick={onOpenSettings} className="underline hover:no-underline">
                      {t("in Settings →")}
                    </button>
                  ) : (
                    t("in Settings.")
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
                      ? t("Selecting…")
                      : transcribeProgress?.stage === "transcribe"
                        ? t("Transcribing… {percent}%", { percent: transcribeProgress.percent })
                        : transcribeProgress?.stage === "download"
                          ? t("Downloading audio…")
                          : sourceKind === "youtube"
                            ? t("Starting…")
                            : t("Extracting…")}
                  </>
                ) : (
                  t("Find phrases to learn")
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
            {t("Preparing audio discovery for the first time. This can take a minute.")}
          </div>
        )}

        {error && (
          <Notice tone="error" className="text-xs">
            <span>{error}</span>
            <span className="mt-1 block">
              {t("Caminho seguro: volte para a lição inicial ou abra Estudar para revisar o que já foi salvo.")}
            </span>
          </Notice>
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
          onGenerate={generateCards}
          onCancel={cancelGeneration}
          onToggleKeep={toggleKeep}
          onPlay={(index, segment) => void playClip(index, segment)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {deckPreview && (
        <DeckPreview
          title="Prévia dos cards de prática"
          data={deckPreview.data}
          defaultFilename={`${result?.title || "study-list"}.apkg`}
          persist={async (cards) => {
            await saveGeneratedDeck(cards, deckPreview.candidates);
            const activation = markFirstRunPhrasesSaved({ sourceId: result?.sourceId });
            void emitActivity("cards_created", { count: cards.length, source: "discover", activation });
            void emitActivity("own_source_completed", { cardsCreated: cards.length });
          }}
          onStudyNow={onStudyNow}
          onDismiss={() => setDeckPreview(null)}
        />
      )}
    </div>
  );
}
