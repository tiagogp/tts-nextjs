"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Spinner } from "@/components/ui/Spinner";
import Disclosure from "@/components/ui/Disclosure";
import ProviderBadge from "@/components/ui/ProviderBadge";
import { cn } from "@/lib/cn";
import { listItem, staggerContainer } from "@/lib/motion";
import { normalizeContext } from "@/lib/cards/context";
import type { ConversationTurn } from "@/lib/cards/provider";
import type { ErrorEvent } from "@/lib/cards/schema";
import {
  deleteConversation,
  getConversations,
  saveConversation,
  saveCorrectionDeck,
  type Conversation,
} from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { exportAndSaveDeck } from "@/features/cards/exportDeck";
import {
  evaluateCorrectionText,
  generateCorrectionDeck,
  transcribeAudio,
} from "@/features/correct/api";
import { sendConversationTurn, synthesizeSpeech } from "@/features/converse/api";
import {
  CONVERSATION_LEVELS,
  CONVERSATION_SCENARIOS,
  DEFAULT_LEVEL,
  type ConversationLevel,
} from "@/features/converse/constants";

/**
 * Phase 1 — in-app conversation practice. Speak (or type) with an AI partner in a chosen
 * scenario; the assistant text renders immediately and its audio plays after (best-effort).
 * The conversation persists per turn. Correction → cards happens in Phase 2.
 *
 * Gated like the Correct tab: the Local heuristic can't hold a conversation, so a model-backed
 * provider (Ollama, Claude, GPT) is required.
 */
