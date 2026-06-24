/**
 * A1 — OpenAIProvider. Parity backend for users who prefer GPT.
 *
 * Uses the OpenAI SDK with strict JSON-schema structured outputs for
 * mine/generate/critique, and the embeddings endpoint to give the pipeline real
 * semantic dedup (A5) — embedding cosine catches reworded duplicates that the
 * lexical fallback misses.
 */

import OpenAI from "openai";
import type {
  CardGenerationProvider,
  CorrectOptions,
  GenerationRunOptions,
  ProviderKind,
} from "../provider";
import type {
  Card,
  CardSource,
  Critique,
  DiscoveryRequest,
  ErrorEvent,
  PhraseCandidate,
  TranscriptSegment,
} from "../schema";
import {
  DEFAULT_LEARNER_LANG,
  buildCorrectRequest,
  buildCritiqueRequest,
  buildGenerateRequest,
  buildMineRequest,
  normalizeCorrected,
  normalizeCritique,
  normalizeGenerated,
  normalizeMined,
  type JsonRequest,
} from "../shared";

export interface OpenAIProviderOptions {
  apiKey?: string;
  /** Generation model. Default `gpt-4o`. */
  model?: string;
  /** Embedding model for semantic dedup. Default `text-embedding-3-small`. */
  embedModel?: string;
  learnerLang?: string;
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

function requestOptions(options: GenerationRunOptions): {
  signal?: AbortSignal;
  timeout?: number;
  maxRetries: 0;
} | undefined {
  if (!options.signal && options.timeoutMs == null) return undefined;
  return {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs != null ? { timeout: options.timeoutMs } : {}),
    maxRetries: 0,
  };
}

export class OpenAIProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "openai";
  readonly label = "GPT (OpenAI)";
  readonly isLocal = false;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embedModel: string;
  private readonly learnerLang: string;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client = new OpenAI(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.model = opts.model ?? DEFAULT_MODEL;
    this.embedModel = opts.embedModel ?? DEFAULT_EMBED_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
  }

  private async json<T>(req: JsonRequest<T>, options: GenerationRunOptions = {}): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", schema: req.schema, strict: true },
      },
    }, requestOptions(options));
    const choice = res.choices[0];
    // A length finish means the JSON was cut off; a refusal means no usable content. Both
    // surface as a clean per-card drop upstream rather than a malformed-parse crash.
    if (choice?.finish_reason === "length") {
      throw new Error("OpenAI response was truncated before completing the JSON (length).");
    }
    if (choice?.message?.refusal) {
      throw new Error(`OpenAI declined this card: ${choice.message.refusal}`);
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("OpenAI returned no content to parse");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("OpenAI returned malformed JSON for a structured-output request.");
    }
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
    options?: GenerationRunOptions,
  ): Promise<PhraseCandidate[]> {
    const raw = await this.json(buildMineRequest(transcript, request, this.learnerLang), options);
    return normalizeMined(raw, transcript, request);
  }

  async generate(source: CardSource, options?: GenerationRunOptions): Promise<Card[]> {
    const raw = await this.json(buildGenerateRequest(source, this.learnerLang), options);
    return normalizeGenerated(raw, source);
  }

  async critique(
    card: Card,
    source: CardSource,
    options?: GenerationRunOptions,
  ): Promise<Critique> {
    const raw = await this.json(buildCritiqueRequest(card, source), options);
    return normalizeCritique(raw, card);
  }

  async correct(
    text: string,
    opts: CorrectOptions = {},
    options?: GenerationRunOptions,
  ): Promise<ErrorEvent[]> {
    const sourceLang = opts.sourceLang ?? this.learnerLang;
    const targetLang = opts.targetLang ?? "en";
    const raw = await this.json(buildCorrectRequest(text, sourceLang, targetLang), options);
    return normalizeCorrected(raw, sourceLang, targetLang, opts.context);
  }

  /** Real semantic dedup (A5): one embedding per card fingerprint. */
  async embed(texts: string[], options: GenerationRunOptions = {}): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.client.embeddings.create({
      model: this.embedModel,
      input: texts,
    }, requestOptions(options));
    return res.data.map((d) => d.embedding);
  }
}
