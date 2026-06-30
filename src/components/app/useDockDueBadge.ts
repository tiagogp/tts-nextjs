"use client";

import { useEffect } from "react";
import { getElectronBridge } from "@/platform/electron/bridge";
import { isStoreAvailable } from "@/lib/store/db";
import { getCounts } from "@/lib/store/repository";

/**
 * Keeps the desktop dock badge in sync with the number of cards due for review —
 * the single calm re-engagement pull from the launch plan (W7). It is a no-op in
 * the browser build, where the Electron bridge is absent.
 */
export function useDockDueBadge(): void {
  useEffect(() => {
    const bridge = getElectronBridge();
    if (!bridge?.setDueCount) return;

    let cancelled = false;

    const sync = async () => {
      if (!isStoreAvailable()) {
        bridge.setDueCount?.(0);
        return;
      }
      try {
        const { due } = await getCounts();
        if (!cancelled) bridge.setDueCount?.(due);
      } catch {
        // The badge is a courtesy; never surface store errors through it.
      }
    };

    const handle = () => void sync();
    handle();
    window.addEventListener("phraseloop:activity", handle);
    window.addEventListener("phraseloop:backup-restored", handle);
    return () => {
      cancelled = true;
      window.removeEventListener("phraseloop:activity", handle);
      window.removeEventListener("phraseloop:backup-restored", handle);
    };
  }, []);
}
