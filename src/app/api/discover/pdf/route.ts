import { NextRequest, NextResponse } from "next/server";
import { getTtsServerUrl } from "@/server/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 120;

const TTS_SERVER = getTtsServerUrl();
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Attach a PDF file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF too large (max 25 MB)." }, { status: 413 });
    }

    // Re-wrap into a fresh FormData so we forward exactly the file the backend expects.
    const forward = new FormData();
    forward.append("file", file, file.name || "upload.pdf");

    const res = await fetch(`${TTS_SERVER}/discover/pdf`, {
      method: "POST",
      body: forward,
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        (data as { detail?: string }).detail ?? `Extraction error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    console.error("PDF proxy error:", err);
    const isConnRefused =
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"));
    const message = isConnRefused
      ? "The backend is not running. Run: uvicorn tts_server:app --port 5002"
      : err instanceof Error
        ? err.message
        : "Failed to extract the PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
