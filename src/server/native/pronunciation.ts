import "server-only";

import { decodeAudio } from "@/server/native/audio";
import { transcribe } from "@/server/native/speech";
import { assessPronunciationText } from "@/lib/pronunciation/scoring";
import type { PronunciationAssessment } from "@/lib/pronunciation/types";

export async function assessPronunciation(options: {
  audio: Buffer | Uint8Array;
  targetText: string;
  targetLang?: string | null;
  referenceDurationMs?: number;
}): Promise<PronunciationAssessment> {
  const [decoded, transcription] = await Promise.all([
    decodeAudio(options.audio),
    transcribe({
      audio: options.audio,
      language: options.targetLang || "en",
    }),
  ]);
  const durationMs = Math.round((decoded.samples.length / decoded.sampleRate) * 1000);
  return assessPronunciationText({
    targetText: options.targetText,
    transcript: transcription.text,
    durationMs,
    referenceDurationMs: options.referenceDurationMs,
  });
}
