import type { TranscriptSegment } from "@/features/discover/types";
import type { ColdProbeQuestion } from "./coldProbeBank";

/**
 * A cold-listening probe built from the learner's own imported source.
 *
 * The bundled probe bank needs licensed recordings, which is content acquisition and may
 * stay empty for a long time. But the app already ingests authentic audio every time
 * someone imports a video or a podcast — real speakers, real accents, real noise, and a
 * voice the learner has by definition never heard before. That is the exact material the
 * unfamiliar-speech metric asks for, and it is already on disk with timestamps.
 *
 * What was missing is the questions, and a model can write those from the transcript. This
 * is the one place where an AI provider buys something the device genuinely cannot do: not
 * a better judgement of the learner's answer, but *the instrument itself*.
 *
 * Two conditions make the measurement real, and both are enforced rather than hoped for:
 *
 *   - the probe runs **before** the transcript is shown and before any phrase from the
 *     source is studied. After that the voice is no longer unfamiliar and the text is no
 *     longer unseen, and the attempt would be measuring something else;
 *   - the clip is played once, at full speed, with no transcript — the same rules as the
 *     bundled bank, for the same reason.
 */

/** Below this, a clip cannot carry a main idea; above it, one listen stops being fair. */
export const PROBE_MIN_MS = 10_000;
export const PROBE_MAX_MS = 25_000;

/** A window with fewer words than this is silence, music, or a jingle — not speech to follow. */
const MIN_WORDS = 25;

/** A gap this long between segments means the window is not continuous speech. */
const MAX_GAP_MS = 2_000;

/**
 * Skip the opening: intros, greetings and channel jingles are the least representative
 * speech in any recording, and the easiest to follow. Falls back to the start when the
 * source is too short to skip anything.
 */
const PREFERRED_START_MS = 15_000;

export interface ProbeWindow {
  startMs: number;
  endMs: number;
  /** Transcript inside the window. Sent to the model; never shown to the learner. */
  text: string;
  /** Indexes of the segments that make up the window, for provenance. */
  segmentIndexes: number[];
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function windowFrom(segments: readonly TranscriptSegment[], start: number): ProbeWindow | null {
  const first = segments[start];
  if (!first) return null;
  const indexes: number[] = [];
  let endMs = first.startMs;
  const parts: string[] = [];
  for (let index = start; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.startMs - endMs > MAX_GAP_MS && indexes.length > 0) break;
    if (segment.endMs - first.startMs > PROBE_MAX_MS) break;
    indexes.push(index);
    endMs = segment.endMs;
    parts.push(segment.text.trim());
  }
  const spanMs = endMs - first.startMs;
  const text = parts.join(" ").trim();
  if (spanMs < PROBE_MIN_MS || words(text) < MIN_WORDS) return null;
  return { startMs: first.startMs, endMs, text, segmentIndexes: indexes };
}

/**
 * The stretch of the source to probe on, or null when nothing qualifies.
 *
 * Deterministic: the same import always yields the same window, so a probe can be
 * regenerated without silently becoming a different test.
 */
export function selectProbeWindow(segments: readonly TranscriptSegment[]): ProbeWindow | null {
  let fallback: ProbeWindow | null = null;
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = windowFrom(segments, index);
    if (!candidate) continue;
    if (candidate.startMs >= PREFERRED_START_MS) return candidate;
    fallback ??= candidate;
  }
  return fallback;
}

/** Where the probe audio comes from: the existing per-source clip endpoint, no new plumbing. */
export function probeClipUrl(sourceId: string, window: ProbeWindow): string | null {
  if (!/^[a-z0-9]{12}$/.test(sourceId)) return null;
  return `/api/discover/clip/${sourceId}?startMs=${Math.floor(window.startMs)}&endMs=${Math.ceil(window.endMs)}`;
}

export type ProbeIneligibility =
  /** Text source: nothing to listen to. */
  | "no_audio"
  /** No continuous stretch of speech long enough to carry a main idea. */
  | "too_short"
  /** The learner already heard this source, so "unfamiliar" would be a lie. */
  | "already_heard"
  /** No provider, so nobody can write the questions. */
  | "no_provider";

export interface ProbeEligibility {
  eligible: boolean;
  reason?: ProbeIneligibility;
  window?: ProbeWindow;
}

