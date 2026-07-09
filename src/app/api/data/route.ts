/**
 * Data transparency (launch checklist items 7-8).
 *
 * GET — where PhraseLoop keeps files on this machine, so Settings can show the
 * learner exactly where their data lives.
 *
 * DELETE — remove the personal files that live outside the browser store: the
 * imported-audio cache, the recorded voice reference, and debug logs. Practice data
 * itself (cards, reviews, mistakes) lives in the browser store and is cleared by the
 * client. Downloaded voice/transcription models are generic, non-personal artifacts
 * and are kept so a fresh start doesn't re-pay a ~480 MB download.
 */

import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { dataDir, discoverCacheDir } from "@/server/native/data";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ path: dataDir() });
}

export async function DELETE() {
  try {
    const root = dataDir();
    await Promise.all([
      rm(discoverCacheDir(), { recursive: true, force: true }),
      rm(path.join(root, "logs"), { recursive: true, force: true }),
      rm(path.join(root, "voice-reference.wav"), { force: true }),
      rm(path.join(root, "voice-reference.name"), { force: true }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Local data deletion failed");
    return NextResponse.json(
      { ok: false, error: "Não consegui apagar os arquivos do app. Tente de novo." },
      { status: 500 },
    );
  }
}
