import "server-only";

import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { dataDir } from "./data";

export interface ApkgValidation {
  ok: boolean;
  bytes: number;
  zipSignature: string;
  hasCollection: boolean;
  hasMediaIndex: boolean;
  collectionBytes: number;
  mediaCount: number;
  mediaFilenames: string[];
  missingMediaEntries: string[];
  errors: string[];
}

export function createApkgDebugId(): string {
  return `apkg-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function apkgDebugLogPath(): string {
  return path.join(dataDir(), "logs", "apkg-debug.jsonl");
}

export function writeApkgDebug(
  debugId: string | undefined,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const entry = {
    ts: new Date().toISOString(),
    debugId: debugId || "no-debug-id",
    event,
    ...details,
  };

  try {
    const file = apkgDebugLogPath();
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Debug logging must never break deck export.
  }

  console.info("[apkg-debug]", entry);
}

export async function validateApkgBytes(bytes: Buffer): Promise<ApkgValidation> {
  const result: ApkgValidation = {
    ok: false,
    bytes: bytes.byteLength,
    zipSignature: bytes.subarray(0, 2).toString("utf8"),
    hasCollection: false,
    hasMediaIndex: false,
    collectionBytes: 0,
    mediaCount: 0,
    mediaFilenames: [],
    missingMediaEntries: [],
    errors: [],
  };

  if (result.zipSignature !== "PK") {
    result.errors.push("APKG does not start with ZIP signature PK.");
    return result;
  }

  try {
    const zip = await JSZip.loadAsync(bytes);
    const collection = zip.file("collection.anki2");
    const media = zip.file("media");
    result.hasCollection = collection != null;
    result.hasMediaIndex = media != null;

    if (collection) {
      result.collectionBytes = (await collection.async("uint8array")).byteLength;
    } else {
      result.errors.push("Missing collection.anki2.");
    }

    if (media) {
      const parsed = JSON.parse(await media.async("string")) as Record<string, string>;
      const entries = Object.entries(parsed);
      result.mediaCount = entries.length;
      result.mediaFilenames = entries.map(([, filename]) => filename);
      result.missingMediaEntries = entries
        .filter(([index]) => zip.file(index) == null)
        .map(([index, filename]) => `${index}:${filename}`);
      if (result.missingMediaEntries.length > 0) {
        result.errors.push("Media index points to missing numeric ZIP entries.");
      }
    } else {
      result.errors.push("Missing media index.");
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Could not parse APKG ZIP.");
  }

  result.ok =
    result.errors.length === 0 &&
    result.hasCollection &&
    result.hasMediaIndex &&
    result.collectionBytes > 0;
  return result;
}
