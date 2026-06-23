import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  getOllamaBaseUrl,
  getProviderApiKey,
  isInternalSettingsRequest,
} from "@/server/aiSettings";
import { ollamaRoot } from "@/server/integrations/ollama";
import { readJsonObject } from "@/server/http/validation";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export async function POST(req: Request) {
  if (!isInternalSettingsRequest(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const raw = await readJsonObject(req);
  if (!raw) {
    return NextResponse.json({ ok: false, detail: "Invalid test request." }, { status: 400 });
  }

  try {
    if (raw.provider === "ollama") {
      const root = ollamaRoot(str(raw.ollamaBaseUrl, 2048) || getOllamaBaseUrl());
      const response = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Ollama did not accept the connection.");
      return NextResponse.json({ ok: true, detail: "Connected to Ollama." });
    }
    if (raw.provider === "claude") {
      const apiKey = str(raw.anthropicApiKey, 500) || getProviderApiKey("claude");
      if (!apiKey) return NextResponse.json({ ok: false, detail: "Enter an Anthropic API key." });
      await new Anthropic({ apiKey }).models.list({ limit: 1 });
      return NextResponse.json({ ok: true, detail: "Connected to Claude." });
    }
    if (raw.provider === "openai") {
      const apiKey = str(raw.openaiApiKey, 500) || getProviderApiKey("openai");
      if (!apiKey) return NextResponse.json({ ok: false, detail: "Enter an OpenAI API key." });
      await new OpenAI({ apiKey }).models.list();
      return NextResponse.json({ ok: true, detail: "Connected to OpenAI." });
    }
    return NextResponse.json({ ok: true, detail: "The Local provider is always available." });
  } catch {
    return NextResponse.json({ ok: false, detail: "Connection failed. Check the address or credential." });
  }
}
