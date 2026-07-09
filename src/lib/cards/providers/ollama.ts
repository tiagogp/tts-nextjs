/**
 * A1 — OllamaProvider. A local *LLM* backend, for users running Ollama on their own machine.
 *
 * The on-device LLM option: it runs a real model so it can `correct()` free text and write
 * understanding-testing cards, but nothing leaves the machine (unlike the cloud providers).
 * Ollama exposes an OpenAI-compatible API, so we reuse the
 * OpenAI SDK pointed at the local endpoint and the same shared request builders the cloud
 * providers use — the only differences are the base URL, no real key, and lenient JSON parsing
 * (local models are less reliable at strict structured output than the cloud ones).
 *
 * Configure with OLLAMA_BASE_URL (e.g. http://localhost:11434) to enable it, and optionally
 * OLLAMA_MODEL to pick the model. No embeddings backend is wired up, so semantic dedup (A5)
 * falls back to its lexical path.
 */

import OpenAI from "openai";
import { getOllamaBaseUrl, getOllamaModel } from "@/server/aiSettings";
import { ollamaRoot } from "@/server/integrations/ollama";
import { extractJson, requestOptions } from "./util";
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

export interface OllamaProviderOptions {
  /** Base URL of the running Ollama server. Default from OLLAMA_BASE_URL, else localhost. */
  baseUrl?: string;
  /** Model tag, e.g. "llama3.1" or "qwen2.5". Default from OLLAMA_MODEL, else "llama3.1". */
  model?: string;
  learnerLang?: string;
  targetLang?: string;
  /** CEFR level; B2+ produces monolingual (target-language) cards. */
  level?: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1";

/** The Ollama server root (no `/v1`), for its native API like `/api/tags`. */
export function ollamaApiRoot(explicit?: string): string {
  return ollamaRoot(explicit ?? getOllamaBaseUrl() ?? DEFAULT_BASE_URL);
}

/** Where to reach Ollama, normalized to the OpenAI-compatible `/v1` root. */
export function ollamaBaseUrl(explicit?: string): string {
  return `${ollamaApiRoot(explicit)}/v1`;
}

export class OllamaProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "ollama";
  readonly label = "Ollama (local LLM)";
  readonly isLocal = true;
  // Local models are slow; the per-card critique round-trip multiplies wall time and would
  // push multi-correction decks past the request timeout. Grounding + the per-source card
  // cap stand in for the quality gate here.
  readonly skipCritique = true;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly learnerLang: string;
  private readonly targetLang: string;
  private readonly level?: string;

  constructor(opts: OllamaProviderOptions = {}) {
    // Ollama ignores the key but the SDK requires one; "ollama" is the conventional placeholder.
    this.client = new OpenAI({
      baseURL: ollamaBaseUrl(opts.baseUrl),
      apiKey: "ollama",
    });
    this.model = opts.model ?? getOllamaModel() ?? DEFAULT_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
    this.targetLang = opts.targetLang ?? DEFAULT_TARGET_LANG;
    this.level = opts.level;
  }

  private async json<T>(
    req: JsonRequest<T>,
    options: GenerationRunOptions = {},
    maxTokens = 1500,
  ): Promise<T> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        // Deterministic-ish output for a structured task; local models drift more at high temp.
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          // Reinforce the contract in-band — not every Ollama build honors response_format.
          {
            role: "system",
            content: `${req.system}\n\nRespond with ONLY a single JSON object that satisfies the requested schema. No prose, no markdown fences.`,
          },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", schema: req.schema },
        },
      },
      requestOptions(options),
    );
    const choice = res.choices[0];
    if (choice?.finish_reason === "length") {
      throw new Error(
        "Ollama response was truncated before completing the JSON (length).",
      );
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("Ollama returned no content to parse");
    try {
      return JSON.parse(extractJson(text)) as T;
    } catch {
      throw new Error(
        "Ollama returned malformed JSON — try a more capable model in OLLAMA_MODEL.",
      );
    }
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
    options?: GenerationRunOptions,
  ): Promise<PhraseCandidate[]> {
    // Mine may return 20+ phrases at ~100 tokens each; 4096 handles most transcripts
    // while 8192 covers the MAX_MINE_SEGMENTS (400-segment) worst case.
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
        // A bit of warmth for natural dialogue (vs. 0 for the structured tasks); bounded so a
        // local model can't ramble past the request timeout.
        temperature: 0.7,
        max_tokens: 512,
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
      throw new Error("Ollama returned no content for the conversation turn.");
    return text.trim();
  }

  async complete(
    prompt: string,
    options: GenerationRunOptions = {},
  ): Promise<string> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: 0,
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
    if (!text) throw new Error("Ollama returned no content.");
    return text.trim();
  }
}
