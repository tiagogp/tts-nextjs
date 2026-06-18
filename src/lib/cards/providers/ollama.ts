/**
 * A1 — OllamaProvider. A local *LLM* backend, for users running Ollama on their own machine.
 *
 * Sits between the heuristic LocalProvider (no model, zero config) and the cloud providers:
 * it runs a real model so it can `correct()` free text and write understanding-testing cards,
 * but nothing leaves the machine. Ollama exposes an OpenAI-compatible API, so we reuse the
 * OpenAI SDK pointed at the local endpoint and the same shared request builders the cloud
 * providers use — the only differences are the base URL, no real key, and lenient JSON parsing
 * (local models are less reliable at strict structured output than the cloud ones).
 *
 * Configure with OLLAMA_BASE_URL (e.g. http://localhost:11434) to enable it, and optionally
 * OLLAMA_MODEL to pick the model. No embeddings backend is wired up, so semantic dedup (A5)
 * falls back to its lexical path.
 */

import OpenAI from "openai";
import type { CardGenerationProvider, CorrectOptions, ProviderKind } from "../provider";
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

export interface OllamaProviderOptions {
  /** Base URL of the running Ollama server. Default from OLLAMA_BASE_URL, else localhost. */
  baseUrl?: string;
  /** Model tag, e.g. "llama3.1" or "qwen2.5". Default from OLLAMA_MODEL, else "llama3.1". */
  model?: string;
  learnerLang?: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1";

/** The Ollama server root (no `/v1`), for its native API like `/api/tags`. */
export function ollamaApiRoot(explicit?: string): string {
  return (explicit ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL)
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
}

/** Where to reach Ollama, normalized to the OpenAI-compatible `/v1` root. */
export function ollamaBaseUrl(explicit?: string): string {
  return `${ollamaApiRoot(explicit)}/v1`;
}

/**
 * Pull the first JSON object out of a model response. Local models often wrap JSON in
 * markdown fences or add a sentence of preamble, so we strip fences and, failing a clean
 * parse, fall back to the outermost {...} span before giving up.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    JSON.parse(body);
    return body;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start !== -1 && end > start) return body.slice(start, end + 1);
    return body;
  }
}

export class OllamaProvider implements CardGenerationProvider {
  readonly kind: ProviderKind = "ollama";
  readonly label = "Ollama (local LLM)";
  readonly isLocal = true;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly learnerLang: string;

  constructor(opts: OllamaProviderOptions = {}) {
    // Ollama ignores the key but the SDK requires one; "ollama" is the conventional placeholder.
    this.client = new OpenAI({ baseURL: ollamaBaseUrl(opts.baseUrl), apiKey: "ollama" });
    this.model = opts.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
    this.learnerLang = opts.learnerLang ?? DEFAULT_LEARNER_LANG;
  }

  private async json<T>(req: JsonRequest<T>): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      // Deterministic-ish output for a structured task; local models drift more at high temp.
      temperature: 0,
      messages: [
        // Reinforce the contract in-band — not every Ollama build honors response_format.
        { role: "system", content: `${req.system}\n\nRespond with ONLY a single JSON object that satisfies the requested schema. No prose, no markdown fences.` },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", schema: req.schema },
      },
    });
    const choice = res.choices[0];
    if (choice?.finish_reason === "length") {
      throw new Error("Ollama response was truncated before completing the JSON (length).");
    }
    const text = choice?.message?.content;
    if (!text) throw new Error("Ollama returned no content to parse");
    try {
      return JSON.parse(extractJson(text)) as T;
    } catch {
      throw new Error("Ollama returned malformed JSON — try a more capable model in OLLAMA_MODEL.");
    }
  }

  async mine(
    transcript: TranscriptSegment[],
    request: DiscoveryRequest,
  ): Promise<PhraseCandidate[]> {
    const raw = await this.json(buildMineRequest(transcript, request, this.learnerLang));
    return normalizeMined(raw, transcript, request);
  }

  async generate(source: CardSource): Promise<Card[]> {
    const raw = await this.json(buildGenerateRequest(source, this.learnerLang));
    return normalizeGenerated(raw, source);
  }

  async critique(card: Card, source: CardSource): Promise<Critique> {
    const raw = await this.json(buildCritiqueRequest(card, source));
    return normalizeCritique(raw, card);
  }

  async correct(text: string, opts: CorrectOptions = {}): Promise<ErrorEvent[]> {
    const sourceLang = opts.sourceLang ?? this.learnerLang;
    const targetLang = opts.targetLang ?? "en";
    const raw = await this.json(buildCorrectRequest(text, sourceLang, targetLang));
    return normalizeCorrected(raw, sourceLang, targetLang);
  }
}
