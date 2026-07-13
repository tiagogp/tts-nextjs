import { NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = await localRequest("/models/whisper/ensure", {
      method: "POST",
      timeoutMs: 3_000,
    });
    return NextResponse.json(res.json(), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Could not start speech-recognition preparation." },
      { status: 502 },
    );
  }
}
