import type { ConversationTurn, ProviderKind } from "@/lib/cards/provider";
import { getLearnerLangs } from "@/features/settings/learningProfile";

/**
 * Ask the AI for the next assistant turn. `history` is the full prior exchange (empty for the
 * opening turn — the assistant greets first). The situational context tag is a client concern
 * (the short scenario tag), so it isn't derived here.
 */
export async function sendConversationTurn(input: {
  provider: ProviderKind;
  selectedModel?: string;
  scenario: string;
  targetLang?: string;
  level?: string;
  challenge?: boolean;
  history: ConversationTurn[];
  signal?: AbortSignal;
}): Promise<{ reply: string }> {
  const { nativeLang, targetLang } = getLearnerLangs();
  const response = await fetch("/api/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      scenario: input.scenario,
      targetLang: input.targetLang ?? targetLang,
      sourceLang: nativeLang,
      level: input.level || undefined,
      challenge: input.challenge || undefined,
      history: input.history,
    }),
    signal: input.signal,
  });
  const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return { reply: (data.reply ?? "").trim() };
}

/**
 * Best-effort TTS for an assistant reply. Audio is optional in the conversation flow — the
 * text is already on screen — so the caller should swallow failures (e.g. Kokoro model not
 * downloaded yet) rather than block the conversation.
 */
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `TTS failed (${response.status})`);
  }
  return response.blob();
}
