"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useT } from "@/i18n/I18nProvider";
import { listItem, staggerContainer } from "@/lib/motion";
import { normalizeContext } from "@/lib/cards/context";
import { isRepertoireLevel } from "@/lib/cards/shared";
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
import {
  SPEAKING_STAGE_LABEL,
  selectFamiliarTopic,
  stageLabel,
  supportForProgression,
  type MethodProgressionState,
} from "@/features/method/progression";
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
import LocalModelNotice from "@/features/speech/components/LocalModelNotice";
import { useWhisperModel } from "@/features/speech/hooks/useLocalModel";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import {
  CONVERSATION_LEVELS,
  CONVERSATION_SCENARIOS,
  DEFAULT_LEVEL,
  type ConversationLevel,
  type ConversationScenario,
} from "@/features/converse/constants";
import {
  detectRepertoireUse,
  markRepertoireUsed,
  mergeRepertoire,
  parseRepertoire,
  recentTaughtExpressions,
  repertoireUptake,
  segmentRepertoire,
  unusedRepertoire,
  type RepertoireItem,
} from "@/features/converse/repertoire";
import { advanceVad, computeRms, createVadState, silenceCountdownSeconds } from "@/features/converse/vad";
import { RepertoirePanel } from "@/features/converse/components/RepertoirePanel";
import { RepertoireRecall } from "@/features/converse/components/RepertoireRecall";

/**
 * Phase 1 — in-app conversation practice. Speak (or type) with an AI partner in a chosen
 * scenario; the assistant text renders immediately and its audio plays after (best-effort).
 * The conversation persists per turn. Correction → cards happens in Phase 2.
 *
 * Gated like the Correct tab: a configured, available provider (OpenRouter, Ollama, Claude, GPT)
 * is required to hold a conversation.
 */
/**
 * How many still-unused expressions the partner is asked to make room for in one turn. Two is
 * enough to give it a choice of openings; more and every reply starts fishing for a phrase.
 */
const ELICIT_PER_TURN = 2;

export interface ConverseTabProps {
  onOpenSettings?: () => void;
  /** Starter scenarios offered as chips. Defaults to the everyday role-play set. */
  scenarios?: ConversationScenario[];
  /** Lead with the free-text topic field and demote the chips to suggestions. */
  topicFirst?: boolean;
  /** Open in hands-free mode instead of guided turn-taking. */
  defaultFreeTalk?: boolean;
}

