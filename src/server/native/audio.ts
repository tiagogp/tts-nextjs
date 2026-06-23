import "server-only";

import decode from "audio-decode";

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
}

function mono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array();
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i] += (channel[i] ?? 0) / channels.length;
  }
  return out;
}

export async function decodeAudio(data: Buffer | Uint8Array): Promise<DecodedAudio> {
  const decoded = await decode(data);
  return { samples: mono(decoded.channelData), sampleRate: decoded.sampleRate };
}

export function resample(input: DecodedAudio, targetRate = 16_000): Float32Array {
  if (input.sampleRate === targetRate) return input.samples;
  const length = Math.max(1, Math.round(input.samples.length * targetRate / input.sampleRate));
  const out = new Float32Array(length);
  const ratio = input.sampleRate / targetRate;
  for (let i = 0; i < length; i++) {
    const at = i * ratio;
    const left = Math.floor(at);
    const right = Math.min(input.samples.length - 1, left + 1);
    const mix = at - left;
    out[i] = (input.samples[left] ?? 0) * (1 - mix) + (input.samples[right] ?? 0) * mix;
  }
  return out;
}

export function wav(samples: Float32Array, sampleRate: number): Buffer {
  const out = Buffer.allocUnsafe(44 + samples.length * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    out.writeInt16LE(Math.round(value < 0 ? value * 32768 : value * 32767), 44 + i * 2);
  }
  return out;
}

export async function sliceAudio(
  data: Buffer,
  startMs: number,
  endMs: number,
): Promise<Buffer> {
  const decoded = await decodeAudio(data);
  return sliceDecodedAudio(decoded, startMs, endMs);
}

export function sliceDecodedAudio(
  decoded: DecodedAudio,
  startMs: number,
  endMs: number,
): Buffer {
  const start = Math.max(0, Math.floor(startMs * decoded.sampleRate / 1000));
  const end = Math.min(
    decoded.samples.length,
    Math.max(start + 1, Math.ceil(endMs * decoded.sampleRate / 1000)),
  );
  return wav(decoded.samples.slice(start, end), decoded.sampleRate);
}
