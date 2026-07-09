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
  ConversationTurn,
  ConverseOptions,
  CorrectOptions,
  GenerationRunOptions,
  ProviderKind,
} from "../provider";
import type {
  AdvancedReview,
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
  DEFAULT_TARGET_LANG,
  buildAdvancedReviewRequest,
  buildConverseSystem,
  buildCorrectRequest,
  buildCritiqueRequest,
  buildGenerateRequest,
  buildMineRequest,
  conversationMessages,
  normalizeAdvancedReview,
  normalizeCorrected,
  normalizeCritique,
  normalizeGenerated,
  normalizeMined,
  type JsonRequest,
} from "../shared";
import { requestOptions } from "./util";

export interface OpenAIProviderOptions {
  apiKey?: string;
  /** Generation model. Default `gpt-4o`. */
  model?: string;
  /** Embedding model for semantic dedup. Default `text-embedding-3-small`. */
  embedModel?: string;
  learnerLang?: string;
  targetLang?: string;
  /** CEFR level; B2+ produces monolingual (target-language) cards. */
  level?: string;
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

export class OpenAIProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "openai";
  readonly label = "GPT (OpenAI)";
  readonly isLocal = false;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embedModel: string;
  private readonly learnerLang: string;
  private readonly targetLang: string;
  private readonly level?: string;
  readonly embeddingCacheKey: string;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client = new OpenAI(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.model = opts.model ?? DEFAULT_MODEL;
    this.embedModel = opts.embedModel ?? DEFAULT_EMBED_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
    this.targetLang = opts.targetLang ?? DEFAULT_TARGET_LANG;
    this.level = opts.level;
    this.embeddingCacheKey = `${this.kind}:${this.embedModel}`;
  }

  private async json<T>(
    req: JsonRequest<T>,
    options: GenerationRunOptions = {},
  ): Promise<T> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", schema: req.schema, strict: true },
        },
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    // A length finish means the JSON was cut off; a refusal means no usable content. Both
    // surface as a clean per-card drop upstream rather than a malformed-parse crash.
    if (choice?.finish_reason === "length") {
      throw new Error(
        "OpenAI response was truncated before completing the JSON (length).",
      );
    }
    if (choice?.message?.refusal) {
      throw new Error(`OpenAI declined this card: ${choice.message.refusal}`);
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("OpenAI returned no content to parse");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        "OpenAI returned malformed JSON for a structured-output request.",
      );
    }
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
    options?: GenerationRunOptions,
  ): Promise<PhraseCandidate[]> {
    const raw = await this.json(
      buildMineRequest(transcript, request, this.learnerLang),
      options,
    );
    return normalizeMined(raw, transcript, request);
  }

  async generate(
    source: CardSource,
    options?: GenerationRunOptions,
  ): Promise<Card[]> {
    const raw = await this.json(
      buildGenerateRequest(source, this.learnerLang, this.targetLang, this.level),
      options,
    );
    return normalizeGenerated(raw, source);
  }

  async critique(
    card: Card,
    source: CardSource,
    options?: GenerationRunOptions,
  ): Promise<Critique> {
    const raw = await this.json(buildCritiqueRequest(card, source, this.level), options);
    return normalizeCritique(raw, card);
  }

  async correct(
    text: string,
    opts: CorrectOptions = {},
    options?: GenerationRunOptions,
  ): Promise<ErrorEvent[]> {
    const sourceLang = opts.sourceLang ?? this.learnerLang;
    const targetLang = opts.targetLang ?? "en";
    const raw = await this.json(
      buildCorrectRequest(text, sourceLang, targetLang, opts.level),
      options,
    );
    return normalizeCorrected(raw, sourceLang, targetLang, opts.context);
  }

  async review(
    text: string,
    opts: CorrectOptions = {},
    options?: GenerationRunOptions,
  ): Promise<AdvancedReview> {
    const sourceLang = opts.sourceLang ?? this.learnerLang;
    const targetLang = opts.targetLang ?? "en";
    const raw = await this.json(
      buildAdvancedReviewRequest(text, sourceLang, targetLang, opts.level),
      options,
    );
    return normalizeAdvancedReview(raw, sourceLang, targetLang, opts.context);
  }

  async converse(
    history: ConversationTurn[],
    opts: ConverseOptions,
    options: GenerationRunOptions = {},
  ): Promise<string> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: buildConverseSystem({
              ...opts,
              sourceLang: opts.sourceLang ?? this.learnerLang,
            }),
          },
          ...conversationMessages(history),
        ],
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    if (choice?.message?.refusal) {
      throw new Error(
        `OpenAI declined to continue the conversation: ${choice.message.refusal}`,
      );
    }
    const text = choice?.message?.content;
    if (!text)
      throw new Error("OpenAI returned no content for the conversation turn.");
    return text.trim();
  }

  async complete(
    prompt: string,
    options: GenerationRunOptions = {},
  ): Promise<string> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: 15000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    if (choice?.message?.refusal) {
      throw new Error(`OpenAI declined the request: ${choice.message.refusal}`);
    }
    if (choice?.finish_reason === "length") {
      throw new Error(
        "Response was too long and got cut off. Try a shorter plan (fewer days).",
      );
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("OpenAI returned no content.");
    return text.trim();
  }

  /** Real semantic dedup (A5): one embedding per card fingerprint. */
  async embed(
    texts: string[],
    options: GenerationRunOptions = {},
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.client.embeddings.create(
      {
        model: this.embedModel,
        input: texts,
      },
      requestOptions(options),
    );
    return res.data.map((d) => d.embedding);
  }
}
