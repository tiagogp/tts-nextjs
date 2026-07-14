import { NextResponse } from "next/server";
import { parseWaitlistEntry } from "@landing/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const fields = parseWaitlistEntry(body);

  if (!fields) {
    return NextResponse.json(
      { error: "Preencha o email, o computador e como você pratica inglês hoje." },
      { status: 400 },
    );
  }

  const entry = {
    ...fields,
    source: "landing",
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
      return NextResponse.json(
        { error: "Não foi possível salvar sua inscrição agora." },
        { status: 502 },
      );
    }
  } else {
    console.info("PhraseLoop waitlist entry", entry);
  }

  return NextResponse.json({ ok: true });
}
