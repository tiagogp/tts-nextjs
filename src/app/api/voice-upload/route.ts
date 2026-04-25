import { NextRequest, NextResponse } from "next/server";

const TTS_SERVER = "http://localhost:5002";

export async function GET() {
  try {
    const res = await fetch(`${TTS_SERVER}/voice-upload`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ name: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${TTS_SERVER}/voice-upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await fetch(`${TTS_SERVER}/voice-upload`, { method: "DELETE" });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