export default function ConverseTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, hasEvaluator, selectedModel } = selection;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [past, setPast] = useState<Conversation[]>([]);
  const [scenarioId, setScenarioId] = useState<string>(CONVERSATION_SCENARIOS[0].id);
  const [customScenario, setCustomScenario] = useState("");
  const [level, setLevel] = useState<ConversationLevel>(DEFAULT_LEVEL);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Phase 2 — post-session review (find mistakes → cards). `review` is the conversation being
  // reviewed; null while in setup or an active chat.
  const [review, setReview] = useState<Conversation | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [reviewCarded, setReviewCarded] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns.length, busy]);

  // Load saved conversations so a session survives a reload — the data was always persisted,
  // this is what lets the user pick one back up. Newest first.
  const refreshPast = useCallback(async () => {
    try {
      const all = await getConversations();
      setPast(all.sort((a, b) => b.startedAt - a.startedAt));
    } catch {
      /* store unavailable (SSR / private mode) — leave the list empty */
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await refreshPast();
    };
    void load();
  }, [refreshPast]);

  const persist = useCallback((next: Conversation) => {
    setConversation(next);
    void saveConversation(next);
  }, []);

  const resume = useCallback((target: Conversation) => {
    // Re-activate: clear `endedAt` so continuing it counts as the same live session.
    setConversation({ ...target, endedAt: undefined });
    setTyped("");
    setNote(null);
  }, []);

  const removePast = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setPast((prev) => prev.filter((c) => c.id !== id));
    },
    [],
  );

  // Audio is optional — the text is already on screen — so swallow failures (e.g. the Kokoro
  // model isn't downloaded yet, or the browser blocks autoplay) instead of nagging.
  const playReply = useCallback(async (text: string) => {
    try {
      const blob = await synthesizeSpeech(text);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      await audioRef.current.play().catch(() => {});
    } catch {
      /* no-op: conversation continues without audio */
    }
  }, []);

  const evaluatorHint = !hasEvaluator
    ? provider === "local"
      ? "The Local provider can't hold a conversation. Choose Ollama, Claude, or GPT."
      : `${activeProvider?.label ?? "This provider"} is unavailable. Open Settings with the gear button to connect it.`
    : null;
  const cloudNote =
    activeProvider && !activeProvider.isLocal
      ? `Your turns are sent to ${activeProvider.label} to generate replies.`
      : null;

  const usingCustom = scenarioId === "custom";
  const activeScenario = CONVERSATION_SCENARIOS.find((s) => s.id === scenarioId);
  const customTrimmed = customScenario.trim();
  const canStart = hasEvaluator && (usingCustom ? customTrimmed.length > 0 : Boolean(activeScenario));

  const start = useCallback(async () => {
    if (busy || !canStart) return;
    const scenarioPrompt = usingCustom ? customTrimmed : activeScenario?.prompt;
    if (!scenarioPrompt) return;
    const fallbackContext = usingCustom
      ? normalizeContext(customTrimmed) ?? "conversation"
      : activeScenario?.context ?? "conversation";
    setBusy(true);
    setNote(null);
    try {
      const { reply } = await sendConversationTurn({
        provider,
        selectedModel,
        scenario: scenarioPrompt,
        level,
        history: [],
      });
      const conv: Conversation = {
        id: crypto.randomUUID(),
        scenario: scenarioPrompt,
        // The short situational tag (e.g. "restaurant"), not the long role-play prompt —
        // this is what weakness detection groups by and the review header shows.
        context: fallbackContext,
        targetLang: "en",
        sourceLang: "pt",
        level,
        turns: reply ? [{ role: "assistant", text: reply }] : [],
        startedAt: Date.now(),
      };
      persist(conv);
      if (reply) void playReply(reply);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Couldn't start the conversation.");
    } finally {
      setBusy(false);
    }
  }, [busy, canStart, usingCustom, customTrimmed, activeScenario, provider, selectedModel, level, persist, playReply]);

  const sendTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !conversation) return;
      setBusy(true);
      setNote(null);
      const withUser: Conversation = {
        ...conversation,
        turns: [...conversation.turns, { role: "user", text: trimmed }],
      };
      persist(withUser);
      void emitActivity("conversation_turn", {
        conversationId: conversation.id,
        scenarioId: conversation.context,
        turnIndex: withUser.turns.length - 1,
      });
      setTyped("");
      try {
        const { reply } = await sendConversationTurn({
          provider,
          selectedModel,
          scenario: conversation.scenario,
          level: conversation.level,
          history: withUser.turns,
        });
        if (reply) {
          const withReply: Conversation = {
            ...withUser,
            turns: [...withUser.turns, { role: "assistant", text: reply }],
          };
          persist(withReply);
          void playReply(reply);
        }
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : "Couldn't get a reply.");
      } finally {
        setBusy(false);
      }
    },
    [busy, conversation, provider, selectedModel, persist, playReply],
  );

  // Speech → text drops into the input so the learner can review/edit before sending
  // (human-in-the-loop, like the Correct tab). Off Apple Silicon, transcription fails
  // gracefully and they can just type.
  const transcribeBlob = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    setNote(null);
    try {
      const text = await transcribeAudio(blob);
      if (!text) {
        setNote("Couldn't make out any speech in that clip.");
        return;
      }
      setTyped((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) void transcribeBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setNote("Couldn't access the microphone. Check the browser's permission.");
    }
  }, [transcribeBlob]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // Phase 2 — run correction over just the learner's turns and stamp the conversation's
  // situational context onto every mistake found. Runs once per session; re-opening shows the
  // stored result instead of re-charging the provider.
  const correctReview = useCallback(
    async (conv: Conversation) => {
      const userText = conv.turns
        .filter((t) => t.role === "user")
        .map((t) => t.text)
        .join("\n")
        .trim();
      // Nothing the learner said → nothing to correct. Mark reviewed (empty) and move on.
      if (!userText) {
        const reviewed: Conversation = { ...conv, errors: [], correctedAt: Date.now() };
        setReview(reviewed);
        void saveConversation(reviewed);
        void refreshPast();
        return;
      }
      if (!hasEvaluator) {
        setReviewNote(evaluatorHint);
        return;
      }
      setCorrecting(true);
      setReviewNote(null);
      try {
        const errors = await evaluateCorrectionText({
          provider,
          selectedModel,
          text: userText,
          context: conv.context,
          level: conv.level,
        });
        const reviewed: Conversation = { ...conv, errors, correctedAt: Date.now() };
        setReview(reviewed);
        void saveConversation(reviewed);
        void refreshPast();
      } catch (err: unknown) {
        setReviewNote(err instanceof Error ? err.message : "Couldn't review the conversation.");
      } finally {
        setCorrecting(false);
      }
    },
    [hasEvaluator, evaluatorHint, provider, selectedModel, refreshPast],
  );

  const openReview = useCallback(
    (conv: Conversation) => {
      audioRef.current?.pause();
      setConversation(null);
      setTyped("");
      setNote(null);
      setReviewNote(null);
      setReviewCarded(false);
      const ended: Conversation = conv.endedAt ? conv : { ...conv, endedAt: Date.now() };
      setReview(ended);
      if (conv.correctedAt) {
        void saveConversation(ended);
        void refreshPast();
      } else {
        void correctReview(ended);
      }
    },
    [correctReview, refreshPast],
  );

  const finish = useCallback(() => {
    if (conversation) openReview(conversation);
  }, [conversation, openReview]);

  const generateReviewCards = useCallback(async () => {
    if (!review?.errors?.length || generating) return;
    const sourceErrors = review.errors;
    setGenerating(true);
    setReviewNote(null);
    try {
      // Same path as the Correct tab: build a vetted deck + .apkg for manual Anki import.
      const data = await generateCorrectionDeck({
        provider,
        selectedModel,
        events: sourceErrors,
        signal: new AbortController().signal,
      });
      const note = await exportAndSaveDeck(data, {
        defaultFilename: "PhraseLoop - Conversation.apkg",
        persist: (cards) => saveCorrectionDeck(cards, sourceErrors),
      });
      setReviewCarded(true);
      setReviewNote(note);
    } catch (err: unknown) {
      setReviewNote(err instanceof Error ? err.message : "Couldn't export the cards.");
    } finally {
      setGenerating(false);
    }
  }, [review, generating, provider, selectedModel]);

  const closeReview = useCallback(() => {
    setReview(null);
    setReviewNote(null);
    void refreshPast();
  }, [refreshPast]);

  // ───────────────────────── review (Phase 2) ─────────────────────────
  if (review) {
    const errors = review.errors;
    const userTurns = review.turns.filter((t) => t.role === "user").length;
    return (
      <div className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">
                Review · {review.context}
              </p>
              <p className="text-xs text-ink-muted">
                {userTurns} {userTurns === 1 ? "turn" : "turns"} you spoke
              </p>
            </div>
            <Button variant="secondary" onClick={closeReview} className="h-9 shrink-0">
              Done
            </Button>
          </div>

          {correcting ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4" /> Reviewing your mistakes…
            </p>
          ) : errors && errors.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
              No mistakes found — that already sounds natural. 🎉
            </p>
          ) : errors && errors.length > 0 ? (
            <>
              <ul className="space-y-2">
                {errors.map((e) => (
                  <ErrorRow key={e.id} error={e} />
                ))}
              </ul>
              <Button
                variant="primary"
                onClick={() => void generateReviewCards()}
                disabled={generating || reviewCarded}
                className="h-10"
              >
                {generating
                  ? "Exporting…"
                  : reviewCarded
                    ? "Exported ✓"
                    : `Export ${errors.length} card${errors.length === 1 ? "" : "s"} to Anki →`}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => void correctReview(review)}
              disabled={!hasEvaluator}
              className="h-10"
            >
              Find my mistakes →
            </Button>
          )}

          {reviewNote && (
            <p
              className={cn(
                "text-xs",
                reviewNote.includes("exported") || reviewNote.includes("🎉")
                  ? "text-ink-soft"
                  : "text-danger",
              )}
            >
              {reviewNote}
            </p>
          )}
          {!hasEvaluator && evaluatorHint && (
            <p className="text-xs text-ink-muted">
              {evaluatorHint}{" "}
              {onOpenSettings && provider !== "local" && (
                <button onClick={onOpenSettings} className="underline hover:no-underline">Open Settings →</button>
              )}
            </p>
          )}
        </Card>
      </div>
    );
  }

  // ───────────────────────── setup ─────────────────────────
  if (!conversation) {
    return (
      <div className="space-y-5">
        <Card className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Practice speaking</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Speak with an AI partner in a role-play. Keep going naturally; your mistakes become cards afterward.
          </p>
        </div>

        <Field label="Scenario">
          <div className="flex flex-wrap gap-1.5">
            {CONVERSATION_SCENARIOS.map((s) => (
              <Chip key={s.id} active={scenarioId === s.id} onClick={() => setScenarioId(s.id)}>
                {s.label}
              </Chip>
            ))}
            <Chip active={usingCustom} onClick={() => setScenarioId("custom")}>
              Custom…
            </Chip>
          </div>
        </Field>

        {usingCustom && (
          <Field label="Describe the situation">
            <Input
              type="text"
              value={customScenario}
              onChange={(e) => setCustomScenario(e.target.value)}
              placeholder="e.g. negotiating an apartment lease with a landlord"
            />
          </Field>
        )}

        <Field label="Level" hint="Sets how challenging your partner's English is.">
          <Segmented<ConversationLevel>
            label="CEFR level"
            value={level}
            onChange={setLevel}
            options={CONVERSATION_LEVELS.map((l) => ({ value: l, label: l }))}
          />
        </Field>

        {cloudNote && <p className="text-xs text-ink-muted">{cloudNote}</p>}
        {note && <p className="text-xs text-danger">{note}</p>}

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={start} disabled={!canStart || busy} className="h-10">
            {busy ? "Starting…" : "Start practice →"}
          </Button>
          {evaluatorHint && (
            <p className="text-xs text-ink-muted">
              {evaluatorHint}{" "}
              {onOpenSettings && provider !== "local" && (
                <button onClick={onOpenSettings} className="underline hover:no-underline">Open Settings →</button>
              )}
            </p>
          )}
        </div>

        <Disclosure
          title="Advanced options"
          description="Change the AI provider for this conversation."
          badge={activeProvider ? <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} /> : undefined}
          nested
        >
          <ProviderPicker selection={selection} disabled={busy} />
        </Disclosure>
        </Card>

        {past.length > 0 && (
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold tracking-[-0.01em] text-ink">Recent conversations</p>
            <ul className="space-y-2">
              {past.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{c.context}</p>
                    <p className="text-xs text-ink-muted">
                      {c.turns.length} {c.turns.length === 1 ? "turn" : "turns"} · {formatWhen(c.startedAt)}
                      {c.endedAt ? "" : " · in progress"}
                    </p>
                  </div>
                  {c.endedAt && <Chip onClick={() => openReview(c)}>Review</Chip>}
                  <Chip onClick={() => resume(c)}>Resume</Chip>
                  <button
                    type="button"
                    onClick={() => void removePast(c.id)}
                    className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-ink-muted opacity-60 transition-opacity hover:text-danger hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  // ───────────────────────── active conversation ─────────────────────────
  return (
    <Card className="flex min-h-[calc(100dvh-12rem)] flex-col overflow-hidden border-line-strong shadow-[0_18px_45px_rgb(17_17_17_/_0.08)] sm:min-h-[calc(100dvh-13rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            <p className="truncate text-base font-semibold tracking-[-0.01em] text-ink">
              {conversation.context}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            <span>{conversation.turns.length} {conversation.turns.length === 1 ? "turn" : "turns"}</span>
            {conversation.level && <span>Level {conversation.level}</span>}
            <span>{activeProvider?.label ?? "AI partner"}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={finish} className="h-9 shrink-0">
          Finish
        </Button>
      </div>

      <motion.ul
        className="flex-1 space-y-4 overflow-y-auto bg-card px-4 py-5 app-scroll-region sm:px-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        aria-live="polite"
      >
        {conversation.turns.map((turn, i) => (
          <TurnBubble key={i} turn={turn} />
        ))}
        {busy && (
          <li className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted shadow-sm">
            <Spinner className="h-3.5 w-3.5" /> Thinking…
          </li>
        )}
        <div ref={bottomRef} />
      </motion.ul>

      <div className="space-y-2 border-t border-line bg-surface p-3 sm:p-4">
        {note && <p className="text-xs text-danger">{note}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            onClick={recording ? stopRecording : startRecording}
            disabled={busy || transcribing}
            className={cn("h-11 shrink-0 gap-2 sm:w-auto", recording && "border-danger text-danger")}
          >
            {recording ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                Stop
              </>
            ) : transcribing ? (
              <>
                <Spinner className="h-4 w-4" />
                …
              </>
            ) : (
              <>
                <MicrophoneIcon />
                Speak
              </>
            )}
          </Button>
          <Input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendTurn(typed);
              }
            }}
            placeholder="Type your reply, or tap Speak…"
            disabled={busy}
            className="h-11 flex-1"
          />
          <Button
            variant="primary"
            onClick={() => void sendTurn(typed)}
            disabled={!typed.trim() || busy}
            className="h-11 shrink-0 sm:min-w-24"
          >
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Short relative-ish stamp for the recent list: "today", "yesterday", else a date. */
function formatWhen(ts: number): string {
  const dayMs = 86_400_000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday - new Date(ts).setHours(0, 0, 0, 0)) / dayMs);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

function ErrorRow({ error }: { error: ErrorEvent }) {
  return (
    <li className="rounded-lg border border-line p-3">
      <p className="text-sm text-ink-muted line-through">{error.original}</p>
      <p className="text-sm text-ink">{error.corrected}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {error.errorTypes.map((t) => (
          <span
            key={t}
            className="rounded border border-line px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-muted"
          >
            {t}
          </span>
        ))}
      </div>
      {error.rationale && <p className="mt-1.5 text-xs text-ink-muted">{error.rationale}</p>}
    </li>
  );
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === "user";
  return (
    <motion.li variants={listItem} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[76%]",
          isUser
            ? "rounded-br-md bg-off-black text-white"
            : "rounded-bl-md border border-line bg-surface text-ink",
        )}
      >
        {turn.text}
      </div>
    </motion.li>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}
