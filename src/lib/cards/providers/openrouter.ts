/**
 * A1 — OpenRouterProvider. The default cloud backend, routed through OpenRouter.
 *
 * OpenRouter exposes an OpenAI-compatible API to 400+ models, so we reuse the OpenAI SDK
 * pointed at `https://openrouter.ai/api/v1` and the same shared request builders the other
 * providers use — the only differences are the base URL, the OpenRouter key, and lenient
 * JSON parsing (the default model is `openrouter/free`, a router over free models that don't
 * reliably honor structured-output mode, so we can't rely on it).
 *
 * Configure with OPENROUTER_API_KEY (or save it in Settings); OPENROUTER_MODEL overrides the
 * default model. No embeddings backend is wired up, so semantic dedup (A5) falls back to its
 * lexical path.
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
import { extractJson, requestOptions } from "./util";

export interface OpenRouterProviderOptions {
  apiKey?: string;
  /** OpenRouter model slug. Default from OPENROUTER_MODEL, else `openrouter/free`. */
  model?: string;
  learnerLang?: string;
  targetLang?: string;
  /** CEFR level; B2+ produces monolingual (target-language) cards. */
  level?: string;
}

const BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/free";

export class OpenRouterProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "openrouter";
  readonly label = "OpenRouter";
  readonly isLocal = false;
  // The default `openrouter/free` route picks free models that are slower and rate-limited, so a
  // per-card critique round-trip would double the request count against those limits; grounding +
  // the per-source card cap stand in for the quality gate here.
  readonly skipCritique = true;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly learnerLang: string;
  private readonly targetLang: string;
  private readonly level?: string;

  constructor(opts: OpenRouterProviderOptions = {}) {
    this.client = new OpenAI({
      baseURL: BASE_URL,
      apiKey: opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? "",
      // Optional attribution headers for the OpenRouter leaderboards.
      defaultHeaders: {
        "HTTP-Referer": "https://phraseloop.app",
        "X-Title": "PhraseLoop",
      },
    });
    this.model = opts.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
    this.targetLang = opts.targetLang ?? DEFAULT_TARGET_LANG;
    this.level = opts.level;
  }

  private async json<T>(
    req: JsonRequest<T>,
    options: GenerationRunOptions = {},
    maxTokens = 4000,
  ): Promise<T> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          // Reinforce the JSON contract in-band: not every OpenRouter model (least of all the free
          // ones) honors response_format, so we don't rely on it.
          {
            role: "system",
            content: `${req.system}\n\nRespond with ONLY a single JSON object that satisfies the requested schema. No prose, no markdown fences.`,
          },
          { role: "user", content: req.user },
        ],
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    if (choice?.finish_reason === "length") {
      throw new Error(
        "OpenRouter response was truncated before completing the JSON (length).",
      );
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("OpenRouter returned no content to parse");
    try {
      return JSON.parse(extractJson(text)) as T;
    } catch {
      throw new Error(
        "OpenRouter returned malformed JSON — try a different model in OPENROUTER_MODEL.",
      );
    }
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
    options?: GenerationRunOptions,
  ): Promise<PhraseCandidate[]> {
    // Mine may return 20+ phrases at ~100 tokens each; scale the budget with the transcript.
    const maxTokens = Math.max(4096, Math.ceil(transcript.length * 0.2) * 100);
    const raw = await this.json(
      buildMineRequest(transcript, request, this.learnerLang),
      options,
      maxTokens,
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
    const text = choice?.message?.content;
    if (!text)
      throw new Error(
        "OpenRouter returned no content for the conversation turn.",
      );
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
        messages: [{ role: "user", content: prompt }],
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    if (choice?.finish_reason === "length") {
      throw new Error(
        "Response was too long and got cut off. Try a shorter plan (fewer days).",
      );
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("OpenRouter returned no content.");
    return text.trim();
  }
}
