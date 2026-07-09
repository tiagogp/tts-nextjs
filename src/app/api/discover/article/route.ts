import { NextRequest, NextResponse } from "next/server";
import { localJson } from "@/server/localRuntime";
import { httpUrl, readJsonObject } from "@/server/http/validation";
import { MAX_SETTINGS_JSON_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

const PUBLIC_ARTICLE_ERROR =
  "Não consegui abrir esse artigo. Tente outro link ou continue pela lição inicial e Estudar.";

export async function POST(req: NextRequest) {
  try {
    const bodyObj = await readJsonObject(req, { maxBytes: MAX_SETTINGS_JSON_BYTES });
    const url = httpUrl(bodyObj?.url);
    if (!url) {
      return NextResponse.json(
        { error: "Cole um link http(s) válido para importar um artigo." },
        { status: 400 },
      );
    }

    const res = await localJson("/discover/article", { url }, 120_000);

    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, body: res.body.toString("utf8") }, "Article runtime error");
      return NextResponse.json(
        { error: PUBLIC_ARTICLE_ERROR },
        { status: res.status },
      );
    }

    return NextResponse.json(res.json());
  } catch (err: unknown) {
    logger.error({ err }, "Article proxy error");
    return NextResponse.json({ error: PUBLIC_ARTICLE_ERROR }, { status: 500 });
  }
}
