import { NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kicks off the one-time Kokoro voice-model download. Returns immediately with
// the current model status; the client polls /api/status for progress.
export async function POST() {
  try {
    const res = await localRequest("/models/kokoro/ensure", { method: "POST", timeoutMs: 5_000 });
    return NextResponse.json(res.json(), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Couldn't start the voice model download." },
      { status: 500 },
    );
  }
}
