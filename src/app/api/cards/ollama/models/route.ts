/**
 * Lists the models installed on the user's running Ollama server, so the Discover/Correct
 * UIs can offer a visual model picker instead of making the user edit OLLAMA_MODEL by hand.
 *
 * Always returns 200 with a `models` array; a `note` carries any "not configured / can't
 * reach the server" message so the client can hint without treating it as a hard failure.
 */

import { NextResponse } from "next/server";
import { isProviderAvailable } from "@/lib/cards/registry";
import { ollamaApiRoot } from "@/lib/cards/providers/ollama";

export const runtime = "nodejs";

interface OllamaTag {
  name?: string;
}

export async function GET() {
  if (!isProviderAvailable("ollama")) {
    return NextResponse.json({
      models: [],
      note: "Ollama não está configurado — defina OLLAMA_BASE_URL no .env.local.",
    });
  }

  try {
    const res = await fetch(`${ollamaApiRoot()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
    const data = (await res.json()) as { models?: OllamaTag[] };
    const models = (data.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({
      models,
      note:
        models.length === 0
          ? "Nenhum modelo instalado — rode `ollama pull llama3.1`."
          : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({
      models: [],
      note: `Não foi possível conectar ao Ollama (${message}). Ele está rodando?`,
    });
  }
}
