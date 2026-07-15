"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Notice";
import Disclosure from "@/components/ui/Disclosure";
import ProviderBadge from "@/components/ui/ProviderBadge";
import { cn } from "@/lib/cn";
import { listItem, staggerContainer } from "@/lib/motion";
import { normalizeContext } from "@/lib/cards/context";
import type { ConversationTurn } from "@/lib/cards/provider";
import type { AdvancedReview } from "@/lib/cards/schema";
import {
  deleteConversation,
  getConversations,
  saveConversation,
  saveCorrectionDeck,
  saveAudioRecording,
  saveProductionAttempt,
  saveRetryOutcome,
  getMethodProgression,
  getErrorEvents,
  type Conversation,
} from "@/lib/store/repository";
import type { ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import { selectFamiliarTopic, supportForProgression, type MethodProgressionState } from "@/features/method/progression";
import { selectRecurringError } from "@/features/pronunciation/speakingDrill";
import { emitActivity } from "@/lib/store/activityLog";
import { useStageTimer } from "@/features/method/useStageTimer";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { exportAndSaveDeck } from "@/features/cards/exportDeck";
import {
  generateCorrectionDeck,
  reviewAdvancedText,
  transcribeAudio,
} from "@/features/correct/api";
import { NaturalnessReview } from "@/features/correct/components/NaturalnessReview";
import { countPolishFeedback, focusFeedback, prioritizeFeedback, type FeedbackIssue } from "@/features/correct/feedbackContract";
import { sendConversationTurn, synthesizeSpeech } from "@/features/converse/api";
import { getLearnerLangs } from "@/features/settings/learningProfile";
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
 * Gated like the Correct tab: a configured, available provider (OpenRouter, Ollama, Claude, GPT)
 * is required to hold a conversation.
 */
export default function ConverseTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, hasEvaluator, selectedModel } = selection;
  const speakTimer = useStageTimer("speak", 2);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [past, setPast] = useState<Conversation[]>([]);
  const [scenarioId, setScenarioId] = useState<string>(CONVERSATION_SCENARIOS[0].id);
  const [customScenario, setCustomScenario] = useState("");
  const [level, setLevel] = useState<ConversationLevel>(() => getLearnerLangs().level || DEFAULT_LEVEL);
  const [challenge, setChallenge] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Free talk = hands-free: after each AI reply the mic auto-opens and silence detection
  // (a "debounce" on quiet) decides when you've finished and sends your turn automatically.
  const [freeTalk, setFreeTalk] = useState(false);
  const [progression, setProgression] = useState<MethodProgressionState | undefined>();
  const [recurringError, setRecurringError] = useState<Awaited<ReturnType<typeof getErrorEvents>>[number] | undefined>();
  const progressionSupport = supportForProgression(progression);

  // Phase 2 — post-session review (find mistakes → cards). `review` is the conversation being
  // reviewed; null while in setup or an active chat.
  const [review, setReview] = useState<Conversation | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [reviewCarded, setReviewCarded] = useState(false);
  const [retryText, setRetryText] = useState("");
  const [retryChecking, setRetryChecking] = useState(false);
  const [retryReview, setRetryReview] = useState<AdvancedReview | null>(null);
  const [retryResolution, setRetryResolution] = useState<"pending" | "completed" | "deferred" | "dismissed">("pending");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // VAD (voice-activity detection) plumbing for free-talk listening.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  // Refs bridge the start↔listen↔send cycle so the callbacks below don't need to
  // depend on each other (which would create a definition-order knot).
  const freeTalkRef = useRef(freeTalk);
  const sendTurnRef = useRef<(text: string, spoken?: boolean) => void>(() => {});
  const typedInputWasSpokenRef = useRef(false);
  const retrySpokenRef = useRef(false);
  const retryBlobRef = useRef<Blob | null>(null);
  const listenRef = useRef<() => void>(() => {});

  const retryAudio = useCorrectionAudio({
    onNote: setReviewNote,
    onText: (updater) => {
      retrySpokenRef.current = true;
      setRetryText(updater);
      setRetryReview(null);
    },
    onBlob: (blob) => {
      retryBlobRef.current = blob;
    },
  });
  const {
    recording: retryRecording,
    transcribing: retryTranscribing,
    startRecording: startRetryRecording,
    stopRecording: stopRetryRecording,
  } = retryAudio;
  useEffect(() => {
    freeTalkRef.current = freeTalk;
  }, [freeTalk]);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
      void audioCtxRef.current?.close().catch(() => {});
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    const loadProfileLevel = () => setLevel(getLearnerLangs().level);
    window.addEventListener("phraseloop:profile-updated", loadProfileLevel);
    return () => window.removeEventListener("phraseloop:profile-updated", loadProfileLevel);
  }, []);

  useEffect(() => {
    const loadProgression = () => {
      void Promise.all([getMethodProgression(), getErrorEvents()])
        .then(([nextProgression, errors]) => {
          setProgression(nextProgression);
          setRecurringError(selectRecurringError(errors));
        })
        .catch(() => undefined);
    };
    loadProgression();
    window.addEventListener("phraseloop:progress-updated", loadProgression);
    window.addEventListener("phraseloop:activity", loadProgression);
    return () => {
      window.removeEventListener("phraseloop:progress-updated", loadProgression);
      window.removeEventListener("phraseloop:activity", loadProgression);
    };
  }, []);

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

  // Synthesize the reply's audio and stage it on the shared <audio> element, returning it ready
  // to play. We await this *before* revealing the assistant bubble so text and voice land
  // together. Audio is optional (Kokoro may not be downloaded, etc.), so failures return null
  // and the conversation continues silently.
  const synthReply = useCallback(async (text: string): Promise<HTMLAudioElement | null> => {
    try {
      const blob = await synthesizeSpeech(text);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  // Play the staged reply. In free talk we auto-open the mic once the AI has finished speaking
  // (or immediately, if there's no audio) so the learner can answer hands-free.
  const speak = useCallback((audio: HTMLAudioElement | null) => {
    const relisten = () => {
      if (freeTalkRef.current) listenRef.current();
    };
    if (!audio) {
      relisten();
      return;
    }
    audio.onended = relisten;
    void audio.play().catch(relisten);
  }, []);

  const evaluatorHint = !hasEvaluator
    ? `${activeProvider?.label ?? "No provider"} is unavailable. Open Settings with the gear button to connect one.`
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
    const familiarTopic = !usingCustom && activeScenario?.id === "personal-update"
      ? selectFamiliarTopic(
          past.map((item) => ({ topicId: item.topicId, context: item.context, createdAt: item.startedAt })),
          Date.now(),
          progressionSupport.conversation.familiarTopicCadenceDays,
        )
      : undefined;
    const scenarioPrompt = usingCustom
      ? customTrimmed
      : activeScenario?.prompt && familiarTopic
        ? `${activeScenario.prompt} Revisit the familiar topic “${familiarTopic.label}” today. ${familiarTopic.prompt}`
        : activeScenario?.prompt;
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
        challenge,
        history: [],
        conversationStage: progressionSupport.speaking.stage,
        maxTurns: progressionSupport.conversation.maxTurns,
        followUpDepth: progressionSupport.conversation.followUpDepth,
        promptStyle: recurringError
          ? `${progressionSupport.conversation.promptStyle} Revisit this recurring correction naturally: ${recurringError.corrected}`
          : progressionSupport.conversation.promptStyle,
        speakerFamiliarity: progressionSupport.listening.speakerFamiliarity,
      });
      // Hold the "Starting…" state through TTS so the greeting bubble and its voice appear together.
      const audio = reply ? await synthReply(reply) : null;
      const conv: Conversation = {
        id: crypto.randomUUID(),
        scenario: scenarioPrompt,
        // The short situational tag (e.g. "restaurant"), not the long role-play prompt —
        // this is what weakness detection groups by and the review header shows.
        context: fallbackContext,
        targetLang: getLearnerLangs().targetLang,
        sourceLang: getLearnerLangs().nativeLang,
        level,
        challenge,
        progressionStage: progressionSupport.speaking.stage,
        topicId: familiarTopic?.id,
        turns: reply ? [{ role: "assistant", text: reply }] : [],
        startedAt: Date.now(),
      };
      persist(conv);
      if (reply) speak(audio);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Couldn't start the conversation.");
    } finally {
      setBusy(false);
    }
  }, [busy, canStart, usingCustom, customTrimmed, activeScenario, past, provider, selectedModel, level, challenge, persist, synthReply, speak, progressionSupport, recurringError]);

  const sendTurn = useCallback(
    async (text: string, spoken = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !conversation) return;
      const learnerTurns = conversation.turns.filter((turn) => turn.role === "user").length;
      if (learnerTurns >= progressionSupport.conversation.maxTurns) {
        setNote(`This ${progressionSupport.speaking.stage.replaceAll("_", " ")} practice is complete. Finish it to review your output.`);
        return;
      }
      setBusy(true);
      setNote(null);
      const withUser: Conversation = {
        ...conversation,
        turns: [...conversation.turns, { role: "user", text: trimmed, spoken }],
      };
      persist(withUser);
      void emitActivity("conversation_turn", {
        conversationId: conversation.id,
        scenarioId: conversation.context,
        turnIndex: withUser.turns.length - 1,
      });
      // Stage 5 — original production, as opposed to the `repeat` stage's imitation.
      // One window per turn: commit this turn, then reopen for the next.
      const speakMinutes = speakTimer.commit();
      speakTimer.start();
      void emitActivity("method_stage", {
        stage: "speak",
        area: "speaking",
        source: "converse",
        minutes: speakMinutes,
        subjectId: conversation.id,
      });
      setTyped("");
      typedInputWasSpokenRef.current = false;
      try {
        const { reply } = await sendConversationTurn({
          provider,
          selectedModel,
          scenario: conversation.scenario,
          targetLang: conversation.targetLang,
          level: conversation.level,
          challenge: conversation.challenge,
          history: withUser.turns,
          conversationStage: progressionSupport.speaking.stage,
          maxTurns: progressionSupport.conversation.maxTurns,
          followUpDepth: progressionSupport.conversation.followUpDepth,
          promptStyle: recurringError
            ? `${progressionSupport.conversation.promptStyle} Revisit this recurring correction naturally: ${recurringError.corrected}`
            : progressionSupport.conversation.promptStyle,
          speakerFamiliarity: progressionSupport.listening.speakerFamiliarity,
        });
        if (reply) {
          // Stage the audio first, then reveal the bubble + play together (kept in sync).
          const audio = await synthReply(reply);
          const withReply: Conversation = {
            ...withUser,
            turns: [...withUser.turns, { role: "assistant", text: reply }],
          };
          persist(withReply);
          speak(audio);
        }
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : "Couldn't get a reply.");
      } finally {
        setBusy(false);
      }
    },
    [busy, conversation, provider, selectedModel, persist, synthReply, speak, speakTimer, progressionSupport, recurringError],
  );
  useEffect(() => {
    sendTurnRef.current = sendTurn;
  }, [sendTurn]);

  // Speech → text. In guided mode it drops into the input so the learner can review/edit before
  // sending (human-in-the-loop, like the Correct tab); in free talk we send it straight away.
  // Off Apple Silicon, transcription fails gracefully and they can just type.
  const transcribeBlob = useCallback(async (blob: Blob, opts?: { autoSend?: boolean }) => {
    setTranscribing(true);
    setNote(null);
    try {
      const text = await transcribeAudio(blob);
      if (!text) {
        setNote("Couldn't make out any speech in that clip.");
        return;
      }
      if (opts?.autoSend) {
        sendTurnRef.current(text, true);
      } else {
        typedInputWasSpokenRef.current = true;
        setTyped((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      }
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  // Tear down the VAD analyser loop. Safe to call repeatedly.
  const cleanupVad = useCallback(() => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    vadFrameRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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

  // Free-talk listening: open the mic and watch the input level. Once speech has been heard,
  // a sustained quiet stretch (SILENCE_MS — the "debounce") ends the turn and auto-sends it.
  // If no speech arrives at all within NO_SPEECH_MS, we quietly give up so we don't loop forever.
  const startListening = useCallback(async () => {
    if (recorderRef.current) return; // already listening/recording
    setNote(null);
    discardRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        cleanupVad();
        recorderRef.current = null;
        setRecording(false);
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) void transcribeBlob(blob, { autoSend: true });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const SPEECH_RMS = 0.025; // ~normal speaking volume; tuned against ambient noise
      const SILENCE_MS = 1500; // quiet stretch that counts as "done talking"
      const NO_SPEECH_MS = 9000; // give up if they never start
      const startedAt = performance.now();
      let heardSpeech = false;
      let silenceSince = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();

        if (rms > SPEECH_RMS) {
          heardSpeech = true;
          silenceSince = 0;
        } else if (heardSpeech) {
          if (!silenceSince) silenceSince = now;
          else if (now - silenceSince > SILENCE_MS) {
            recorderRef.current?.stop(); // → onstop → transcribe + auto-send
            return;
          }
        } else if (now - startedAt > NO_SPEECH_MS) {
          discardRef.current = true; // nothing said — bail without a wasted transcription
          recorderRef.current?.stop();
          return;
        }
        vadFrameRef.current = requestAnimationFrame(tick);
      };
      vadFrameRef.current = requestAnimationFrame(tick);
    } catch {
      cleanupVad();
      setRecording(false);
      setNote("Couldn't access the microphone. Check the browser's permission.");
    }
  }, [transcribeBlob, cleanupVad]);
  useEffect(() => {
    listenRef.current = startListening;
  }, [startListening]);

  const stopRecording = useCallback(() => {
    // In free talk a manual stop is a cancel — discard rather than send a half-formed turn.
    if (vadFrameRef.current || audioCtxRef.current) discardRef.current = true;
    cleanupVad();
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, [cleanupVad]);

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
        const correctedAt = Date.now();
        const reviewed: Conversation = {
          ...conv,
          errors: [],
          advancedReview: { errors: [], refinements: [] },
          correctedAt,
        };
        const productionAttempt: ProductionAttempt = {
          id: conv.id,
          source: "conversation",
          stage: "production",
          context: conv.context,
          prompt: conv.scenario,
          text: userText,
          spoken: conv.turns.some((turn) => turn.role === "user" && turn.spoken),
          wordCount: userText.split(/\s+/).filter(Boolean).length,
          finished: true,
          issueCount: 0,
          createdAt: correctedAt,
        };
        void saveProductionAttempt(productionAttempt).catch(() => {});
        setReview(reviewed);
        setRetryResolution("completed");
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
        const advanced = await reviewAdvancedText({
          provider,
          selectedModel,
          text: userText,
          context: conv.context,
          level: conv.level,
        });
        const reviewed: Conversation = {
          ...conv,
          errors: advanced.errors,
          advancedReview: advanced,
          correctedAt: Date.now(),
        };
        const productionAttempt: ProductionAttempt = {
          id: conv.id,
          source: "conversation",
          stage: "production",
          context: conv.context,
          prompt: conv.scenario,
          text: userText,
          spoken: conv.turns.some((turn) => turn.role === "user" && turn.spoken),
          wordCount: userText.split(/\s+/).filter(Boolean).length,
          finished: true,
          issueCount: advanced.errors.length,
          createdAt: reviewed.correctedAt ?? Date.now(),
        };
        void saveProductionAttempt(productionAttempt).catch(() => {});
        void emitActivity("production_attempt", {
          attemptId: productionAttempt.id,
          source: productionAttempt.source,
          context: productionAttempt.context,
          prompt: productionAttempt.prompt,
          text: productionAttempt.text,
          spoken: productionAttempt.spoken,
          wordCount: productionAttempt.wordCount,
          finished: productionAttempt.finished,
          issueCount: productionAttempt.issueCount,
          createdAt: productionAttempt.createdAt,
        }).catch(() => {});
        setReview(reviewed);
        setRetryResolution(advanced.errors.length > 0 ? "pending" : "completed");
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
      if (audioRef.current) audioRef.current.onended = null; // don't re-arm the mic after we leave
      stopRecording();
      setConversation(null);
      setTyped("");
      setNote(null);
      setReviewNote(null);
      setReviewCarded(false);
      setRetryText("");
      setRetryReview(null);
      setRetryResolution("pending");
      retrySpokenRef.current = false;
      retryBlobRef.current = null;
      stopRetryRecording();
      const ended: Conversation = conv.endedAt ? conv : { ...conv, endedAt: Date.now() };
      setReview(ended);
      if (conv.correctedAt) {
        void saveConversation(ended);
        void refreshPast();
      } else {
        void correctReview(ended);
      }
    },
    [correctReview, refreshPast, stopRecording, stopRetryRecording],
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
    setRetryText("");
    setRetryReview(null);
    setRetryResolution("pending");
    retrySpokenRef.current = false;
    retryBlobRef.current = null;
    stopRetryRecording();
    void refreshPast();
  }, [refreshPast, stopRetryRecording]);

  const checkConversationRetry = useCallback(async () => {
    const text = retryText.trim();
    if (!text || retryChecking || !hasEvaluator || !review) return;
    setRetryChecking(true);
    setReviewNote(null);
    try {
      const next = await reviewAdvancedText({
        provider,
        selectedModel,
        text,
        context: review.context,
        level: review.level,
      });
      setRetryReview(next);
      setRetryResolution(next.errors.length === 0 ? "completed" : "pending");
      const attemptId = crypto.randomUUID();
      const createdAt = Date.now();
      const wordCount = text.split(/\s+/).length;
      const spoken = retrySpokenRef.current;
      const recordingId = spoken && retryBlobRef.current ? crypto.randomUUID() : undefined;
      if (recordingId && retryBlobRef.current) {
        await saveAudioRecording({
          id: recordingId,
          blob: retryBlobRef.current,
          mimeType: retryBlobRef.current.type || "audio/webm",
          sizeBytes: retryBlobRef.current.size,
          createdAt,
        }).catch(() => undefined);
      }
      const productionAttempt: ProductionAttempt = {
        id: attemptId,
        source: "conversation",
        context: review.context,
        prompt: review.scenario,
        text,
        spoken,
        wordCount,
        finished: true,
        issueCount: next.errors.length,
        recordingId,
        createdAt,
      };
      const retryOutcome: RetryOutcome = {
        id: crypto.randomUUID(),
        retryOf: review.id,
        feedbackIds: focusFeedback(prioritizeFeedback(review.errors ?? [])).map((issue) => issue.event.id),
        source: "conversation",
        text,
        spoken,
        wordCount,
        resolved: next.errors.length === 0,
        resolution: next.errors.length === 0 ? "completed" : undefined,
        issueCount: next.errors.length,
        createdAt,
      };
      void saveProductionAttempt(productionAttempt).catch(() => {});
      void saveRetryOutcome(retryOutcome).catch(() => {});
      void emitActivity("production_attempt", {
        attemptId: productionAttempt.id,
        source: "conversation",
        context: review.context,
        prompt: review.scenario,
        text,
        spoken,
        recordingId,
        wordCount: productionAttempt.wordCount,
        finished: true,
        issueCount: productionAttempt.issueCount,
        createdAt: productionAttempt.createdAt,
      }).catch(() => {});
      void emitActivity("retry_outcome", {
        attemptId: retryOutcome.id,
        retryOf: retryOutcome.retryOf,
        feedbackIds: retryOutcome.feedbackIds,
        source: "conversation",
        text,
        spoken,
        wordCount: retryOutcome.wordCount,
        resolved: retryOutcome.resolved,
        resolution: retryOutcome.resolved ? "completed" : undefined,
        issueCount: retryOutcome.issueCount,
        createdAt: retryOutcome.createdAt,
      }).catch(() => {});
    } catch (err: unknown) {
      setReviewNote(err instanceof Error ? err.message : "Couldn't check the retry.");
    } finally {
      setRetryChecking(false);
    }
  }, [hasEvaluator, provider, retryChecking, retryText, review, selectedModel]);

  const deferConversationRetry = useCallback(() => {
    if (!review || !review.errors?.length) return;
    const outcome: RetryOutcome = {
      id: crypto.randomUUID(),
      retryOf: review.id,
      feedbackIds: focusFeedback(prioritizeFeedback(review.errors)).map((issue) => issue.event.id),
      source: "conversation",
      text: "",
      spoken: false,
      wordCount: 0,
      resolved: false,
      resolution: "deferred",
      issueCount: review.errors.length,
      createdAt: Date.now(),
    };
    void saveRetryOutcome(outcome).catch(() => {});
    void emitActivity("retry_outcome", {
      attemptId: outcome.id,
      retryOf: outcome.retryOf,
      feedbackIds: outcome.feedbackIds,
      source: outcome.source,
      text: outcome.text,
      spoken: outcome.spoken,
      wordCount: outcome.wordCount,
      resolved: false,
      resolution: "deferred",
      issueCount: outcome.issueCount,
      createdAt: outcome.createdAt,
    }).catch(() => {});
    setRetryResolution("deferred");
  }, [review]);

  const dismissConversationRetry = useCallback(() => {
    if (!review || !review.errors?.length) return;
    const outcome: RetryOutcome = {
      id: crypto.randomUUID(),
      retryOf: review.id,
      feedbackIds: focusFeedback(prioritizeFeedback(review.errors)).map((issue) => issue.event.id),
      source: "conversation",
      text: "",
      spoken: false,
      wordCount: 0,
      resolved: false,
      resolution: "dismissed",
      issueCount: review.errors.length,
      createdAt: Date.now(),
    };
    void saveRetryOutcome(outcome).catch(() => {});
    void emitActivity("retry_outcome", {
      attemptId: outcome.id,
      retryOf: outcome.retryOf,
      feedbackIds: outcome.feedbackIds,
      source: outcome.source,
      text: outcome.text,
      spoken: outcome.spoken,
      wordCount: outcome.wordCount,
      resolved: false,
      resolution: "dismissed",
      issueCount: outcome.issueCount,
      createdAt: outcome.createdAt,
    }).catch(() => {});
    setRetryResolution("dismissed");
  }, [review]);

  // ───────────────────────── review (Phase 2) ─────────────────────────
  if (review) {
    const errors = review.errors;
    const allPrioritizedErrors = prioritizeFeedback(errors ?? []);
    const prioritizedErrors = focusFeedback(allPrioritizedErrors);
    const polishCount = countPolishFeedback(allPrioritizedErrors);
    const advanced = review.advancedReview;
    const refinements = advanced?.refinements ?? [];
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
                <Button variant="secondary" onClick={closeReview} disabled={Boolean(errors?.length) && retryResolution === "pending"} className="h-9 shrink-0">
              Done
            </Button>
          </div>

          {correcting ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4" /> Reviewing your mistakes…
            </p>
          ) : errors && errors.length === 0 ? (
            <>
              <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
                {refinements.length > 0
                  ? "No errors found. A few native-sounding upgrades are below."
                  : "No mistakes found — that already sounds natural. 🎉"}
              </p>
              <NaturalnessReview refinements={refinements} overall={advanced?.overall} />
            </>
          ) : errors && errors.length > 0 ? (
            <>
              <ul className="space-y-2">
                {prioritizedErrors.map((issue) => (
                  <ErrorRow key={issue.event.id} issue={issue} />
                ))}
              </ul>
              {polishCount > 0 && (
                <details className="rounded border border-line px-3 py-2 text-xs text-ink-muted">
                  <summary className="cursor-pointer">Show {polishCount} minor polish issue{polishCount === 1 ? "" : "s"}</summary>
                  <ul className="mt-2 space-y-2">
                    {allPrioritizedErrors.filter((issue) => issue.priority === "polish").map((issue) => (
                      <ErrorRow key={issue.event.id} issue={issue} />
                    ))}
                  </ul>
                </details>
              )}
              <NaturalnessReview refinements={refinements} overall={advanced?.overall} />
              <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Try the important correction again</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Rewrite one or two ideas in the same {review.context} situation. Minor polish does not block completion.
                  </p>
                </div>
                <textarea
                  value={retryText}
                  onChange={(event) => {
                    retrySpokenRef.current = false;
                    retryBlobRef.current = null;
                    setRetryText(event.target.value);
                    setRetryReview(null);
                  }}
                  rows={3}
                  placeholder="Write your improved response here…"
                  className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={retryChecking}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={retryRecording ? "primary" : "secondary"}
                    onClick={() => (retryRecording ? stopRetryRecording() : void startRetryRecording())}
                    disabled={retryChecking || retryTranscribing}
                    aria-pressed={retryRecording}
                  >
                    {retryTranscribing ? "Transcribing…" : retryRecording ? "Stop recording" : "Speak retry"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void checkConversationRetry()}
                    disabled={!retryText.trim() || retryChecking || retryTranscribing || !hasEvaluator}
                  >
                    {retryChecking ? "Checking retry…" : "Check my retry"}
                  </Button>
                </div>
                {retryReview && (
                  <Notice tone={retryReview.errors.length === 0 ? "success" : "warning"}>
                    {retryReview.errors.length === 0
                      ? "Your retry applies the important feedback in this situation."
                      : `${retryReview.errors.length} issue${retryReview.errors.length === 1 ? "" : "s"} remain. Compare with the corrections above and try again if useful.`}
                  </Notice>
                )}
                {retryResolution === "deferred" ? (
                  <Notice tone="default">This retry is deferred for a later review.</Notice>
                ) : retryResolution === "dismissed" ? (
                  <Notice tone="default">This retry was explicitly dismissed.</Notice>
                ) : retryResolution === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={deferConversationRetry} disabled={retryChecking}>
                      Defer retry for later
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={dismissConversationRetry}
                      disabled={retryChecking}
                    >
                      Dismiss retry
                    </Button>
                  </div>
                ) : null}
              </div>
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
              {onOpenSettings && (
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

        <Notice tone="default" className="space-y-1">
          <p className="text-sm font-medium text-ink">
            Speaking stage: {progressionSupport.speaking.stage.replaceAll("_", " ")}
          </p>
          <p className="text-xs text-ink-soft">{progressionSupport.speaking.guidance}</p>
          <p className="text-xs text-ink-muted">
            This practice uses up to {progressionSupport.conversation.maxTurns} learner turns with {progressionSupport.conversation.followUpDepth} follow-ups.
          </p>
        </Notice>

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
            className="flex-wrap"
          />
        </Field>

        <Field label="Partner" hint="Supportive keeps the role-play simple. Challenging asks follow-ups and pushes your reasoning.">
          <Segmented<"supportive" | "challenging">
            label="Conversation partner style"
            value={challenge ? "challenging" : "supportive"}
            onChange={(v) => setChallenge(v === "challenging")}
            options={[
              { value: "supportive", label: "Supportive" },
              { value: "challenging", label: "Challenging" },
            ]}
          />
        </Field>

        <Field
          label="Mode"
          hint={
            freeTalk
              ? "Free talk: the mic opens after each reply and sends when you pause — fully hands-free."
              : "Guided: tap Speak (or type), review, then send each turn yourself."
          }
        >
          <Segmented<"guided" | "free">
            label="Conversation mode"
            value={freeTalk ? "free" : "guided"}
            onChange={(v) => setFreeTalk(v === "free")}
            options={[
              { value: "guided", label: "Guided" },
              { value: "free", label: "Free talk" },
            ]}
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
              {onOpenSettings && (
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
    <Card className="flex h-[calc(100dvh-12rem)] flex-col overflow-hidden border-line-strong shadow-[0_18px_45px_rgb(17_17_17_/_0.08)] sm:h-[calc(100dvh-13rem)]">
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
            {conversation.challenge && <span className="text-accent">Challenging</span>}
            {conversation.progressionStage && <span>{conversation.progressionStage.replaceAll("_", " ")}</span>}
            {freeTalk && <span className="text-accent">Free talk</span>}
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
        <p className="text-[11px] text-ink-muted">
          {conversation.turns.filter((turn) => turn.role === "user").length}/{progressionSupport.conversation.maxTurns} speaking turns · {progressionSupport.conversation.promptStyle}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            onClick={recording ? stopRecording : freeTalk ? startListening : startRecording}
            disabled={busy || transcribing}
            className={cn("h-11 shrink-0 gap-2 sm:w-auto", recording && "border-danger text-danger")}
          >
            {recording ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                {freeTalk ? "Listening…" : "Stop"}
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
            onChange={(e) => {
              typedInputWasSpokenRef.current = false;
              setTyped(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendTurn(typed, typedInputWasSpokenRef.current);
              }
            }}
            placeholder="Type your reply, or tap Speak…"
            disabled={busy}
            className="h-11 flex-1"
          />
          <Button
            variant="primary"
            onClick={() => void sendTurn(typed, typedInputWasSpokenRef.current)}
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

function ErrorRow({ issue }: { issue: FeedbackIssue }) {
  const { event: error } = issue;
  return (
    <li className="rounded-lg border border-line p-3">
      <p className="text-sm text-ink-muted line-through">{error.original}</p>
      <p className="text-sm text-ink">{error.corrected}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-accent/30 px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">
          {issue.priority}
        </span>
        <span className="rounded border border-line px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-muted">
          {issue.category}
        </span>
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
