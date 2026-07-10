import "server-only";

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  if (process.env.PHRASELOOP_DATA_DIR) return process.env.PHRASELOOP_DATA_DIR;

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "PhraseLoop");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "PhraseLoop");
  }

  const [xdgDir, electronDir, legacyMacDir] = linuxDataDirs();
  if (existsSync(electronDir) && !existsSync(xdgDir)) return electronDir;
  return existsSync(legacyMacDir) && !existsSync(xdgDir) ? legacyMacDir : xdgDir;
}

export function modelsDir(): string {
  return path.join(dataDir(), "models", "native");
}

export function modelDirs(): string[] {
  const dirs = [modelsDir()];
  if (process.env.PHRASELOOP_BUNDLED_MODELS_DIR && !dirs.includes(process.env.PHRASELOOP_BUNDLED_MODELS_DIR)) {
    dirs.push(process.env.PHRASELOOP_BUNDLED_MODELS_DIR);
  }
  if (process.env.PHRASELOOP_DATA_DIR || process.platform !== "linux") return dirs;

  for (const dir of linuxDataDirs().map((candidate) => path.join(candidate, "models", "native"))) {
    if (!dirs.includes(dir)) dirs.push(dir);
  }
  return dirs;
}

export function discoverCacheDir(): string {
  return path.join(dataDir(), "discover-cache");
}

function linuxDataDirs(): string[] {
  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return [
    path.join(xdgData, "PhraseLoop"),
    path.join(xdgConfig, "PhraseLoop"),
    path.join(os.homedir(), "Library", "Application Support", "PhraseLoop"),
  ];
}
