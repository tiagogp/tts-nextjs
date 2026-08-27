import { describe, expect, it } from "vitest";
import { coverageForBatch, syntheticAudioMetadata, validateLessonAudioMetadata } from "./audioMetadata";

describe("lesson audio metadata", () => {
  it("labels the local fallback honestly", () => {
    const metadata = syntheticAudioMetadata("/learn/audio/a1/01.wav", "Hello there");
    expect(metadata.recordingKind).toBe("synthetic");
    expect(metadata.speakerId).toContain("kokoro");
    expect(validateLessonAudioMetadata([metadata])).toEqual([]);
  });

  it("does not pass a diversity gate with one supported synthetic voice", () => {
    const rows = coverageForBatch(
      [1, 2, 3].map((index) => syntheticAudioMetadata(`/clip-${index}.wav`, "A short sentence")),
      { level: "A1", batchSize: 3, minDistinctSpeakers: 2, minNaturalOrConnected: 1, minSpeedWpm: 80, maxSpeedWpm: 220 },
    );
    expect(rows[0].passes).toBe(false);
    expect(rows[0]).toMatchObject({ distinctRecordings: 3, nativeClips: 0, syntheticClips: 3 });
  });

  it("rejects duplicate clip declarations instead of counting labels as diversity", () => {
    const first = { ...syntheticAudioMetadata("/same.wav", "A short sentence"), speakerId: "speaker-a" };
    const second = { ...first, speakerId: "speaker-b" };
    expect(validateLessonAudioMetadata([first, second])).toContain("/same.wav is declared more than once.");
  });
});
