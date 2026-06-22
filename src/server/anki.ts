/**
 * Server-only helpers shared by the .apkg export routes:
 * building a
 * UTF-8-safe Content-Disposition for the downloaded deck.
 */

import "server-only";
function asciiFallbackFilename(raw: string): string {
  const normalized = raw.normalize("NFKD");
  const asciiOnly = normalized.replaceAll(/[^\x20-\x7E]/g, "_");
  const noBadChars = asciiOnly
    .replaceAll(/[\\/:*?"<>|]+/g, "_")
    .replaceAll(/["\\]/g, "_");
  const collapsed = noBadChars.replaceAll(/\s+/g, " ").trim();
  return collapsed || "anki-deck";
}

function encodeRFC5987ValueChars(raw: string): string {
  // RFC 5987 (used by RFC 6266 filename*): percent-encode UTF-8 bytes.
  return encodeURIComponent(raw)
    .replaceAll(
      /['()]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replaceAll(/\*/g, "%2A");
}

export function contentDispositionAttachment(filenameUtf8: string): string {
  const fallback = asciiFallbackFilename(filenameUtf8);
  const fallbackQuoted = fallback.replaceAll(/"/g, "_");
  const encoded = encodeRFC5987ValueChars(filenameUtf8);
  return `attachment; filename="${fallbackQuoted}"; filename*=UTF-8''${encoded}`;
}
