import { NextResponse } from "next/server";
import { providerRegistry, isProviderAvailable } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import {
  getDefaultProvider,
  getOllamaBaseUrl,
  getOllamaModel,
} from "@/server/aiSettings";
import type { ProviderStatus, PublicAiSettings } from "@/types/aiSettings";
import { getOllamaStatus, ollamaRoot } from "@/server/integrations/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELS: Record<ProviderKind, string> = {
  ollama: "Ollama",
  claude: "Claude",
  openai: "OpenAI",
  local: "Local heuristic",
};

export async function GET() {
  const root = ollamaRoot(getOllamaBaseUrl());
  const { models, online: ollamaOnline } = await getOllamaStatus({ baseUrl: root });

  const order: ProviderKind[] = ["ollama", "claude", "openai", "local"];
  const providers: ProviderStatus[] = order.map((kind) => {
    const configured = kind === "ollama" ? true : isProviderAvailable(kind);
    const available = kind === "ollama" ? ollamaOnline && models.length > 0 : configured;
    return {
      kind,
      label: LABELS[kind] || providerRegistry[kind]().label,
      isLocal: kind === "ollama" || kind === "local",
      configured,
      available,
      state:
        kind === "ollama"
          ? ollamaOnline
            ? models.length > 0
              ? "connected"
              : "not_configured"
            : "offline"
          : configured
            ? "connected"
            : "not_configured",
      detail:
        kind === "ollama" && ollamaOnline && models.length === 0
          ? "Ollama is running, but no models are installed."
          : undefined,
    };
  });

  const settings: PublicAiSettings = {
    defaultProvider: getDefaultProvider(),
    ollama: {
      baseUrl: root,
      model: getOllamaModel() || models[0] || "",
      models,
    },
    providers,
    writable: Boolean(process.env.PHRASELOOP_SETTINGS_TOKEN),
  };
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}
