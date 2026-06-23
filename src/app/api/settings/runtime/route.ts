import { NextResponse } from "next/server";
import {
  isInternalSettingsRequest,
  replaceRuntimeAiSettings,
} from "@/server/aiSettings";
import type { ProviderKind } from "@/lib/cards/provider";
import type { SecureAiSettings } from "@/types/aiSettings";
import { isProviderKind, optionalString, readJsonObject } from "@/server/http/validation";

export const runtime = "nodejs";

function provider(v: unknown): ProviderKind | undefined {
  return isProviderKind(v) ? v : undefined;
}

function value(v: unknown, max: number): string | undefined {
  return optionalString(v, max);
}

export async function PUT(req: Request) {
  if (!isInternalSettingsRequest(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const raw = await readJsonObject(req);
  if (!raw) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  const settings: SecureAiSettings = {
    defaultProvider: provider(raw.defaultProvider),
    ollamaBaseUrl: value(raw.ollamaBaseUrl, 2048),
    ollamaModel: value(raw.ollamaModel, 100),
    anthropicApiKey: value(raw.anthropicApiKey, 500),
    openaiApiKey: value(raw.openaiApiKey, 500),
  };
  replaceRuntimeAiSettings(settings);
  return NextResponse.json({ ok: true });
}
