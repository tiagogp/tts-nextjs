import { NextRequest, NextResponse } from "next/server";
import { localRequest } from "@/server/localRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await localRequest("/voice-upload");
    const data = res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ name: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload failed" }, { status: 400 });
    }
    const res = await localRequest("/voice-upload", {
      method: "POST",
      body: Buffer.from(await file.arrayBuffer()),
      headers: { "X-File-Name": encodeURIComponent(file.name) },
    });
    if (res.status < 200 || res.status >= 300) {
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }
    const data = res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await localRequest("/voice-upload", { method: "DELETE" });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
