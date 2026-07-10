"use client";

import type { PhraseLoopBridge } from "@/types/aiSettings";

/** Single browser-safe access point for the API exposed by Electron's preload. */
export function getElectronBridge(): PhraseLoopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.phraseLoop;
}

export function getAiSettingsBridge(): PhraseLoopBridge["aiSettings"] | undefined {
  return getElectronBridge()?.aiSettings;
}

export function toggleElectronFullscreen(): void {
  getElectronBridge()?.toggleFullscreen();
}
