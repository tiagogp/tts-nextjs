export type AudioRecordingKind = "native" | "synthetic";
export type AudioDelivery = "supported" | "natural" | "connected";

export interface LessonAudioMetadata {
  clip: string;
  recordingKind: AudioRecordingKind;
  speakerId: string;
  accent: string;
  delivery: AudioDelivery;
  speedWpm: number;
  connectedSpeechFeatures?: string[];
  provenance: string;
  license?: string;
}

export interface AudioCoverageRule {
  level: string;
  batchSize: number;
  minDistinctSpeakers: number;
  minNaturalOrConnected: number;
  minSpeedWpm: number;
  maxSpeedWpm: number;
}

/** Honest fallback metadata used until a licensed recording replaces the clip. */
export function syntheticAudioMetadata(clip: string, text: string): LessonAudioMetadata {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    clip,
    recordingKind: "synthetic",
    speakerId: "kokoro:af_heart",
    accent: "synthetic fallback",
    delivery: "supported",
    speedWpm: Math.max(60, words * 12),
    provenance: "Kokoro local synthesis; not native input",
  };
}

export function validateLessonAudioMetadata(metadata: LessonAudioMetadata[]): string[] {
  const errors: string[] = [];
  const clips = new Set<string>();
  for (const item of metadata) {
    if (clips.has(item.clip)) errors.push(`${item.clip} is declared more than once.`);
    clips.add(item.clip);
    if (item.recordingKind === "native" && !item.license) errors.push(`${item.clip} native audio needs a license.`);
    if (item.recordingKind === "synthetic" && item.license) errors.push(`${item.clip} synthetic audio cannot claim a native license.`);
    if (!item.speakerId || !item.accent || !item.provenance) errors.push(`${item.clip} is missing provenance metadata.`);
    if (!Number.isFinite(item.speedWpm) || item.speedWpm <= 0) errors.push(`${item.clip} needs speed evidence.`);
  }
  return errors;
}

export function coverageForBatch(metadata: LessonAudioMetadata[], rule: AudioCoverageRule) {
  const rows = [];
  for (let index = 0; index < metadata.length; index += rule.batchSize) {
    const batch = metadata.slice(index, index + rule.batchSize);
    rows.push({
      clips: batch.length,
      distinctRecordings: new Set(batch.map((item) => item.clip)).size,
      distinctSpeakers: new Set(batch.map((item) => item.speakerId)).size,
      nativeClips: batch.filter((item) => item.recordingKind === "native").length,
      syntheticClips: batch.filter((item) => item.recordingKind === "synthetic").length,
      naturalOrConnected: batch.filter((item) => item.delivery !== "supported").length,
      minSpeedWpm: Math.min(...batch.map((item) => item.speedWpm)),
      maxSpeedWpm: Math.max(...batch.map((item) => item.speedWpm)),
      passes: batch.length > 0 && new Set(batch.map((item) => item.clip)).size === batch.length &&
        new Set(batch.map((item) => item.speakerId)).size >= rule.minDistinctSpeakers &&
        batch.filter((item) => item.delivery !== "supported").length >= rule.minNaturalOrConnected &&
        Math.min(...batch.map((item) => item.speedWpm)) >= rule.minSpeedWpm &&
        Math.max(...batch.map((item) => item.speedWpm)) <= rule.maxSpeedWpm,
    });
  }
  return rows;
}
