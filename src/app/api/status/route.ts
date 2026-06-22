import { NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await localRequest("/status", { timeoutMs: 3_000 });
    const data = res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ready: false, downloading_model: false });
  }
}
