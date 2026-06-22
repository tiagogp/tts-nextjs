import "server-only";

import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  return (
    process.env.PHRASELOOP_DATA_DIR ||
    path.join(os.homedir(), "Library", "Application Support", "PhraseLoop")
  );
}

export function modelsDir(): string {
  return path.join(dataDir(), "models", "native");
}

export function discoverCacheDir(): string {
  return path.join(dataDir(), "discover-cache");
}
