import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isEmail(email)) {
    return NextResponse.json({ error: "Invalid waitlist entry." }, { status: 400 });
  }

  const entry = {
    email,
    source: "landing-w5",
    createdAt: new Date().toISOString(),
  };

  const webhook = process.env.PHRASELOOP_WAITLIST_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Could not save waitlist entry." }, { status: 502 });
    }
  } else {
    console.info("PhraseLoop waitlist entry", entry);
  }

  return NextResponse.json({ ok: true });
}
