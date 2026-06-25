import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fileName = "PhraseLoop-mac-arm64.dmg";

export async function GET() {
  const releaseUrl = process.env.PHRASELOOP_MACOS_DOWNLOAD_URL;
  if (releaseUrl) {
    return NextResponse.redirect(releaseUrl);
  }

  const filePath = join(process.cwd(), "dist", fileName);

  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error("Download artifact is not a file.");

    const stream = Readable.toWeb(createReadStream(filePath));

    return new Response(stream as ReadableStream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(file.size),
        "Content-Type": "application/x-apple-diskimage",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Download not available. Build the macOS artifact or set PHRASELOOP_MACOS_DOWNLOAD_URL.",
      },
      { status: 404 },
    );
  }
}
