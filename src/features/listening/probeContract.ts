/**
 * Shared contract between the probe API route and its client.
 *
 * `PROBE_PROMPT_VERSION` is part of the judge stamp: the same model with a rewritten
 * question rubric writes a different test, and a comprehension rate that spans two rubrics
 * is not a trend. Bump it whenever `buildProbePrompt` changes in a way that would alter the
 * questions produced.
 */

import type { ColdProbeQuestion } from "./coldProbeBank";
import type { JudgeStamp } from "@/lib/evaluation/judge";

export const PROBE_PROMPT_VERSION = "2026-08-27";

export interface GeneratedProbe {
  questions: ColdProbeQuestion[];
  judge: JudgeStamp;
}
