/**
 * Lists the models installed on the user's running Ollama server, so the Discover/Correct
 * UIs can offer a visual model picker instead of making the user edit OLLAMA_MODEL by hand.
 *
 * Always returns 200 with a `models` array; a `note` carries any "not configured / can't
 * reach the server" message so the client can hint without treating it as a hard failure.
 */

import { NextResponse } from "next/server";
import { getOllamaStatus } from "@/server/integrations/ollama";

export const runtime = "nodejs";

export async function GET() {
  const { online, models } = await getOllamaStatus({ timeoutMs: 5000 });
  if (online) {
    return NextResponse.json({
      models,
      note:
        models.length === 0
          ? "No models installed — run `ollama pull llama3.1`."
          : undefined,
    });
  }
  return NextResponse.json({
    models: [],
    note: "PhraseLoop couldn't load Ollama models right now.",
  });
}
