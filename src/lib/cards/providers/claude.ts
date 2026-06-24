/**
 * A1 — ClaudeProvider. The default, highest-quality brain.
 *
 * Uses the Anthropic SDK with structured outputs (`output_config.format`) so every
 * mine/generate/critique call returns schema-valid JSON, and adaptive thinking so
 * the model reasons as much as each task needs. Defaults to `claude-opus-4-8` for
 * quality; pass a cheaper model (e.g. `claude-haiku-4-5`) for bulk runs.
 *
 * Anthropic has no embeddings endpoint, so this provider exposes no `embed()` —
 * semantic dedup (A5) falls back to its lexical path, which is fine for Claude's
 * already-high-precision card output.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  CardGenerationProvider,
  ConversationTurn,
  ConverseOptions,
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
  buildConverseSystem,
  buildCorrectRequest,
  buildCritiqueRequest,
  buildGenerateRequest,
  buildMineRequest,
  conversationMessages,
  normalizeCorrected,
  normalizeCritique,
  normalizeGenerated,
  normalizeMined,
  type JsonRequest,
} from "../shared";

export interface ClaudeProviderOptions {
  apiKey?: string;
  /** Generation model. Default `claude-opus-4-8`. */
  model?: string;
  /** Learner's first language, for translation glosses. */
  learnerLang?: string;
}

const DEFAULT_MODEL = "claude-opus-4-8";

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

export class ClaudeProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "claude";
  readonly label = "Claude (Anthropic)";
  readonly isLocal = false;

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly learnerLang: string;

  constructor(opts: ClaudeProviderOptions = {}) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.model = opts.model ?? DEFAULT_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
  }

  private async json<T>(req: JsonRequest<T>, options: GenerationRunOptions = {}): Promise<T> {
    // Stream: adaptive thinking at high effort can run for many seconds, and a non-streaming
    // call risks the SDK's HTTP timeout. Streaming keeps the connection alive; `finalMessage`
    // collects the whole response. `max_tokens` is a streaming-safe ceiling (thinking tokens
    // count against it) — small JSON output never reaches it, but it leaves room to think.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: req.schema } },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }, requestOptions(options));
    const res = await stream.finalMessage();
    // Handle the API's terminal states before touching content, so a refusal or a truncated
    // response becomes a clean per-card drop upstream instead of an unhandled crash.
    if (res.stop_reason === "refusal") {
      throw new Error("Claude declined to generate this card (safety refusal).");
    }
    if (res.stop_reason === "max_tokens") {
      throw new Error("Claude response was truncated before completing the JSON (max_tokens).");
    }
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Claude returned no text block to parse");
    }
    try {
      return JSON.parse(block.text) as T;
    } catch {
      throw new Error("Claude returned malformed JSON for a structured-output request.");
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
    const raw = await this.json(buildCorrectRequest(text, sourceLang, targetLang, opts.level), options);
    return normalizeCorrected(raw, sourceLang, targetLang, opts.context);
  }

  async converse(
    history: ConversationTurn[],
    opts: ConverseOptions,
    options: GenerationRunOptions = {},
  ): Promise<string> {
    // Plain text, not structured output: no thinking, modest cap — conversational turns
    // are short and need to come back fast.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      system: buildConverseSystem({ ...opts, sourceLang: opts.sourceLang ?? this.learnerLang }),
      messages: conversationMessages(history),
    }, requestOptions(options));
    const res = await stream.finalMessage();
    if (res.stop_reason === "refusal") {
      throw new Error("Claude declined to continue the conversation (safety refusal).");
    }
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Claude returned no text for the conversation turn.");
    }
    return block.text.trim();
  }
}
