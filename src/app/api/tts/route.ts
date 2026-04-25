import { NextRequest, NextResponse } from "next/server";

const TTS_SERVER = "http://localhost:5002";

export async function POST(req: NextRequest) {
  try {
    const { text, voice, speed, engine } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }
    if (text.length > 4096) {
      return NextResponse.json(
        { error: "Text exceeds 4096 characters." },
        { status: 400 },
      );
    }

    const ttsRes = await fetch(`${TTS_SERVER}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        voice: voice ?? "female-1",
        speed: Math.min(Math.max(Number(speed) || 1.0, 0.5), 2.0),
        engine: engine ?? "vits",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!ttsRes.ok) {
      const data = await ttsRes.json().catch(() => ({}));
      const msg =
        (data as { detail?: string }).detail ??
        `TTS server error (${ttsRes.status})`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const buffer = Buffer.from(await ttsRes.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="speech.wav"',
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    console.error("TTS proxy error:", err);
    const isConnRefused =
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed"));
    const message = isConnRefused
      ? "O servidor TTS não está rodando. Execute: uvicorn tts_server:app --port 5002"
      : err instanceof Error && err.name === "TimeoutError"
        ? "O servidor TTS demorou demais. Verifique se tts_server.py está rodando."
        : err instanceof Error
          ? err.message
          : "Failed to generate audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
