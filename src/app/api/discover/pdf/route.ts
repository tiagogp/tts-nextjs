import { NextRequest, NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

const PUBLIC_PDF_ERROR =
  "Couldn't extract this PDF right now. Try another file or try again later.";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Attach a PDF file." }, { status: 400 });
    }
    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      return NextResponse.json({ error: "PDF too large (max 25 MB)." }, { status: 413 });
    }

    const res = await localRequest("/discover/pdf", {
      method: "POST",
      body: Buffer.from(await file.arrayBuffer()),
      headers: {
        "Content-Type": file.type || "application/pdf",
        "X-File-Name": encodeURIComponent(file.name || "upload.pdf"),
      },
      timeoutMs: 120_000,
    });

    if (res.status < 200 || res.status >= 300) {
      logger.error({ status: res.status, body: res.body.toString("utf8") }, "PDF runtime error");
      return NextResponse.json(
        { error: PUBLIC_PDF_ERROR },
        { status: res.status },
      );
    }

    return NextResponse.json(res.json());
  } catch (err: unknown) {
    logger.error({ err }, "PDF proxy error");
    return NextResponse.json({ error: PUBLIC_PDF_ERROR }, { status: 500 });
  }
}
