/**
 * Server-only helpers shared by the .apkg export routes:
 * resolving the backend Python interpreter, spawning it, and building a
 * UTF-8-safe Content-Disposition for the downloaded deck.
 */

import "server-only";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export function spawnCapture(
  cmd: string,
  args: string[],
  opts: { cwd: string },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

export async function resolveBackendPython(repoRoot: string): Promise<string> {
  if (process.env.BACKEND_PYTHON) return process.env.BACKEND_PYTHON;
  const candidates = [
    path.join(repoRoot, "backend", ".venv", "bin", "python"),
    path.join(repoRoot, "backend", ".venv", "bin", "python3"),
    "python3",
    "python",
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return "python3";
}

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