export default function ConverseTab({
  onOpenSettings,
  scenarios = CONVERSATION_SCENARIOS,
  topicFirst = false,
  defaultFreeTalk = false,
}: ConverseTabProps) {
  const { t } = useT();
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, hasEvaluator, selectedModel } = selection;
  const speakTimer = useStageTimer("speak", 2);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [past, setPast] = useState<Conversation[]>([]);
  const [scenarioId, setScenarioId] = useState<string>(() => (topicFirst ? "custom" : scenarios[0].id));
  const [customScenario, setCustomScenario] = useState("");
  const [level, setLevel] = useState<ConversationLevel>(() => getLearnerLangs().level || DEFAULT_LEVEL);
  const [challenge, setChallenge] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Speaking a turn goes through Whisper; free talk depends on it entirely. Show
  // the one-time install next to the mic instead of failing the first turn.
  const whisper = useWhisperModel();
  const [note, setNote] = useState<string | null>(null);
  // Free talk = hands-free: after each AI reply the mic auto-opens and silence detection
  // (a "debounce" on quiet) decides when you've finished and sends your turn automatically.
  const [freeTalk, setFreeTalk] = useState(defaultFreeTalk);
  const [progression, setProgression] = useState<MethodProgressionState | undefined>();
  const [recurringError, setRecurringError] = useState<Awaited<ReturnType<typeof getErrorEvents>>[number] | undefined>();
  // The declared level raises the conversation floor: a C1/C2 learner with no recorded evidence
  // would otherwise get the 4-turn beginner shape. See `supportForProgression`.
  const progressionSupport = supportForProgression(progression, { level });
  // Expressions the partner introduced this session, accumulated across turns.
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([]);
  // Seconds until a silent free-talk turn is sent, so a 3s pause doesn't look like a freeze.
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

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
    // Prefer the stored list: it carries the glosses and the uptake stamps, neither of which
    // survives in the turns (the trailer is stripped before a turn is saved). Conversations from
    // before repertoire was persisted fall back to rebuilding bare items from the markers.
    setRepertoire(
      target.repertoire ??
        target.turns
          .filter((turn) => turn.role === "assistant")
          .reduce<RepertoireItem[]>((items, turn) => mergeRepertoire(items, parseRepertoire(turn.text).items), []),
    );
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
  //
  // Callers must pass the *plain* text: at C1-C2 the reply carries repertoire markup, and Kokoro
  // would happily pronounce the asterisks and the trailer.
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
    ? t("{provider} is unavailable. Open Settings with the gear button to connect one.", { provider: activeProvider?.label ?? t("No provider") })
    : null;
  const cloudNote =
    activeProvider && !activeProvider.isLocal
      ? t("Your turns are sent to {provider} to generate replies.", { provider: activeProvider.label })
      : null;

  // `past` is newest-first, so this is the freshest slice of what the partner has already given.
  const pastTaught = useMemo(() => recentTaughtExpressions(past), [past]);

  const usingCustom = scenarioId === "custom";
  const activeScenario = scenarios.find((s) => s.id === scenarioId);
  // Repertoire mode follows the learner's level, not the surface: a C1 learner gets it in the
  // Speak tab too, and the panel stays hidden below that band where it would only distract.
  const showRepertoire = isRepertoireLevel(level) && repertoire.length > 0;
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
        taughtExpressions: pastTaught,
      });
      // Hold the "Starting…" state through TTS so the greeting bubble and its voice appear together.
      const parsed = reply ? parseRepertoire(reply) : null;
      const audio = parsed ? await synthReply(parsed.plain) : null;
      if (parsed) setRepertoire(parsed.items);
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
        // Store `display`: the trailer is stripped (it is plumbing, not conversation) but the
        // inline markers stay, so reopening a saved session keeps its highlights.
        turns: parsed ? [{ role: "assistant", text: parsed.display }] : [],
        repertoire: parsed?.items ?? [],
        startedAt: Date.now(),
      };
      persist(conv);
      if (reply) speak(audio);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : t("Couldn't start the conversation."));
    } finally {
      setBusy(false);
    }
  }, [busy, canStart, usingCustom, customTrimmed, activeScenario, past, pastTaught, provider, selectedModel, level, challenge, persist, synthReply, speak, progressionSupport, recurringError, t]);

  const sendTurn = useCallback(
    async (text: string, spoken = false) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !conversation) return;
      const learnerTurns = conversation.turns.filter((turn) => turn.role === "user").length;
      if (learnerTurns >= progressionSupport.conversation.maxTurns) {
        setNote(t("This {stage} practice is complete. Finish it to review your output.", { stage: t(SPEAKING_STAGE_LABEL[progressionSupport.speaking.stage]) }));
        return;
      }
      setBusy(true);
      setNote(null);
      // Credit any expression the learner reached for before the turn goes out, so the partner's
      // next reply is shaped by what has actually been taken up rather than by what was said at
      // them. Nothing is surfaced mid-conversation — the panel updates, the flow doesn't break.
      const afterUse = markRepertoireUsed(repertoire, detectRepertoireUse(trimmed, repertoire));
      setRepertoire(afterUse);
      const withUser: Conversation = {
        ...conversation,
        turns: [...conversation.turns, { role: "user", text: trimmed, spoken }],
        repertoire: afterUse,
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
          taughtExpressions: [...pastTaught, ...afterUse.map((item) => item.expression)],
          // Only the last few, and only ones still unused: asking the partner to engineer an
          // opening for a dozen expressions at once turns the conversation into a drill.
          elicitExpressions: unusedRepertoire(afterUse).slice(-ELICIT_PER_TURN).map((item) => item.expression),
        });
        if (reply) {
          // Stage the audio first, then reveal the bubble + play together (kept in sync).
          const parsed = parseRepertoire(reply);
          const audio = await synthReply(parsed.plain);
          const nextRepertoire =
            parsed.items.length > 0 ? mergeRepertoire(afterUse, parsed.items) : afterUse;
          const withReply: Conversation = {
            ...withUser,
            turns: [...withUser.turns, { role: "assistant", text: parsed.display }],
            repertoire: nextRepertoire,
          };
          persist(withReply);
          setRepertoire(nextRepertoire);
          speak(audio);
        }
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : t("Couldn't get a reply."));
      } finally {
        setBusy(false);
      }
    },
    [busy, conversation, repertoire, pastTaught, provider, selectedModel, persist, synthReply, speak, speakTimer, progressionSupport, recurringError, t],
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
        setNote(t("Couldn't make out any speech in that clip."));
        return;
      }
      if (opts?.autoSend) {
        sendTurnRef.current(text, true);
      } else {
        typedInputWasSpokenRef.current = true;
        setTyped((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      }
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : t("Transcription failed."));
    } finally {
      setTranscribing(false);
    }
  }, [t]);

  // Tear down the VAD analyser loop. Safe to call repeatedly.
  const cleanupVad = useCallback(() => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    vadFrameRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setSilenceCountdown(null);
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
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [transcribeBlob, t]);

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

      // The threshold is measured from this room rather than hard-coded — see `speechThreshold`.
      let vad = createVadState(performance.now());
      setSilenceCountdown(null);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        const step = advanceVad(vad, computeRms(data), performance.now());
        vad = step.state;

        if (step.action === "submit") {
          setSilenceCountdown(null);
          recorderRef.current?.stop(); // → onstop → transcribe + auto-send
          return;
        }
        if (step.action === "giveup") {
          setSilenceCountdown(null);
          discardRef.current = true; // nothing said — bail without a wasted transcription
          recorderRef.current?.stop();
          return;
        }
        // Only count down once a pause is actually building, so the hint doesn't flicker
        // on the natural gaps between words.
        setSilenceCountdown(step.silenceElapsedMs > 600 ? silenceCountdownSeconds(step.silenceElapsedMs) : null);
        vadFrameRef.current = requestAnimationFrame(tick);
      };
      vadFrameRef.current = requestAnimationFrame(tick);
    } catch {
      cleanupVad();
      setRecording(false);
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [transcribeBlob, cleanupVad, t]);
  useEffect(() => {
    listenRef.current = startListening;
  }, [startListening]);

  const stopRecording = useCallback(() => {
    // In free talk a manual stop is a cancel — discard rather than send a half-formed turn.
    if (vadFrameRef.current || audioCtxRef.current) discardRef.current = true;
    setSilenceCountdown(null);
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
        setReviewNote(err instanceof Error ? err.message : t("Couldn't review the conversation."));
      } finally {
        setCorrecting(false);
      }
    },
    [hasEvaluator, evaluatorHint, provider, selectedModel, refreshPast, t],
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
      setReviewNote(err instanceof Error ? err.message : t("Couldn't export the cards."));
    } finally {
      setGenerating(false);
    }
  }, [review, generating, provider, selectedModel, t]);

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

  // Credit an expression produced in the review's recall prompt, so it stops being offered and
  // the session's uptake count reflects it. Same store as the live conversation — the recall is
  // part of the session, not a separate exercise.
  const markReviewRepertoireUsed = useCallback(
    (used: RepertoireItem[]) => {
      if (!review?.repertoire?.length) return;
      const next: Conversation = { ...review, repertoire: markRepertoireUsed(review.repertoire, used) };
      setReview(next);
      void saveConversation(next);
    },
    [review],
  );

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
      setReviewNote(err instanceof Error ? err.message : t("Couldn't check the retry."));
    } finally {
      setRetryChecking(false);
    }
  }, [hasEvaluator, provider, retryChecking, retryText, review, selectedModel, t]);

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
    const reviewRepertoire = review.repertoire ?? [];
    const uptake = repertoireUptake(reviewRepertoire);
    const stillUnused = unusedRepertoire(reviewRepertoire);
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
              {t("Done")}
            </Button>
          </div>

          {/* Repertoire outcome sits above the corrections: at C1-C2 what you reached for is a
              better read on the session than what you got wrong, and the errors are usually few. */}
          {uptake.total > 0 && (
            <div className="space-y-3">
              <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
                {t("Your partner handed you {total} expressions. You said {used} of them back.", {
                  total: uptake.total,
                  used: uptake.used,
                })}
              </p>
              {stillUnused.length > 0 && (
                <RepertoireRecall
                  items={stillUnused}
                  context={review.context}
                  level={review.level}
                  provider={provider}
                  selectedModel={selectedModel}
                  hasEvaluator={hasEvaluator}
                  onUsed={markReviewRepertoireUsed}
                />
              )}
            </div>
          )}

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
                  <summary className="cursor-pointer">{t("Show {count} minor polish issues", { count: polishCount })}</summary>
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
                  <p className="text-sm font-medium text-ink">{t("Try the important correction again")}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {t("Rewrite one or two ideas in the same {context} situation. Minor polish does not block completion.", { context: review.context })}
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
                  placeholder={t("Write your improved response here…")}
                  className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={retryChecking}
                />
                <LocalModelNotice model={whisper} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={retryRecording ? "primary" : "secondary"}
                    onClick={() => (retryRecording ? stopRetryRecording() : void startRetryRecording())}
                    disabled={retryChecking || retryTranscribing}
                    aria-pressed={retryRecording}
                  >
                    {retryTranscribing ? t("Transcribing…") : retryRecording ? t("Stop recording") : t("Speak retry")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void checkConversationRetry()}
                    disabled={!retryText.trim() || retryChecking || retryTranscribing || !hasEvaluator}
                  >
                    {retryChecking ? t("Checking retry…") : t("Check my retry")}
                  </Button>
                </div>
                {retryReview && (
                  <Notice tone={retryReview.errors.length === 0 ? "success" : "warning"}>
                    {retryReview.errors.length === 0
                      ? t("Your retry applies the important feedback in this situation.")
                      : t("{count} issues remain. Compare with the corrections above and try again if useful.", { count: retryReview.errors.length })}
                  </Notice>
                )}
                {retryResolution === "deferred" ? (
                  <Notice tone="default">{t("This retry is deferred for a later review.")}</Notice>
                ) : retryResolution === "dismissed" ? (
                  <Notice tone="default">{t("This retry was explicitly dismissed.")}</Notice>
                ) : retryResolution === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={deferConversationRetry} disabled={retryChecking}>
                      {t("Defer retry for later")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={dismissConversationRetry}
                      disabled={retryChecking}
                    >
                      {t("Dismiss retry")}
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
                  ? t("Exporting…")
                  : reviewCarded
                    ? t("Exported ✓")
                    : t("Export {count} cards to Anki →", { count: errors.length })}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => void correctReview(review)}
              disabled={!hasEvaluator}
              className="h-10"
            >
              {t("Find my mistakes →")}
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
                <button onClick={onOpenSettings} className="underline hover:no-underline">{t("Open Settings →")}</button>
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
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Practice speaking")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t("Speak with an AI partner in a role-play. Keep going naturally; your mistakes become cards afterward.")}
          </p>
        </div>

        <Notice tone="default" className="space-y-1">
          {/* The speaking stage is scaffolding for a learner still building production, and it
              stays evidence-based — so at C1-C2 it reads as "fixed phrases / keep the model
              phrase as your scaffold" next to a 12-turn counterpoint conversation. True but
              contradictory, and not what the advanced surface is about, so it's dropped there. */}
          {!topicFirst && (
            <>
              <p className="text-sm font-medium text-ink">
                {t("Speaking stage: {stage}", { stage: t(SPEAKING_STAGE_LABEL[progressionSupport.speaking.stage]) })}
              </p>
              <p className="text-xs text-ink-soft">{t(progressionSupport.speaking.guidance)}</p>
            </>
          )}
          <p className={cn("text-ink-muted", topicFirst ? "text-sm" : "text-xs")}>
            {t("This practice uses up to {turns} learner turns with {depth} follow-ups.", {
              turns: progressionSupport.conversation.maxTurns,
              depth: progressionSupport.conversation.followUpDepth,
            })}
          </p>
        </Notice>

        {topicFirst ? (
          // Advanced learners come with something they want to talk about, so the free-text
          // topic leads and the presets sit underneath as suggestions.
          <>
            <Field label={t("What do you want to talk about?")} hint={t("Anything — a decision at work, something you read, an argument you want to test.")}>
              <Input
                type="text"
                value={customScenario}
                onChange={(e) => {
                  setScenarioId("custom");
                  setCustomScenario(e.target.value);
                }}
                placeholder={t("e.g. whether remote work actually helps junior engineers")}
              />
            </Field>
            <Field label={t("Or start from one of these")}>
              <div className="flex flex-wrap gap-1.5">
                {scenarios.map((s) => (
                  <Chip key={s.id} active={scenarioId === s.id} onClick={() => setScenarioId(s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label={t("Scenario")}>
              <div className="flex flex-wrap gap-1.5">
                {scenarios.map((s) => (
                  <Chip key={s.id} active={scenarioId === s.id} onClick={() => setScenarioId(s.id)}>
                    {s.label}
                  </Chip>
                ))}
                <Chip active={usingCustom} onClick={() => setScenarioId("custom")}>
                  {t("Custom…")}
                </Chip>
              </div>
            </Field>

            {usingCustom && (
              <Field label={t("Describe the situation")}>
                <Input
                  type="text"
                  value={customScenario}
                  onChange={(e) => setCustomScenario(e.target.value)}
                  placeholder={t("e.g. negotiating an apartment lease with a landlord")}
                />
              </Field>
            )}
          </>
        )}

        <Field label={t("Level")} hint={t("Sets how challenging your partner's English is.")}>
          <Segmented<ConversationLevel>
            label={t("CEFR level")}
            value={level}
            onChange={setLevel}
            options={CONVERSATION_LEVELS.map((l) => ({ value: l, label: l }))}
            className="flex-wrap"
          />
        </Field>

        <Field label={t("Partner")} hint={t("Supportive keeps the role-play simple. Challenging asks follow-ups and pushes your reasoning.")}>
          <Segmented<"supportive" | "challenging">
            label={t("Conversation partner style")}
            value={challenge ? "challenging" : "supportive"}
            onChange={(v) => setChallenge(v === "challenging")}
            options={[
              { value: "supportive", label: t("Supportive") },
              { value: "challenging", label: t("Challenging") },
            ]}
          />
        </Field>

        <Field
          label={t("Mode")}
          hint={
            freeTalk
              ? t("Free talk: the mic opens after each reply and sends when you pause — fully hands-free.")
              : t("Guided: tap Speak (or type), review, then send each turn yourself.")
          }
        >
          <Segmented<"guided" | "free">
            label={t("Conversation mode")}
            value={freeTalk ? "free" : "guided"}
            onChange={(v) => setFreeTalk(v === "free")}
            options={[
              { value: "guided", label: t("Guided") },
              { value: "free", label: t("Free talk") },
            ]}
          />
        </Field>

        {cloudNote && <p className="text-xs text-ink-muted">{cloudNote}</p>}
        {note && <p className="text-xs text-danger">{note}</p>}

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={start} disabled={!canStart || busy} className="h-10">
            {busy ? t("Starting…") : t("Start practice →")}
          </Button>
          {evaluatorHint && (
            <p className="text-xs text-ink-muted">
              {evaluatorHint}{" "}
              {onOpenSettings && (
                <button onClick={onOpenSettings} className="underline hover:no-underline">{t("Open Settings →")}</button>
              )}
            </p>
          )}
        </div>

        <Disclosure
          title={t("Advanced options")}
          description={t("Change the AI provider for this conversation.")}
          badge={activeProvider ? <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} /> : undefined}
          nested
        >
          <ProviderPicker selection={selection} disabled={busy} />
        </Disclosure>
        </Card>

        {past.length > 0 && (
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold tracking-[-0.01em] text-ink">{t("Recent conversations")}</p>
            <ul className="space-y-2">
              {past.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{c.context}</p>
                    <p className="text-xs text-ink-muted">
                      {t("{count} turns", { count: c.turns.length })} · {formatWhen(c.startedAt, t)}
                      {c.endedAt ? "" : ` · ${t("in progress")}`}
                    </p>
                  </div>
                  {c.endedAt && <Chip onClick={() => openReview(c)}>{t("Review")}</Chip>}
                  <Chip onClick={() => resume(c)}>{t("Resume")}</Chip>
                  <button
                    type="button"
                    onClick={() => void removePast(c.id)}
                    className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-xs font-medium text-ink-muted opacity-60 transition-opacity hover:text-danger hover:opacity-100"
                    aria-label={t("Delete conversation")}
                  >
                    {t("Delete")}
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
            <span>{t("{count} turns", { count: conversation.turns.length })}</span>
            {conversation.level && <span>{t("Level {level}", { level: conversation.level })}</span>}
            <span>{activeProvider?.label ?? t("AI partner")}</span>
            {conversation.challenge && <span className="text-accent">{t("Challenging")}</span>}
            {/* Same reason the stage notice is dropped above: "fixed phrases" is scaffolding
                language that contradicts the advanced surface it would be sitting on. */}
            {!topicFirst && conversation.progressionStage && (
              <span>{t(stageLabel(conversation.progressionStage))}</span>
            )}
            {freeTalk && <span className="text-accent">{t("Free talk")}</span>}
          </div>
        </div>
        <Button variant="secondary" onClick={finish} className="h-9 shrink-0">
          {t("Finish")}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <motion.ul
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-card px-4 py-5 app-scroll-region sm:px-6"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          aria-live="polite"
        >
          {conversation.turns.map((turn, i) => (
            <TurnBubble key={i} turn={turn} items={repertoire} />
          ))}
          {busy && (
            <li className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted shadow-sm">
              <Spinner className="h-3.5 w-3.5" /> {t("Thinking…")}
            </li>
          )}
          <div ref={bottomRef} />
        </motion.ul>

        {showRepertoire && (
          <RepertoirePanel items={repertoire} context={conversation.context} conversationId={conversation.id} />
        )}
      </div>

      <div className="space-y-2 border-t border-line bg-surface p-3 sm:p-4">
        {note && <p className="text-xs text-danger">{note}</p>}
        <LocalModelNotice model={whisper} />
        <p className="text-[11px] text-ink-muted">
          {t("{used}/{total} speaking turns", {
            used: conversation.turns.filter((turn) => turn.role === "user").length,
            total: progressionSupport.conversation.maxTurns,
          })} · {progressionSupport.conversation.promptStyle}
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
                {/* A 3s pause is long enough to read as a freeze, so show the turn closing. */}
                {freeTalk
                  ? silenceCountdown !== null
                    ? t("Sending in {seconds}s…", { seconds: silenceCountdown })
                    : t("Listening…")
                  : t("Stop")}
              </>
            ) : transcribing ? (
              <>
                <Spinner className="h-4 w-4" />
                …
              </>
            ) : (
              <>
                <MicrophoneIcon />
                {t("Speak")}
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
            placeholder={t("Type your reply, or tap Speak…")}
            disabled={busy}
            className="h-11 flex-1"
          />
          <Button
            variant="primary"
            onClick={() => void sendTurn(typed, typedInputWasSpokenRef.current)}
            disabled={!typed.trim() || busy}
            className="h-11 shrink-0 sm:min-w-24"
          >
            {t("Send")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Short relative-ish stamp for the recent list: "today", "yesterday", else a date. */
function formatWhen(ts: number, t: ReturnType<typeof useT>["t"]): string {
  const dayMs = 86_400_000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday - new Date(ts).setHours(0, 0, 0, 0)) / dayMs);
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("{count} days ago", { count: days });
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

function TurnBubble({ turn, items = [] }: { turn: ConversationTurn; items?: RepertoireItem[] }) {
  const isUser = turn.role === "user";
  // Only the partner's turns carry repertoire markup; the learner's text is shown verbatim.
  const parsed = isUser ? null : parseRepertoire(turn.text);
  // Glosses come from the session list, not from this turn: the stored text keeps the inline
  // markers but not the trailer, so re-parsing alone would leave every expression unglossed.
  const glosses = new Map(items.map((item) => [item.expression.toLowerCase(), item.gloss]));
  const glossed = (parsed?.items ?? []).map((item) => ({
    ...item,
    gloss: item.gloss || glosses.get(item.expression.toLowerCase()) || "",
  }));
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
        {parsed && glossed.length > 0
          ? segmentRepertoire(parsed.display, glossed).map((segment, i) =>
              segment.item ? (
                <button
                  key={i}
                  type="button"
                  // The gloss is the accessible name so it is reachable without a hover.
                  title={segment.item.gloss || undefined}
                  aria-label={segment.item.gloss ? `${segment.text}: ${segment.item.gloss}` : segment.text}
                  className="cursor-help rounded-sm bg-accent/12 px-0.5 font-medium text-ink decoration-accent/60 decoration-dotted underline-offset-4 transition-colors hover:bg-accent/20 hover:underline"
                >
                  {segment.text}
                </button>
              ) : (
                <span key={i}>{segment.text}</span>
              ),
            )
          : (parsed?.plain ?? turn.text)}
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
