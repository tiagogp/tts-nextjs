/**
 * Lists the card-generation providers usable in this environment, so the Discover
 * UI can offer "run locally" vs a cloud provider based on which API keys are set.
 */

import { NextResponse } from "next/server";
import { providerRegistry, isProviderAvailable } from "@/lib/cards/registry";
import { isOllamaReachable } from "@/server/integrations/ollama";
import type { ProviderKind } from "@/lib/cards/provider";
import { PROVIDER_FALLBACK_LABELS } from "@/app/api/cards/_lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const ollamaReachable = await isOllamaReachable();
  const providers = await Promise.all(
    (Object.keys(providerRegistry) as ProviderKind[]).map(async (kind) => {
      const available = kind === "ollama" ? ollamaReachable : await isProviderAvailable(kind);
      const label = available ? providerRegistry[kind]().label : PROVIDER_FALLBACK_LABELS[kind];
      return { kind, label, available };
    }),
  );
  return NextResponse.json({ providers });
}