export function probeEligibility(input: {
  hasAudio: boolean;
  segments: readonly TranscriptSegment[];
  /** True when a provider that can write the questions is configured. */
  hasProvider: boolean;
  /** True when this source has already been probed, studied, or its transcript revealed. */
  alreadyHeard: boolean;
}): ProbeEligibility {
  if (!input.hasAudio) return { eligible: false, reason: "no_audio" };
  // Checked before the window search: an already-heard source is ineligible whatever its
  // audio looks like, and saying "too short" about it would be the wrong reason.
  if (input.alreadyHeard) return { eligible: false, reason: "already_heard" };
  if (!input.hasProvider) return { eligible: false, reason: "no_provider" };
  const window = selectProbeWindow(input.segments);
  if (!window) return { eligible: false, reason: "too_short" };
  return { eligible: true, window };
}

/**
 * The prompt that turns a transcript window into a comprehension check.
 *
 * Written to produce a check that cannot be passed by reading the options: the main-idea
 * question asks what the speaker is doing, and the distractors have to be plausible for the
 * same topic. A question answerable from the options alone measures test-taking.
 */
export function buildProbePrompt(window: ProbeWindow, opts: { targetLang: string }): string {
  return [
    `You are building a listening comprehension check for a learner of ${opts.targetLang}.`,
    `They will hear the audio below ONCE, with no transcript and no replay. They never see this text.`,
    ``,
    `Transcript:`,
    `"""`,
    window.text,
    `"""`,
    ``,
    `Return JSON only, in this exact shape:`,
    `{"questions":[{"kind":"mainIdea","prompt":"...","options":["...","...","..."],"answer":"..."},{"kind":"detail","prompt":"...","options":["...","...","..."],"answer":"..."}]}`,
    ``,
    `Rules:`,
    `- Exactly one question with kind "mainIdea" and exactly one with kind "detail".`,
    `- Write questions and options in ${opts.targetLang}, short and plain.`,
    `- Exactly three options per question; the answer must be one of them, copied verbatim.`,
    `- Distractors must be plausible for this same topic. A learner who did not hear the audio must not be able to pick the answer by elimination.`,
    `- The main-idea question must be about what the speaker is doing or saying overall, not about one word.`,
    `- The detail question must be answerable only from something actually said.`,
    `- Never quote a full sentence of the transcript in a question or an option.`,
  ].join("\n");
}

/**
 * Validate what the model returned.
 *
 * The same rules the content validator applies to the bundled bank, enforced here at
 * runtime because a generated probe never passes through a build step. An invalid probe is
 * dropped rather than repaired: a check with two plausible answers measures nothing, and a
 * missing probe is honest while a broken one is not.
 */
export function parseProbeQuestions(raw: unknown): ColdProbeQuestion[] | null {
  const payload = typeof raw === "string" ? safeJson(raw) : raw;
  const questions = (payload as { questions?: unknown })?.questions;
  if (!Array.isArray(questions) || questions.length < 2) return null;

  const parsed: ColdProbeQuestion[] = [];
  for (const entry of questions) {
    const question = entry as Partial<ColdProbeQuestion>;
    if (question.kind !== "mainIdea" && question.kind !== "detail") return null;
    if (typeof question.prompt !== "string" || !question.prompt.trim()) return null;
    if (typeof question.answer !== "string" || !question.answer.trim()) return null;
    const options = question.options;
    if (!Array.isArray(options) || options.length < 3) return null;
    if (options.some((option) => typeof option !== "string" || !option.trim())) return null;
    if (new Set(options.map((option) => option.trim().toLowerCase())).size !== options.length) return null;
    if (!options.includes(question.answer)) return null;
    // A prompt that contains its own answer is a reading exercise.
    if (question.prompt.toLowerCase().includes(question.answer.toLowerCase())) return null;
    parsed.push({
      kind: question.kind,
      prompt: question.prompt.trim(),
      options: options.map((option) => option.trim()),
      answer: question.answer.trim(),
    });
  }

  if (parsed.filter((question) => question.kind === "mainIdea").length !== 1) return null;
  return parsed;
}

function safeJson(text: string): unknown {
  // Models wrap JSON in prose or fences often enough that finding the object is worth it,
  // and cheap: anything that is not parseable still returns null and drops the probe.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
