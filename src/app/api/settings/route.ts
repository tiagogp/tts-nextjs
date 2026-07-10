import { NextRequest, NextResponse } from "next/server";
import { providerRegistry, isProviderAvailable } from "@/lib/cards/registry";
import type { ProviderKind } from "@/lib/cards/provider";
import {
  getDefaultProvider,
  getOllamaBaseUrl,
  getOllamaModel,
  getRuntimeAiSettings,
  replaceRuntimeAiSettings,
  isAuthorizedSettingsRequest,
  getSettingsVersion,
} from "@/server/aiSettings";
import type { ProviderStatus, PublicAiSettings } from "@/types/aiSettings";
import { getOllamaStatus, ollamaRoot } from "@/server/integrations/ollama";
import { isProviderKind, optionalString, readJsonObject } from "@/server/http/validation";
import { MAX_SETTINGS_JSON_BYTES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELS: Record<ProviderKind, string> = {
  ollama: "Ollama",
  claude: "Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

export async function GET() {
  const root = ollamaRoot(getOllamaBaseUrl());
  const { models, online: ollamaOnline } = await getOllamaStatus({ baseUrl: root });

  const order: ProviderKind[] = ["ollama", "openrouter", "claude", "openai"];
  const providers: ProviderStatus[] = order.map((kind) => {
    const configured = kind === "ollama" ? true : isProviderAvailable(kind);
    const available = kind === "ollama" ? ollamaOnline && models.length > 0 : configured;
    return {
      kind,
      label: LABELS[kind] || providerRegistry[kind]().label,
      isLocal: kind === "ollama",
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
    storage: process.env.PHRASELOOP_SETTINGS_TOKEN
      ? process.env.PHRASELOOP_SETTINGS_STORAGE === "local-file"
        ? "local-file"
        : "system"
      : "readonly",
    version: getSettingsVersion(),
  };
  const response = NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  const token = process.env.PHRASELOOP_SETTINGS_TOKEN;
  if (token) {
    response.cookies.set("pl-settings-token", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
  }
  return response;
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorizedSettingsRequest(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const raw = await readJsonObject(req, { maxBytes: MAX_SETTINGS_JSON_BYTES });
  if (!raw) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  const current = getRuntimeAiSettings();
  const next = { ...current };
  if (isProviderKind(raw.defaultProvider)) {
    next.defaultProvider = raw.defaultProvider;
  }
  const stringFields: { key: "ollamaBaseUrl" | "ollamaModel" | "anthropicApiKey" | "openaiApiKey" | "openrouterApiKey"; max: number }[] = [
    { key: "ollamaBaseUrl", max: 2048 },
    { key: "ollamaModel", max: 100 },
    { key: "anthropicApiKey", max: 500 },
    { key: "openaiApiKey", max: 500 },
    { key: "openrouterApiKey", max: 500 },
  ];
  for (const { key, max } of stringFields) {
    if (!(key in raw)) continue;
    const val = optionalString(raw[key], max);
    if (val) next[key] = val;
    else delete next[key];
  }
  replaceRuntimeAiSettings(next);
  return NextResponse.json({ ok: true, version: getSettingsVersion() });
}
