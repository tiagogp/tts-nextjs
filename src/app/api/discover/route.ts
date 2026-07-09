import { NextRequest } from "next/server";
import { localRequest } from "@/server/localRuntime";
import { httpUrl, readJsonObject } from "@/server/http/validation";
import { MAX_SETTINGS_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 450;

function safeLang(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return /^[a-z]{2}$/.test(s) ? s : null;
}

function sseChunk(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

const PUBLIC_YOUTUBE_INPUT_ERROR =
  "Cole um link http(s) válido do YouTube ou continue pela lição inicial e Estudar.";

export async function POST(req: NextRequest) {
  let url: string | null = null;
  let lang: string | null = null;

  try {
    const bodyObj = await readJsonObject(req, { maxBytes: MAX_SETTINGS_JSON_BYTES });
    url = httpUrl(bodyObj?.url);
    lang = safeLang(bodyObj?.lang);
  } catch {
    return new Response(JSON.stringify({ error: PUBLIC_YOUTUBE_INPUT_ERROR }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!url) {
    return new Response(JSON.stringify({ error: PUBLIC_YOUTUBE_INPUT_ERROR }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const finalUrl = url;
  const finalLang = lang;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await localRequest("/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: finalUrl, lang: finalLang }),
          timeoutMs: 450_000,
          onProgress: (percent, stage) => {
            try {
              controller.enqueue(sseChunk({ type: "progress", percent, stage }));
            } catch {}
          },
        });

        if (res.status < 200 || res.status >= 300) {
          logger.error({ status: res.status, body: res.body.toString("utf8") }, "Discover runtime error");
          controller.enqueue(sseChunk({ type: "error", message: "Não consegui importar esse vídeo. Tente um vídeo público com menos de 15 minutos ou volte para a lição inicial." }));
        } else {
          controller.enqueue(sseChunk({ type: "done", result: res.json() }));
        }
      } catch (err: unknown) {
        logger.error({ err }, "Discover proxy error");
        const message =
          err instanceof Error && err.name === "TimeoutError"
            ? "O processamento demorou demais. Tente um vídeo público com menos de 15 minutos ou volte para a lição inicial."
            : "Não consegui importar esse vídeo. Tente um vídeo público com menos de 15 minutos ou volte para a lição inicial.";
        try {
          controller.enqueue(sseChunk({ type: "error", message }));
        } catch {}
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
