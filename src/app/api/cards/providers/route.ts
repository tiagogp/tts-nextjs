/**
 * Lists the card-generation providers usable in this environment, so the Discover
 * UI can offer "run locally" vs a cloud provider based on which API keys are set.
 */

import { NextResponse } from "next/server";
import { providerRegistry, isProviderAvailable } from "@/lib/cards/registry";
import { isOllamaReachable } from "@/lib/cards/providers/ollama";
import type { ProviderKind } from "@/lib/cards/provider";

export const runtime = "nodejs";

// Cloud provider constructors throw when their API key is missing, so we only
// instantiate available ones; these labels stand in for the rest in the selector.
const FALLBACK_LABELS: Record<ProviderKind, string> = {
  local: "Local (private, on-device)",
  ollama: "Ollama (local LLM)",
  claude: "Claude (Anthropic)",
  openai: "OpenAI (GPT)",
};

export async function GET() {
  const ollamaReachable = await isOllamaReachable();
  const providers = (Object.keys(providerRegistry) as ProviderKind[]).map((kind) => {
    const available =
      kind === "ollama" ? ollamaReachable : isProviderAvailable(kind);
    const label = available ? providerRegistry[kind]().label : FALLBACK_LABELS[kind];
    return { kind, label, available };
  });
  return NextResponse.json({ providers });
}
