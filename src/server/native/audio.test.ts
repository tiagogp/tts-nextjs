import { describe, expect, it } from "vitest";
import { decodeAudio, resample, sliceAudio, sliceDecodedAudio, wav } from "./audio";

describe("native audio utilities", () => {
  it("writes and decodes PCM WAV", async () => {
    const samples = Float32Array.from({ length: 24_000 }, (_, i) => Math.sin(i / 20) * 0.25);
    const encoded = wav(samples, 24_000);
    expect(encoded.subarray(0, 4).toString()).toBe("RIFF");
    expect(encoded.subarray(8, 12).toString()).toBe("WAVE");
    const decoded = await decodeAudio(encoded);
    expect(decoded.sampleRate).toBe(24_000);
    expect(decoded.samples.length).toBe(24_000);
  });

  it("resamples to Whisper's 16 kHz input", () => {
    const output = resample({ samples: new Float32Array(48_000), sampleRate: 48_000 });
    expect(output.length).toBe(16_000);
  });

  it("slices a time interval without an ffmpeg process", async () => {
    const source = wav(new Float32Array(48_000), 24_000);
    const clip = await decodeAudio(await sliceAudio(source, 500, 1_250));
    expect(clip.sampleRate).toBe(24_000);
    expect(clip.samples.length).toBe(18_000);
  });

  it("slices from decoded audio without decoding again", async () => {
    const decoded = {
      samples: new Float32Array(48_000),
      sampleRate: 24_000,
    };
    const clip = await decodeAudio(sliceDecodedAudio(decoded, 250, 750));
    expect(clip.sampleRate).toBe(24_000);
    expect(clip.samples.length).toBe(12_000);
  });
});
